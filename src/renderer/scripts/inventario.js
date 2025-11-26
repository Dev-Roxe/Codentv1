// inventario.js

let db;
if (window.api && window.api.db) db = window.api.db;

let inventory = [];
let showLowStockOnly = false;

/* ============================================================================
   UTILITIES
============================================================================ */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `animate-slide-up px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 ${type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
                'bg-[#1D5D69] text-white'
        }`;

    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX');
}

function isExpired(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d < now;
}

/* ============================================================================
   DATA LOADING
============================================================================ */
function loadInventory() {
    if (!db) return;

    db.all("SELECT * FROM medicamentos ORDER BY nombre ASC", [], (err, rows) => {
        if (err) {
            console.error(err);
            showToast('Error al cargar inventario', 'error');
            return;
        }
        inventory = rows || [];
        renderInventory();
        updateStats();
    });
}

/* ============================================================================
   RENDERING
============================================================================ */
function updateStats() {
    const total = inventory.length;
    const lowStock = inventory.filter(i => i.stock < 5).length;
    const value = inventory.reduce((acc, i) => acc + (i.precio * i.stock), 0);

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statLowStock').textContent = lowStock;
    document.getElementById('statValue').textContent = `$${value.toFixed(2)}`;
}

function renderInventory() {
    const tbody = document.getElementById('inventory-list-body');
    const search = document.getElementById('searchInput').value.toLowerCase();

    let filtered = inventory.filter(i =>
        i.nombre.toLowerCase().includes(search) ||
        (i.descripcion && i.descripcion.toLowerCase().includes(search))
    );

    if (showLowStockOnly) {
        filtered = filtered.filter(i => i.stock < 5);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-500">No hay ítems registrados</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const expired = isExpired(item.fecha_vencimiento);
        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
            <td class="py-4 px-6 font-medium text-gray-900 dark:text-white">${item.nombre}</td>
            <td class="py-4 px-6 text-gray-600 dark:text-gray-300">${item.descripcion || '-'}</td>
            <td class="py-4 px-6">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${item.stock < 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
                    ${item.stock}
                </span>
            </td>
            <td class="py-4 px-6 text-gray-600 dark:text-gray-300">$${item.precio.toFixed(2)}</td>
            <td class="py-4 px-6 text-gray-600 dark:text-gray-300">
                <span class="${expired ? 'text-red-600 font-bold' : ''}">
                    ${formatDate(item.fecha_vencimiento)}
                    ${expired ? '(Vencido)' : ''}
                </span>
            </td>
            <td class="py-4 px-6 text-center flex justify-center gap-2">
                <button onclick="editItem(${item.id})" class="text-blue-500 hover:text-blue-700 transition" title="Editar">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button onclick="deleteItem(${item.id})" class="text-red-500 hover:text-red-700 transition" title="Eliminar">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
        </tr>
    `}).join('');
}

/* ============================================================================
   ACTIONS
============================================================================ */
function showNewItemModal(itemToEdit = null) {
    const isEdit = !!itemToEdit;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
            <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 flex justify-between items-center">
                <h2 class="text-xl font-bold">${isEdit ? 'Editar Medicamento' : 'Nuevo Medicamento'}</h2>
                <button id="closeModal" class="hover:bg-white/20 rounded p-1"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <form id="form-new-item" class="p-6 space-y-4">
                <input type="hidden" name="id" value="${isEdit ? itemToEdit.id : ''}" />
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                    <input name="nombre" value="${isEdit ? itemToEdit.nombre : ''}" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-[#4EABBE]" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                    <textarea name="descripcion" rows="2" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-[#4EABBE]">${isEdit ? (itemToEdit.descripcion || '') : ''}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock</label>
                        <input name="stock" type="number" value="${isEdit ? itemToEdit.stock : ''}" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-[#4EABBE]" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio</label>
                        <input name="precio" type="number" step="0.01" value="${isEdit ? itemToEdit.precio : ''}" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-[#4EABBE]" />
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Vencimiento</label>
                    <input name="fecha_vencimiento" type="date" value="${isEdit ? (itemToEdit.fecha_vencimiento || '') : ''}" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-[#4EABBE]" />
                </div>
                <div class="pt-4 flex justify-end gap-3">
                    <button type="button" id="cancelModal" class="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-[#4EABBE] text-white rounded-lg hover:bg-[#1D5D69]">Guardar</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#closeModal').addEventListener('click', closeModal);
    modal.querySelector('#cancelModal').addEventListener('click', closeModal);

    modal.querySelector('#form-new-item').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        saveItem({
            id: formData.get('id'),
            nombre: formData.get('nombre'),
            descripcion: formData.get('descripcion'),
            stock: formData.get('stock'),
            precio: formData.get('precio'),
            fecha_vencimiento: formData.get('fecha_vencimiento')
        }, closeModal);
    });
}

function saveItem(data, cb) {
    if (!db) return;

    let sql, params;
    if (data.id) {
        // Update
        sql = `UPDATE medicamentos SET nombre = ?, descripcion = ?, stock = ?, precio = ?, fecha_vencimiento = ? WHERE id = ?`;
        params = [data.nombre, data.descripcion, data.stock, data.precio, data.fecha_vencimiento, data.id];
    } else {
        // Insert
        sql = `INSERT INTO medicamentos (nombre, descripcion, stock, precio, fecha_vencimiento) VALUES (?, ?, ?, ?, ?)`;
        params = [data.nombre, data.descripcion, data.stock, data.precio, data.fecha_vencimiento];
    }

    const run = (fn) => {
        if (db.run.length >= 3) db.run(sql, params, fn);
        else db.run(sql, params).then(() => fn(null)).catch(fn);
    };

    run((err) => {
        if (err) showToast('Error al guardar: ' + err.message, 'error');
        else {
            showToast('Medicamento guardado', 'success');
            loadInventory();
            cb();
        }
    });
}

window.editItem = function (id) {
    const item = inventory.find(i => i.id === id);
    if (item) showNewItemModal(item);
};

window.deleteItem = function (id) {
    if (!confirm('¿Eliminar este ítem?')) return;
    if (!db) return;

    const sql = "DELETE FROM medicamentos WHERE id = ?";
    const run = (fn) => {
        if (db.run.length >= 3) db.run(sql, [id], fn);
        else db.run(sql, [id]).then(() => fn(null)).catch(fn);
    };

    run((err) => {
        if (err) showToast('Error al eliminar', 'error');
        else {
            showToast('Ítem eliminado', 'success');
            loadInventory();
        }
    });
};

/* ============================================================================
   INIT
============================================================================ */
document.getElementById('newItemBtn').addEventListener('click', () => showNewItemModal());
document.getElementById('searchInput').addEventListener('input', renderInventory);

const filterBtn = document.getElementById('filterLowStockBtn');
if (filterBtn) {
    filterBtn.addEventListener('click', () => {
        showLowStockOnly = !showLowStockOnly;
        filterBtn.classList.toggle('bg-orange-100', showLowStockOnly);
        filterBtn.classList.toggle('border-orange-500', showLowStockOnly);
        renderInventory();
    });
}

loadInventory();
