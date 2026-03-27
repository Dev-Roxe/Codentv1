// receta_medica.js - Módulo para generar y gestionar recetas médicas

// Obtener parámetros de URL
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.opener) {
    const openerApi = window.opener.api || (window.opener.parent && window.opener.parent.api);
    if (openerApi && openerApi.db) db = openerApi.db;
}
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
    db = window.parent.api.db;
}

const dbMessageTarget = (() => {
    if (window.opener && window.opener.parent && typeof window.opener.parent.postMessage === 'function') {
        return window.opener.parent;
    }
    if (window.opener && typeof window.opener.postMessage === 'function') {
        return window.opener;
    }
    if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
        return window.parent;
    }
    return null;
})();

let dbRequestSeq = 0;

function isTrustedMessageOrigin(event) {
    return !event?.origin || event.origin === 'null' || event.origin === 'file://' || event.origin === window.location.origin;
}

function dbBridge(type, sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!dbMessageTarget) {
            reject(new Error('DB no disponible'));
            return;
        }
        const requestId = `receta-medica-${Date.now()}-${dbRequestSeq++}`;
        const timeoutMs = 8000;
        let timeoutId = null;

        const handleMessage = (event) => {
            const data = event && event.data;
            if (event.source !== dbMessageTarget || !isTrustedMessageOrigin(event)) return;
            if (!data || data.type !== `${type}-response` || data.requestId !== requestId) return;
            window.removeEventListener('message', handleMessage);
            if (timeoutId) clearTimeout(timeoutId);
            if (data.error) {
                reject(new Error(data.error));
                return;
            }
            resolve(data.result);
        };

        window.addEventListener('message', handleMessage);
        dbMessageTarget.postMessage({ type, requestId, sql, params }, '*');
        timeoutId = setTimeout(() => {
            window.removeEventListener('message', handleMessage);
            reject(new Error('Tiempo de espera agotado'));
        }, timeoutMs);
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                dbBridge('db-get', sql, params).then(resolve).catch(reject);
                return;
            }
            if (db.get.length >= 3) {
                db.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            } else {
                db.get(sql, params).then(row => resolve(row)).catch(reject);
            }
        } catch (e) {
            reject(e);
        }
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                dbBridge('db-all', sql, params).then(resolve).catch(reject);
                return;
            }
            if (db.all.length >= 3) {
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            } else {
                db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
            }
        } catch (e) {
            reject(e);
        }
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                dbBridge('db-run', sql, params).then(resolve).catch(reject);
                return;
            }
            if (db.run.length >= 3) {
                db.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve(this);
                });
            } else {
                db.run(sql, params).then(res => resolve(res)).catch(reject);
            }
        } catch (e) {
            reject(e);
        }
    });
}

function getSessionUser() {
    try {
        return JSON.parse(localStorage.getItem('sesionActual')) || {};
    } catch (e) {
        return {};
    }
}

function getCurrentUserId() {
    const session = getSessionUser();
    return session.id || null;
}

async function getCajaAbiertaId() {
    const row = await dbGet(
        "SELECT id FROM cajas WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1"
    );
    return row ? row.id : null;
}

// Datos de la receta actual
let recetaData = {
    paciente: {},
    medicamentos: [],
    fecha: new Date().toLocaleDateString('es-MX'),
    folio: generateFolio()
};

