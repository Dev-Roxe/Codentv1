// administracion.js - v2 Mejorado
// Gestión completa del catálogo de tratamientos

let db = (window.api && window.api.db) ? window.api.db : null;
let currentFilter = 'all';
let editingId = null;
let allTratamientos = [];

// Helper functions for database operations
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve([]);
      if (db.all && db.all.length >= 3) {
        db.all(sql, params, (err, rows) => { if (err) return reject(err); resolve(rows || []); });
      } else if (db.all) {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      } else {
        resolve([]);
      }
    } catch (e) { reject(e); }
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve(null);
      if (db.get && db.get.length >= 3) {
        db.get(sql, params, (err, row) => { if (err) return reject(err); resolve(row || null); });
      } else if (db.get) {
        db.get(sql, params).then(row => resolve(row || null)).catch(reject);
      } else {
        resolve(null);
      }
    } catch (e) { reject(e); }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return reject(new Error('DB no disponible'));
      if (db.run && db.run.length >= 3) {
        db.run(sql, params, function (err) { if (err) return reject(err); resolve(this); });
      } else if (db.run) {
        db.run(sql, params).then(res => resolve(res)).catch(reject);
      } else {
        reject(new Error('DB methods not available'));
      }
    } catch (e) { reject(e); }
  });
}