// Generar folio único
function generateFolio() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `RX${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
}

// Cargar datos del paciente
async function loadPatientData(pacienteId) {
    if (!db && !dbMessageTarget) {
        console.warn('DB no disponible para cargar paciente');
        return;
    }
    try {
        const paciente = await dbGet(
            'SELECT * FROM pacientes WHERE id = ?',
            [pacienteId]
        );

        if (paciente) {
            recetaData.paciente = paciente;
            updatePatientInfo(paciente);
        }
    } catch (error) {
        console.error('Error cargando datos del paciente:', error);
    }
}

// Actualizar información del paciente en el DOM
function updatePatientInfo(paciente) {
    const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    let curpInfo = paciente.curp;
    let sexoInfo = paciente.sexo;

    if ((!curpInfo || !sexoInfo) && paciente.meta) {
        try {
            const meta = JSON.parse(paciente.meta);
            curpInfo = curpInfo || meta.curp || meta.rfc;
            sexoInfo = sexoInfo || meta.sexo;
        } catch (e) {
            console.error('Error parsing paciente meta', e);
        }
    }

    curpInfo = curpInfo || 'Sin información';
    sexoInfo = sexoInfo || 'Sin información';
    
    let dobDisplay = paciente.fecha_nacimiento || 'Sin información';
    if (paciente.fecha_nacimiento) {
        const parts = paciente.fecha_nacimiento.split('-');
        if (parts.length === 3) {
            dobDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
            const dobDate = new Date(paciente.fecha_nacimiento);
            const today = new Date();
            let age = today.getFullYear() - dobDate.getFullYear();
            const m = today.getMonth() - dobDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
            dobDisplay += ` (${age} años)`;
        }
    }

    const nombreCompleto = `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim().toUpperCase();

    setElemText('paciente-nombre', nombreCompleto);
    setElemText('paciente-fecha-nac', dobDisplay);
    setElemText('paciente-curp', curpInfo.toUpperCase());
    setElemText('paciente-sexo', sexoInfo.toUpperCase());
    setElemText('paciente-direccion', paciente.direccion || 'Sin información');
    setElemText('paciente-telefono', paciente.telefono || 'Sin información');
    setElemText('fecha-receta', recetaData.fecha);
    setElemText('folio-receta', recetaData.folio);
}

// Agregar medicamento a la receta
function addMedication(medicamento) {
    recetaData.medicamentos.push(medicamento);
    renderMedications();
}

async function computeRecetaCosto(medicamentos) {
    if (!Array.isArray(medicamentos) || medicamentos.length === 0) return 0;
    const ids = [...new Set(medicamentos.map(m => Number(m.medicamento_id)).filter(id => Number.isFinite(id)))];
    if (ids.length === 0) return 0;
    try {
        const placeholders = ids.map(() => '?').join(',');
        const rows = await dbAll(`SELECT id, precio FROM medicamentos WHERE id IN (${placeholders})`, ids);
        const priceById = new Map(rows.map(r => [Number(r.id), Number(r.precio || 0)]));
        return medicamentos.reduce((total, med) => {
            const id = Number(med.medicamento_id);
            if (!Number.isFinite(id)) return total;
            const qty = Number(med.cantidad || 1);
            if (!Number.isFinite(qty) || qty <= 0) return total;
            const price = priceById.get(id) || 0;
            return total + (price * qty);
        }, 0);
    } catch (error) {
        console.error('Error calculando costo de receta:', error);
        return 0;
    }
}

// Renderizar lista de medicamentos
function renderMedications() {
    const container = document.getElementById('medicamentos-lista');

    if (recetaData.medicamentos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl print:hidden">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-gray-500">No hay medicamentos en esta receta</p>
                <button onclick="openAddMedicationModal()" class="mt-4 px-6 py-2 bg-[#1B325F] text-white rounded-xl hover:bg-blue-800 transition">
                    Agregar Medicamento
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = recetaData.medicamentos.map((med, index) => {
        return `
            <div class="medication-item group relative text-[11px] mb-6">
                <div class="font-bold text-black uppercase mb-1">
                    ${index + 1}.- ${med.nombre} / ${med.presentacion || 'COMPRIMIDO'}
                </div>
                <div class="text-black uppercase leading-relaxed ml-4 max-w-[90%] font-medium">
                    TOMAR ${med.indicaciones}
                </div>
                <button onclick="removeMedication(${index})" class="absolute -right-4 top-0 text-red-500 hover:text-red-700 print:hidden opacity-0 group-hover:opacity-100 transition-opacity p-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

// Eliminar medicamento
function removeMedication(index) {
    recetaData.medicamentos.splice(index, 1);
    renderMedications();
}

async function loadMedicamentosSelect(selectEl) {
    if (!selectEl) return [];
    selectEl.disabled = true;
    selectEl.innerHTML = '<option value="">Cargando medicamentos...</option>';
    try {
        const meds = await dbAll('SELECT id, nombre, descripcion, stock FROM medicamentos ORDER BY nombre ASC');
        if (!meds.length) {
            selectEl.innerHTML = '<option value="">No hay medicamentos en inventario</option>';
            return [];
        }

        selectEl.innerHTML = '<option value="">Seleccionar medicamento...</option>';
        meds.forEach(m => {
            const opt = document.createElement('option');
            const stock = Number(m.stock || 0);
            const stockLabel = stock > 0 ? `Stock: ${stock}` : 'Sin stock';
            opt.value = m.id;
            opt.textContent = `${m.nombre} - ${stockLabel}`;
            opt.dataset.nombre = m.nombre || '';
            opt.dataset.stock = String(stock);
            opt.dataset.descripcion = m.descripcion || '';
            if (stock <= 0) {
                opt.disabled = true;
                opt.style.color = '#999';
            }
            selectEl.appendChild(opt);
        });
        selectEl.disabled = false;
        return meds;
    } catch (error) {
        console.error('Error cargando medicamentos:', error);
        selectEl.innerHTML = '<option value="">Error cargando medicamentos</option>';
        return [];
    }
}

// Modal para agregar medicamento
async function openAddMedicationModal(preFilledData = null) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 print:hidden';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-100 dark:border-gray-700">
            <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                <h3 class="text-xl font-bold">Agregar Medicamento</h3>
            </div>
            <form id="medicationForm" class="p-6 space-y-4">
                <div>
                    <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Medicamento *</label>
                    <select id="medSelect" required class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-primary outline-none"></select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Presentación</label>
                    <input type="text" id="medPresentacion" placeholder="Ej: Comprimido, Cápsula, Jarabe" class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-primary outline-none">
                </div>
                <div>
                    <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Indicaciones *</label>
                    <textarea id="medIndicaciones" required rows="3" placeholder="Ej: 1 comprimido cada 8 horas vía oral durante 7 días" class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-primary outline-none"></textarea>
                </div>
                <div class="flex gap-3 pt-4">
                    <button type="button" onclick="this.closest('.fixed').remove()" class="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-[#0F2532] dark:text-white font-medium transition">
                        Cancelar
                    </button>
                    <button type="submit" class="flex-1 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark font-semibold shadow-lg transition">
                        Agregar
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const selectEl = document.getElementById('medSelect');
    const presentacionInput = document.getElementById('medPresentacion');
    const indicacionesInput = document.getElementById('medIndicaciones');

    await loadMedicamentosSelect(selectEl);

    if (preFilledData) {
        if (selectEl && preFilledData.id) selectEl.value = preFilledData.id;
        if (presentacionInput) presentacionInput.value = preFilledData.descripcion || '';
        if (indicacionesInput) indicacionesInput.focus();
    }

    if (selectEl) {
        selectEl.addEventListener('change', () => {
            const selectedOption = selectEl.options[selectEl.selectedIndex];
            const descripcion = selectedOption ? selectedOption.dataset.descripcion : '';
            if (presentacionInput) {
                presentacionInput.value = descripcion || '';
            }
        });
    }

    document.getElementById('medicationForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectEl || !selectEl.value) {
            alert('Selecciona un medicamento');
            return;
        }
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const stock = parseInt(selectedOption.dataset.stock || '0', 10);
        if (stock <= 0) {
            alert('Este medicamento no tiene stock disponible');
            return;
        }
        const nombre = selectedOption.dataset.nombre || selectedOption.textContent.trim();
        const presentacion = (presentacionInput && presentacionInput.value.trim())
            || selectedOption.dataset.descripcion
            || 'Comprimido';
        const indicaciones = indicacionesInput ? indicacionesInput.value.trim() : '';
        if (!indicaciones) {
            alert('Ingresa las indicaciones');
            return;
        }
        const medicamento = {
            medicamento_id: Number(selectEl.value),
            nombre,
            presentacion,
            indicaciones
        };
        addMedication(medicamento);
        modal.remove();
    });
}

// Guardar receta en la base de datos
async function saveReceta() {
    if (!db) {
        alert('DB no disponible');
        return;
    }
    if (recetaData.medicamentos.length === 0) {
        alert('Debe agregar al menos un medicamento');
        return;
    }

    try {
        const cajaId = await getCajaAbiertaId();
        if (!cajaId) {
            alert('Debe abrir una caja para guardar la receta');
            return;
        }
        if (!recetaData.paciente || !recetaData.paciente.id) {
            alert('No se pudo obtener el paciente');
            return;
        }
        const costoReceta = await computeRecetaCosto(recetaData.medicamentos);
        const contenido = JSON.stringify({
            ...recetaData,
            costo_medicamentos: costoReceta
        });
        await dbRun(
            'INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)',
            [recetaData.paciente.id, null, 'Receta: Medica', costoReceta, contenido, new Date().toISOString()]
        );
        if (costoReceta > 0) {
            const usuarioId = getCurrentUserId();
            const nombrePaciente = recetaData.paciente
                ? `${recetaData.paciente.nombre || ''} ${recetaData.paciente.apellido || ''}`.trim()
                : '';
            const concepto = nombrePaciente ? `Receta medica - ${nombrePaciente}` : 'Receta medica';
            await dbRun(
                'INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)',
                [cajaId, 'ingreso', costoReceta, concepto, usuarioId]
            );
        }
        alert('Receta guardada exitosamente');
        if (window.opener && typeof window.opener.postMessage === 'function') {
            window.opener.postMessage({ type: 'receta-guardada', pacienteId: recetaData.paciente.id }, '*');
        }
    } catch (error) {
        console.error('Error guardando receta:', error);
        alert('Error al guardar la receta');
    }
}

async function loadSidebarMedicamentos() {
    const sidebarList = document.getElementById('sidebar-meds-lista');
    const searchInput = document.getElementById('sidebar-search');
    if (!sidebarList) return;

    try {
        const meds = await dbAll('SELECT id, nombre, descripcion, stock FROM medicamentos ORDER BY nombre ASC');
        if (!meds.length) {
            sidebarList.innerHTML = '<div class="text-center py-4 text-gray-400 text-dash text-sm">No hay medicamentos</div>';
            return;
        }

        let allMeds = meds;

        const renderList = (items) => {
            if (items.length === 0) {
                sidebarList.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Sin resultados</div>';
                return;
            }
            sidebarList.innerHTML = items.map(m => {
                const stock = Number(m.stock || 0);
                const isOutOfStock = stock <= 0;
                return `
                    <div class="sidebar-med-item p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition select-none ${isOutOfStock ? 'opacity-60' : ''}" 
                         data-id="${m.id}" data-nombre="${m.nombre}" data-descripcion="${m.descripcion || ''}" data-stock="${stock}">
                        <div class="flex justify-between items-start gap-2">
                            <span class="font-semibold text-sm text-[#0F2532] dark:text-white">${m.nombre}</span>
                            <span class="text-xs ${isOutOfStock ? 'text-red-500' : 'text-green-500'} flex-shrink-0">${isOutOfStock ? 'Sin stock' : `Stock: ${stock}`}</span>
                        </div>
                        ${m.descripcion ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">${m.descripcion}</p>` : ''}
                    </div>
                `;
            }).join('');

            sidebarList.querySelectorAll('.sidebar-med-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    const stock = parseInt(el.dataset.stock || '0', 10);
                    if (stock <= 0) {
                        alert('Este medicamento no tiene stock disponible');
                        return;
                    }
                    openAddMedicationModal({
                        id: id,
                        nombre: el.dataset.nombre,
                        descripcion: el.dataset.descripcion
                    });
                });
            });
        };

        renderList(allMeds);

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const filtered = allMeds.filter(m => 
                    m.nombre.toLowerCase().includes(term) || 
                    (m.descripcion && m.descripcion.toLowerCase().includes(term))
                );
                renderList(filtered);
            });
        }

    } catch (error) {
        console.error('Error cargando sidebar de medicamentos:', error);
        sidebarList.innerHTML = '<div class="text-center py-4 text-red-500 text-sm">Error cargando medicamentos</div>';
    }
}

async function loadClinicIdentity() {
    try {
        const rows = await dbAll("SELECT clave, valor FROM admin_config WHERE clave LIKE 'clinica_%'");
        if (!rows || rows.length === 0) return;
        const configMap = {};
        rows.forEach(r => { configMap[r.clave] = r.valor; });

        const setEl = (id, key, defaultVal) => {
            const el = document.getElementById(id);
            if (el) el.textContent = configMap[key] || defaultVal;
        };

        setEl('header-clinica-nombre', 'clinica_nombre', 'Corporativo Dental Codent');
        setEl('footer-clinica-nombre', 'clinica_nombre', 'Corporativo Dental Codent');

        setEl('header-titular-nombre', 'clinica_titular', 'Dra. EVA MARITZA SOSA TAPIA');
        setEl('footer-titular-nombre', 'clinica_titular', 'Dra. EVA MARITZA SOSA TAPIA');

        setEl('header-titular-especialidad', 'clinica_especialidad', 'Esp. General');
        setEl('footer-titular-especialidad', 'clinica_especialidad', 'General');

        setEl('header-titular-cedula', 'clinica_cedula', '6309167');
        setEl('footer-titular-cedula', 'clinica_cedula', '6309167');

        setEl('header-titular-rfc', 'clinica_rfc', 'SOTE53');

        setEl('footer-clinica-direccion', 'clinica_direccion', '3 entre avenida 5 y 7, Córdoba, Veracruz');
        setEl('footer-clinica-telefono', 'clinica_telefono', '+52 271 102 356');
    } catch (error) {
        console.error('Error cargando identidad clinica:', error);
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    const pacienteId = getQueryParam('paciente_id');

    if (pacienteId) {
        await loadPatientData(pacienteId);
    }
    
    await loadClinicIdentity();

    // Agregar botones de acción si no existen
    const printButton = document.querySelector('button[onclick="window.print()"]');
    if (printButton && !document.getElementById('saveRecetaBtn')) {
        const saveBtn = document.createElement('button');
        saveBtn.id = 'saveRecetaBtn';
        saveBtn.onclick = saveReceta;
        saveBtn.className = 'bg-[#1D5D69] text-white px-8 py-3 rounded-full font-bold hover:bg-[#4EABBE] transition-colors shadow-lg mr-4';
        saveBtn.innerHTML = `
            <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
            </svg>
            Guardar Receta
        `;
        printButton.parentElement.insertBefore(saveBtn, printButton);

        const addMedBtn = document.createElement('button');
        addMedBtn.onclick = openAddMedicationModal;
        addMedBtn.className = 'bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-primary-dark transition-colors shadow-lg mr-4';
        addMedBtn.innerHTML = `
            <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Agregar Medicamento
        `;
        printButton.parentElement.insertBefore(addMedBtn, saveBtn);
    }

    renderMedications();
    loadSidebarMedicamentos();
});

// Exponer funciones globalmente
window.openAddMedicationModal = openAddMedicationModal;
window.removeMedication = removeMedication;