// Toast notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  toast.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300 translate-x-0 opacity-100`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Cargar todos los tratamientos
async function loadTratamientos() {
  const list = document.getElementById('tratamientos-list');
  if (!list) return;

  try {
    let sql = 'SELECT * FROM tratamientos_catalogo';
    let params = [];

    if (currentFilter !== 'all') {
      sql += ' WHERE categoria = ?';
      params.push(currentFilter);
    }

    sql += ' ORDER BY categoria, nombre ASC';

    const rows = await dbAll(sql, params);
    allTratamientos = rows; // Guardar para estadísticas

    // Actualizar estadísticas
    updateTratamientosStats(rows);

    if (rows.length === 0) {
      list.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            <div class="flex flex-col items-center gap-3">
              <svg class="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-sm font-medium">No hay tratamientos en esta categoría</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    list.innerHTML = rows.map(t => {
      const estado = t.activo ? '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Activo</span>' : '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Inactivo</span>';

      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
          <td class="px-6 py-4 font-semibold text-[#0F2532] dark:text-white">
            <div>
              <p>${t.nombre}</p>
              ${t.descripcion ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${t.descripcion}</p>` : ''}
            </div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">${t.categoria}</td>
          <td class="px-6 py-4 text-sm font-medium text-[#4EABBE]">$${parseFloat(t.costo_base).toFixed(2)}</td>
          <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">${t.duracion_estimada || '-'} min</td>
          <td class="px-6 py-4">${estado}</td>
          <td class="px-6 py-4 text-right">
            <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="editTratamiento(${t.id})" title="Editar" class="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-blue-600 dark:text-blue-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onclick="deleteTratamiento(${t.id})" title="Eliminar" class="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition text-red-600 dark:text-red-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${e.message}</td></tr>`;
  }
}

// Actualizar estadísticas de tratamientos
async function updateTratamientosStats(tratamientos = null) {
  try {
    if (!tratamientos) {
      tratamientos = await dbAll('SELECT * FROM tratamientos_catalogo');
    }

    const total = tratamientos.length;
    const activos = tratamientos.filter(t => t.activo).length;
    const costoPromedio = total > 0 ? (tratamientos.reduce((sum, t) => sum + parseFloat(t.costo_base || 0), 0) / total).toFixed(2) : '0';

    const statTotal = document.getElementById('stat-total-tratamientos');
    const statActivos = document.getElementById('stat-activos');
    const statCosto = document.getElementById('stat-costo-promedio');

    if (statTotal) statTotal.textContent = total;
    if (statActivos) statActivos.textContent = activos;
    if (statCosto) statCosto.textContent = '$' + costoPromedio;
  } catch (e) {
    console.error('Error updating stats:', e);
  }
}

// Filtrar por categoría
function filterByCategoria(categoria) {
  currentFilter = categoria;

  // Actualizar estilos de botones
  document.querySelectorAll('.categoria-btn').forEach(btn => {
    btn.classList.remove('bg-[#4EABBE]', 'text-white');
    btn.classList.add('bg-gray-100', 'dark:bg-slate-800', 'text-[#0F2532]', 'dark:text-slate-300', 'hover:bg-[#8BCFDD]/30', 'dark:hover:bg-slate-700');
  });

  document.querySelector(`[data-categoria="${categoria}"]`)?.classList.add('bg-[#4EABBE]', 'text-white');
  document.querySelector(`[data-categoria="${categoria}"]`)?.classList.remove('bg-gray-100', 'dark:bg-slate-800', 'text-[#0F2532]', 'dark:text-slate-300', 'hover:bg-[#8BCFDD]/30', 'dark:hover:bg-slate-700');

  loadTratamientos();
}

// Abrir modal de nuevo tratamiento
function openNewTratamientoModal() {
  editingId = null;
  const form = document.getElementById('form-tratamiento');
  if (form) {
    form.reset();
    document.getElementById('tratamiento-id').value = '';
  }

  const subtitle = document.getElementById('modal-subtitle');
  if (subtitle) subtitle.textContent = 'Nuevo';

  document.getElementById('modal-tratamiento')?.classList.remove('hidden');
}

// Cerrar modal
function closeModal() {
  document.getElementById('modal-tratamiento')?.classList.add('hidden');
}

// Editar tratamiento
async function editTratamiento(id) {
  try {
    const tratamiento = await dbGet('SELECT * FROM tratamientos_catalogo WHERE id = ?', [id]);
    if (!tratamiento) {
      showToast('Tratamiento no encontrado', 'error');
      return;
    }

    editingId = id;

    // Llenar el formulario
    document.getElementById('tratamiento-id').value = tratamiento.id;
    document.querySelector('input[name="nombre"]').value = tratamiento.nombre;
    document.querySelector('textarea[name="descripcion"]').value = tratamiento.descripcion || '';
    document.querySelector('select[name="categoria"]').value = tratamiento.categoria;
    document.querySelector('input[name="costo_base"]').value = tratamiento.costo_base;
    document.querySelector('input[name="duracion_estimada"]').value = tratamiento.duracion_estimada || 30;
    document.querySelector('input[name="costo_medicina_estandar"]').value = tratamiento.costo_medicina_estandar || 0;
    document.querySelector('input[name="costo_miscelanea_estandar"]').value = tratamiento.costo_miscelanea_estandar || 0;
    document.querySelector('textarea[name="notas_especiales"]').value = tratamiento.notas_especiales || '';
    document.querySelector('input[name="activo"]').checked = tratamiento.activo === 1;

    const subtitle = document.getElementById('modal-subtitle');
    if (subtitle) subtitle.textContent = 'Editando';

    document.getElementById('modal-tratamiento')?.classList.remove('hidden');
  } catch (e) {
    showToast('Error al cargar tratamiento: ' + e.message, 'error');
  }
}

// Guardar tratamiento
async function saveTratamiento(e) {
  e.preventDefault();

  const form = document.getElementById('form-tratamiento');
  const formData = new FormData(form);

  const data = {
    id: formData.get('id'),
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    categoria: formData.get('categoria'),
    costo_base: parseFloat(formData.get('costo_base')) || 0,
    duracion_estimada: parseInt(formData.get('duracion_estimada')) || 30,
    activo: formData.get('activo') ? 1 : 0,
    costo_medicina_estandar: parseFloat(formData.get('costo_medicina_estandar')) || 0,
    costo_miscelanea_estandar: parseFloat(formData.get('costo_miscelanea_estandar')) || 0,
    notas_especiales: formData.get('notas_especiales')
  };

  if (!data.nombre || !data.categoria) {
    showToast('Por favor completa los campos requeridos', 'error');
    return;
  }

  try {
    if (data.id) {
      // Update
      await dbRun(
        `UPDATE tratamientos_catalogo SET nombre=?, descripcion=?, categoria=?, costo_base=?, duracion_estimada=?, activo=?, costo_medicina_estandar=?, costo_miscelanea_estandar=?, notas_especiales=? WHERE id=?`,
        [data.nombre, data.descripcion, data.categoria, data.costo_base, data.duracion_estimada, data.activo, data.costo_medicina_estandar, data.costo_miscelanea_estandar, data.notas_especiales, data.id]
      );
      showToast('Tratamiento actualizado correctamente', 'success');
    } else {
      // Insert
      await dbRun(
        `INSERT INTO tratamientos_catalogo (nombre, descripcion, categoria, costo_base, duracion_estimada, activo, costo_medicina_estandar, costo_miscelanea_estandar, notas_especiales) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.nombre, data.descripcion, data.categoria, data.costo_base, data.duracion_estimada, data.activo, data.costo_medicina_estandar, data.costo_miscelanea_estandar, data.notas_especiales]
      );
      showToast('Tratamiento creado correctamente', 'success');
    }

    closeModal();
    loadTratamientos();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
  }
}

// Eliminar tratamiento
async function deleteTratamiento(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este tratamiento?')) return;

  try {
    await dbRun('DELETE FROM tratamientos_catalogo WHERE id = ?', [id]);
    showToast('Tratamiento eliminado', 'success');
    loadTratamientos();
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

// ============================================================================
// MEDICAMENTOS MANAGEMENT
// ============================================================================

let allMedicamentos = [];
let showLowStockOnly = false;

// Utility functions for medicamentos
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

// Cargar todos los medicamentos
async function loadMedicamentos() {
  const list = document.getElementById('medicamentos-list');
  if (!list) return;

  try {
    const sql = 'SELECT * FROM medicamentos ORDER BY nombre ASC';
    const rows = await dbAll(sql, []);
    allMedicamentos = rows;

    // Actualizar estadísticas
    updateMedicamentosStats(rows);

    // Aplicar filtros
    renderMedicamentos();
  } catch (e) {
    list.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${e.message}</td></tr>`;
  }
}

// Renderizar medicamentos con filtros
function renderMedicamentos() {
  const list = document.getElementById('medicamentos-list');
  if (!list) return;

  const searchInput = document.getElementById('searchMedicamentos');
  const search = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = allMedicamentos.filter(m =>
    m.nombre.toLowerCase().includes(search) ||
    (m.descripcion && m.descripcion.toLowerCase().includes(search))
  );

  if (showLowStockOnly) {
    filtered = filtered.filter(m => m.stock < 5);
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-gray-500 dark:text-gray-400">
          <div class="flex flex-col items-center gap-3">
            <svg class="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p class="text-sm font-medium">No hay ítems registrados</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  list.innerHTML = filtered.map(item => {
    const expired = isExpired(item.fecha_vencimiento);
    const lowStock = item.stock < 5;

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
        <td class="py-4 px-6 font-medium text-gray-900 dark:text-white">${item.nombre}</td>
        <td class="py-4 px-6 text-gray-600 dark:text-gray-300">${item.descripcion || '-'}</td>
        <td class="py-4 px-6">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${lowStock ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}">
            ${item.stock}
          </span>
        </td>
        <td class="py-4 px-6 text-gray-600 dark:text-gray-300">$${parseFloat(item.precio).toFixed(2)}</td>
        <td class="py-4 px-6 text-gray-600 dark:text-gray-300">
          <span class="${expired ? 'text-red-600 dark:text-red-400 font-bold' : ''}">
            ${formatDate(item.fecha_vencimiento)}
            ${expired ? '(Vencido)' : ''}
          </span>
        </td>
        <td class="py-4 px-6 text-center flex justify-center gap-2">
          <button onclick="editMedicamento(${item.id})" class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition" title="Editar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onclick="deleteMedicamento(${item.id})" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition" title="Eliminar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Actualizar estadísticas de medicamentos
function updateMedicamentosStats(medicamentos = null) {
  if (!medicamentos) medicamentos = allMedicamentos;

  const total = medicamentos.length;
  const lowStock = medicamentos.filter(m => m.stock < 5).length;
  const value = medicamentos.reduce((acc, m) => acc + (parseFloat(m.precio) * m.stock), 0);

  const statTotal = document.getElementById('statTotalMedicamentos');
  const statLowStock = document.getElementById('statLowStockMedicamentos');
  const statValue = document.getElementById('statValueMedicamentos');

  if (statTotal) statTotal.textContent = total;
  if (statLowStock) statLowStock.textContent = lowStock;
  if (statValue) statValue.textContent = `$${value.toFixed(2)}`;
}

// Abrir modal de nuevo medicamento
function openNewMedicamentoModal() {
  const form = document.getElementById('form-medicamento');
  if (form) {
    form.reset();
    document.getElementById('medicamento-id-input').value = '';
  }

  const title = document.getElementById('modal-medicamento-title');
  if (title) title.textContent = 'Nuevo Medicamento';

  document.getElementById('modal-medicamento')?.classList.remove('hidden');
}

// Cerrar modal de medicamento
function closeMedicamentoModal() {
  document.getElementById('modal-medicamento')?.classList.add('hidden');
}

// Editar medicamento
async function editMedicamento(id) {
  try {
    const medicamento = await dbGet('SELECT * FROM medicamentos WHERE id = ?', [id]);
    if (!medicamento) {
      showToast('Medicamento no encontrado', 'error');
      return;
    }

    // Llenar el formulario
    document.getElementById('medicamento-id-input').value = medicamento.id;
    document.querySelector('#form-medicamento input[name="nombre"]').value = medicamento.nombre;
    document.querySelector('#form-medicamento textarea[name="descripcion"]').value = medicamento.descripcion || '';
    document.querySelector('#form-medicamento input[name="stock"]').value = medicamento.stock;
    document.querySelector('#form-medicamento input[name="stock_minimo"]').value = medicamento.stock_minimo || 5;
    document.querySelector('#form-medicamento input[name="precio"]').value = medicamento.precio;
    document.querySelector('#form-medicamento input[name="fecha_vencimiento"]').value = medicamento.fecha_vencimiento || '';

    const title = document.getElementById('modal-medicamento-title');
    if (title) title.textContent = 'Editar Medicamento';

    document.getElementById('modal-medicamento')?.classList.remove('hidden');
  } catch (e) {
    showToast('Error al cargar medicamento: ' + e.message, 'error');
  }
}

// Guardar medicamento
async function saveMedicamento(e) {
  e.preventDefault();

  const form = document.getElementById('form-medicamento');
  const formData = new FormData(form);

  const data = {
    id: document.getElementById('medicamento-id-input').value,
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    stock: parseInt(formData.get('stock')) || 0,
    stock_minimo: parseInt(formData.get('stock_minimo')) || 5,
    precio: parseFloat(formData.get('precio')) || 0,
    fecha_vencimiento: formData.get('fecha_vencimiento') || null
  };

  if (!data.nombre) {
    showToast('Por favor completa los campos requeridos', 'error');
    return;
  }

  try {
    if (data.id) {
      // Update
      await dbRun(
        `UPDATE medicamentos SET nombre=?, descripcion=?, stock=?, precio=?, fecha_vencimiento=? WHERE id=?`,
        [data.nombre, data.descripcion, data.stock, data.precio, data.fecha_vencimiento, data.id]
      );
      showToast('Medicamento actualizado correctamente', 'success');
    } else {
      // Insert
      await dbRun(
        `INSERT INTO medicamentos (nombre, descripcion, stock, precio, fecha_vencimiento) VALUES (?, ?, ?, ?, ?)`,
        [data.nombre, data.descripcion, data.stock, data.precio, data.fecha_vencimiento]
      );
      showToast('Medicamento creado correctamente', 'success');
    }

    closeMedicamentoModal();
    loadMedicamentos();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
  }
}

// Eliminar medicamento
async function deleteMedicamento(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este medicamento?')) return;

  try {
    await dbRun('DELETE FROM medicamentos WHERE id = ?', [id]);
    showToast('Medicamento eliminado', 'success');
    loadMedicamentos();
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

// ============================================================================
// MISCELÁNEA MANAGEMENT
// ============================================================================

let allMiscelanea = [];
let showLowStockMiscelaneaOnly = false;
let currentMiscelaneaFilter = 'all';

// Cargar todos los ítems de miscelánea
async function loadMiscelanea() {
  const list = document.getElementById('miscelanea-list');
  if (!list) return;

  try {
    let sql = 'SELECT * FROM miscelanea';
    let params = [];

    if (currentMiscelaneaFilter !== 'all') {
      sql += ' WHERE categoria = ?';
      params.push(currentMiscelaneaFilter);
    }

    sql += ' ORDER BY nombre ASC';

    const rows = await dbAll(sql, params);
    allMiscelanea = rows;

    // Actualizar estadísticas
    updateMiscelaneaStats(rows);

    // Aplicar filtros
    renderMiscelanea();
  } catch (e) {
    list.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error: ${e.message}</td></tr>`;
  }
}

// Renderizar miscelánea con filtros
function renderMiscelanea() {
  const list = document.getElementById('miscelanea-list');
  if (!list) return;

  const searchInput = document.getElementById('searchMiscelanea');
  const search = searchInput ? searchInput.value.toLowerCase() : '';

  let filtered = allMiscelanea.filter(m =>
    m.nombre.toLowerCase().includes(search) ||
    (m.descripcion && m.descripcion.toLowerCase().includes(search)) ||
    (m.categoria && m.categoria.toLowerCase().includes(search)) ||
    (m.proveedor && m.proveedor.toLowerCase().includes(search))
  );

  if (showLowStockMiscelaneaOnly) {
    filtered = filtered.filter(m => m.stock < (m.stock_minimo || 5));
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-gray-500 dark:text-gray-400">
          <div class="flex flex-col items-center gap-3">
            <svg class="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p class="text-sm font-medium">No hay ítems registrados</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  list.innerHTML = filtered.map(item => {
    const lowStock = item.stock < (item.stock_minimo || 5);

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
        <td class="py-4 px-6">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">${item.nombre}</p>
            ${item.descripcion ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${item.descripcion}</p>` : ''}
          </div>
        </td>
        <td class="py-4 px-6 text-gray-600 dark:text-gray-300">${item.categoria || '-'}</td>
        <td class="py-4 px-6">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${lowStock ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}">
            ${item.stock}
          </span>
        </td>
        <td class="py-4 px-6 text-gray-600 dark:text-gray-300">$${parseFloat(item.precio).toFixed(2)}</td>
        <td class="py-4 px-6 text-gray-600 dark:text-gray-300">${item.proveedor || '-'}</td>
        <td class="py-4 px-6 text-center flex justify-center gap-2">
          <button onclick="editMiscelanea(${item.id})" class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition" title="Editar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onclick="deleteMiscelanea(${item.id})" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition" title="Eliminar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Actualizar estadísticas de miscelánea
function updateMiscelaneaStats(miscelanea = null) {
  if (!miscelanea) miscelanea = allMiscelanea;

  const total = miscelanea.length;
  const lowStock = miscelanea.filter(m => m.stock < (m.stock_minimo || 5)).length;
  const value = miscelanea.reduce((acc, m) => acc + (parseFloat(m.precio) * m.stock), 0);

  const statTotal = document.getElementById('statTotalMiscelanea');
  const statLowStock = document.getElementById('statLowStockMiscelanea');
  const statValue = document.getElementById('statValueMiscelanea');

  if (statTotal) statTotal.textContent = total;
  if (statLowStock) statLowStock.textContent = lowStock;
  if (statValue) statValue.textContent = `$${value.toFixed(2)}`;
}

// Filtrar por categoría
function filterByCategoriaMisc(categoria) {
  currentMiscelaneaFilter = categoria;

  // Actualizar estilos de botones
  document.querySelectorAll('.categoria-misc-btn').forEach(btn => {
    btn.classList.remove('bg-[#4EABBE]', 'text-white');
    btn.classList.add('bg-gray-100', 'dark:bg-slate-800', 'text-[#0F2532]', 'dark:text-slate-300', 'hover:bg-[#8BCFDD]/30', 'dark:hover:bg-slate-700');
  });

  document.querySelector(`[data-categoria-misc="${categoria}"]`)?.classList.add('bg-[#4EABBE]', 'text-white');
  document.querySelector(`[data-categoria-misc="${categoria}"]`)?.classList.remove('bg-gray-100', 'dark:bg-slate-800', 'text-[#0F2532]', 'dark:text-slate-300', 'hover:bg-[#8BCFDD]/30', 'dark:hover:bg-slate-700');

  loadMiscelanea();
}

// Abrir modal de nuevo ítem
function openNewMiscelaneaModal() {
  const form = document.getElementById('form-miscelanea');
  if (form) {
    form.reset();
    document.getElementById('miscelanea-id-input').value = '';
  }

  const title = document.getElementById('modal-miscelanea-title');
  if (title) title.textContent = 'Nuevo Material';

  document.getElementById('modal-miscelanea')?.classList.remove('hidden');
}

// Cerrar modal de miscelánea
function closeMiscelaneaModal() {
  document.getElementById('modal-miscelanea')?.classList.add('hidden');
}

// Editar ítem de miscelánea
async function editMiscelanea(id) {
  try {
    const item = await dbGet('SELECT * FROM miscelanea WHERE id = ?', [id]);
    if (!item) {
      showToast('Ítem no encontrado', 'error');
      return;
    }

    // Llenar el formulario
    document.getElementById('miscelanea-id-input').value = item.id;
    document.querySelector('#form-miscelanea input[name="nombre"]').value = item.nombre;
    document.querySelector('#form-miscelanea textarea[name="descripcion"]').value = item.descripcion || '';
    document.querySelector('#form-miscelanea select[name="categoria"]').value = item.categoria || '';
    document.querySelector('#form-miscelanea input[name="stock"]').value = item.stock;
    document.querySelector('#form-miscelanea input[name="stock_minimo"]').value = item.stock_minimo || 5;
    document.querySelector('#form-miscelanea input[name="precio"]').value = item.precio;
    document.querySelector('#form-miscelanea input[name="proveedor"]').value = item.proveedor || '';
    document.querySelector('#form-miscelanea input[name="fecha_compra"]').value = item.fecha_compra || '';
    document.querySelector('#form-miscelanea textarea[name="notas"]').value = item.notas || '';

    const title = document.getElementById('modal-miscelanea-title');
    if (title) title.textContent = 'Editar Material';

    document.getElementById('modal-miscelanea')?.classList.remove('hidden');
  } catch (e) {
    showToast('Error al cargar ítem: ' + e.message, 'error');
  }
}

// Guardar ítem de miscelánea
async function saveMiscelanea(e) {
  e.preventDefault();

  const form = document.getElementById('form-miscelanea');
  const formData = new FormData(form);

  const data = {
    id: document.getElementById('miscelanea-id-input').value,
    nombre: formData.get('nombre'),
    descripcion: formData.get('descripcion'),
    categoria: formData.get('categoria'),
    stock: parseInt(formData.get('stock')) || 0,
    stock_minimo: parseInt(formData.get('stock_minimo')) || 5,
    precio: parseFloat(formData.get('precio')) || 0,
    proveedor: formData.get('proveedor'),
    fecha_compra: formData.get('fecha_compra') || null,
    notas: formData.get('notas')
  };

  if (!data.nombre) {
    showToast('Por favor completa los campos requeridos', 'error');
    return;
  }

  try {
    if (data.id) {
      // Update
      await dbRun(
        `UPDATE miscelanea SET nombre=?, descripcion=?, categoria=?, stock=?, stock_minimo=?, precio=?, proveedor=?, fecha_compra=?, notas=? WHERE id=?`,
        [data.nombre, data.descripcion, data.categoria, data.stock, data.stock_minimo, data.precio, data.proveedor, data.fecha_compra, data.notas, data.id]
      );
      showToast('Material actualizado correctamente', 'success');
    } else {
      // Insert
      await dbRun(
        `INSERT INTO miscelanea (nombre, descripcion, categoria, stock, stock_minimo, precio, proveedor, fecha_compra, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.nombre, data.descripcion, data.categoria, data.stock, data.stock_minimo, data.precio, data.proveedor, data.fecha_compra, data.notas]
      );
      showToast('Material creado correctamente', 'success');
    }

    closeMiscelaneaModal();
    loadMiscelanea();
  } catch (e) {
    showToast('Error al guardar: ' + e.message, 'error');
  }
}

// Eliminar ítem de miscelánea
async function deleteMiscelanea(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este ítem?')) return;

  try {
    await dbRun('DELETE FROM miscelanea WHERE id = ?', [id]);
    showToast('Ítem eliminado', 'success');
    loadMiscelanea();
  } catch (e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}


// Hacer funciones globales
window.editTratamiento = editTratamiento;
window.deleteTratamiento = deleteTratamiento;
window.filterByCategoria = filterByCategoria;
window.openNewTratamientoModal = openNewTratamientoModal;
window.closeModal = closeModal;
window.saveTratamiento = saveTratamiento;
window.editMedicamento = editMedicamento;
window.deleteMedicamento = deleteMedicamento;
window.openNewMedicamentoModal = openNewMedicamentoModal;
window.closeMedicamentoModal = closeMedicamentoModal;
window.saveMedicamento = saveMedicamento;
window.editMiscelanea = editMiscelanea;
window.deleteMiscelanea = deleteMiscelanea;
window.filterByCategoriaMisc = filterByCategoriaMisc;
window.openNewMiscelaneaModal = openNewMiscelaneaModal;
window.closeMiscelaneaModal = closeMiscelaneaModal;
window.saveMiscelanea = saveMiscelanea;

// Inicializar
function init() {
  // Tab switching
  const tabTratamientos = document.getElementById('tab-tratamientos');
  const tabInventario = document.getElementById('tab-inventario');
  const tabMiscelanea = document.getElementById('tab-miscelanea');
  const contentTratamientos = document.getElementById('content-tratamientos');
  const contentInventario = document.getElementById('content-inventario');
  const contentMiscelanea = document.getElementById('content-miscelanea');

  function hideAllTabs() {
    contentTratamientos?.classList.add('hidden');
    contentInventario?.classList.add('hidden');
    contentMiscelanea?.classList.add('hidden');
  }

  function resetTabStyles() {
    if (tabTratamientos) tabTratamientos.className = 'tab-btn flex-1 min-w-[180px] px-6 py-3 rounded-xl text-sm font-semibold transition bg-gray-100 dark:bg-slate-800 text-[#0F2532] dark:text-slate-300 hover:bg-[#8BCFDD]/30 dark:hover:bg-slate-700';
    if (tabInventario) tabInventario.className = 'tab-btn flex-1 min-w-[180px] px-6 py-3 rounded-xl text-sm font-semibold transition bg-gray-100 dark:bg-slate-800 text-[#0F2532] dark:text-slate-300 hover:bg-[#8BCFDD]/30 dark:hover:bg-slate-700';
    if (tabMiscelanea) tabMiscelanea.className = 'tab-btn flex-1 min-w-[180px] px-6 py-3 rounded-xl text-sm font-semibold transition bg-gray-100 dark:bg-slate-800 text-[#0F2532] dark:text-slate-300 hover:bg-[#8BCFDD]/30 dark:hover:bg-slate-700';
  }

  if (tabTratamientos) {
    tabTratamientos.addEventListener('click', () => {
      hideAllTabs();
      resetTabStyles();
      tabTratamientos.className = 'tab-btn flex-1 min-w-[180px] px-6 py-3 rounded-xl text-sm font-semibold transition bg-[#4EABBE] text-white';
      contentTratamientos?.classList.remove('hidden');
      loadTratamientos();
    });
  }

  if (tabInventario) {
    tabInventario.addEventListener('click', () => {
      hideAllTabs();
      resetTabStyles();
      tabInventario.className = 'tab-btn flex-1 min-w-[180px] px-6 py-3 rounded-xl text-sm font-semibold transition bg-[#4EABBE] text-white';
      contentInventario?.classList.remove('hidden');
      loadMedicamentos();
    });
  }

  if (tabMiscelanea) {
    tabMiscelanea.addEventListener('click', () => {
      hideAllTabs();
      resetTabStyles();
      tabMiscelanea.className = 'tab-btn flex-1 min-w-[180px] px-6 py-3 rounded-xl text-sm font-semibold transition bg-[#4EABBE] text-white';
      contentMiscelanea?.classList.remove('hidden');
      loadMiscelanea();
    });
  }

  // Event listeners for Tratamientos
  document.getElementById('add-tratamiento-btn')?.addEventListener('click', openNewTratamientoModal);
  document.getElementById('close-modal-tratamiento')?.addEventListener('click', closeModal);
  document.getElementById('cancel-tratamiento')?.addEventListener('click', closeModal);
  document.getElementById('form-tratamiento')?.addEventListener('submit', saveTratamiento);

  // Event listeners for Medicamentos
  document.getElementById('newMedicamentoBtn')?.addEventListener('click', openNewMedicamentoModal);
  document.getElementById('close-modal-medicamento')?.addEventListener('click', closeMedicamentoModal);
  document.getElementById('cancel-medicamento')?.addEventListener('click', closeMedicamentoModal);
  document.getElementById('form-medicamento')?.addEventListener('submit', saveMedicamento);

  // Search and filter for medicamentos
  const searchMedicamentos = document.getElementById('searchMedicamentos');
  if (searchMedicamentos) {
    searchMedicamentos.addEventListener('input', renderMedicamentos);
  }

  const filterLowStockBtn = document.getElementById('filterLowStockBtn');
  if (filterLowStockBtn) {
    filterLowStockBtn.addEventListener('click', () => {
      showLowStockOnly = !showLowStockOnly;
      filterLowStockBtn.classList.toggle('bg-orange-100', showLowStockOnly);
      filterLowStockBtn.classList.toggle('dark:bg-orange-900/30', showLowStockOnly);
      filterLowStockBtn.classList.toggle('border-orange-500', showLowStockOnly);
      filterLowStockBtn.classList.toggle('dark:border-orange-400', showLowStockOnly);
      renderMedicamentos();
    });
  }

  // Category filters
  document.querySelectorAll('.categoria-btn').forEach(btn => {
    btn.addEventListener('click', () => filterByCategoria(btn.dataset.categoria));
  });

  // Event listeners for Miscelanea
  document.getElementById('newMiscelaneaBtn')?.addEventListener('click', openNewMiscelaneaModal);
  document.getElementById('close-modal-miscelanea')?.addEventListener('click', closeMiscelaneaModal);
  document.getElementById('cancel-miscelanea')?.addEventListener('click', closeMiscelaneaModal);
  document.getElementById('form-miscelanea')?.addEventListener('submit', saveMiscelanea);

  // Search and filter for miscelanea
  const searchMiscelanea = document.getElementById('searchMiscelanea');
  if (searchMiscelanea) {
    searchMiscelanea.addEventListener('input', renderMiscelanea);
  }

  const filterLowStockMiscelaneaBtn = document.getElementById('filterLowStockMiscelaneaBtn');
  if (filterLowStockMiscelaneaBtn) {
    filterLowStockMiscelaneaBtn.addEventListener('click', () => {
      showLowStockMiscelaneaOnly = !showLowStockMiscelaneaOnly;
      filterLowStockMiscelaneaBtn.classList.toggle('bg-orange-100', showLowStockMiscelaneaOnly);
      filterLowStockMiscelaneaBtn.classList.toggle('dark:bg-orange-900/30', showLowStockMiscelaneaOnly);
      filterLowStockMiscelaneaBtn.classList.toggle('border-orange-500', showLowStockMiscelaneaOnly);
      filterLowStockMiscelaneaBtn.classList.toggle('dark:border-orange-400', showLowStockMiscelaneaOnly);
      renderMiscelanea();
    });
  }

  // Category filters for miscelanea
  document.querySelectorAll('.categoria-misc-btn').forEach(btn => {
    btn.addEventListener('click', () => filterByCategoriaMisc(btn.dataset.categoriaMisc));
  });

  // Load initial data
  loadTratamientos();
  updateTratamientosStats();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
