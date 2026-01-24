// pagos.js
// Gestión de pagos y recaudación del paciente

let db = (window.api && window.api.db) ? window.api.db : null;

function resolveDb() {
    if (db) return db;
    if (window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
        db = window.parent.api.db;
        return db;
    }
    return null;
}

let messageSeq = 0;

function requestParentDb(type, sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!window.parent || window.parent === window) {
            return reject(new Error('Parent window not available'));
        }

        const requestId = `db-${Date.now()}-${++messageSeq}`;
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', onMessage);
            reject(new Error('Parent DB request timeout'));
        }, 8000);

        function onMessage(event) {
            const data = event && event.data;
            if (!data || data.requestId !== requestId || data.type !== `${type}-response`) return;
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            window.removeEventListener('message', onMessage);
            if (data.error) {
                reject(new Error(data.error));
            } else {
                resolve(data.result);
            }
        }

        window.addEventListener('message', onMessage);
        window.parent.postMessage({ type, requestId, sql, params }, '*');
    });
}

let currentPacienteId = null;

// DB Helpers
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const resolvedDb = resolveDb();
            if (!resolvedDb) {
                return requestParentDb('db-all', sql, params)
                    .then(rows => resolve(rows || []))
                    .catch(reject);
            }
            if (resolvedDb.all && resolvedDb.all.length >= 3) {
                resolvedDb.all(sql, params, (err, rows) => { if (err) return reject(err); resolve(rows || []); });
            } else if (resolvedDb.all) {
                resolvedDb.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
            } else {
                resolve([]);
            }
        } catch (e) { reject(e); }
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        try {
            const resolvedDb = resolveDb();
            if (!resolvedDb) {
                return requestParentDb('db-run', sql, params)
                    .then(res => resolve(res))
                    .catch(reject);
            }
            if (resolvedDb.run && resolvedDb.run.length >= 3) {
                resolvedDb.run(sql, params, function (err) { if (err) return reject(err); resolve(this); });
            } else if (resolvedDb.run) {
                resolvedDb.run(sql, params).then(res => resolve(res)).catch(reject);
            } else {
                reject(new Error('DB methods not available'));
            }
        } catch (e) { reject(e); }
    });
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name);
    if (value !== null && value !== '') return value;
    if (window.parent && window.parent !== window) {
        const parentParams = new URLSearchParams(window.parent.location.search);
        const parentValue = parentParams.get(name);
        if (parentValue !== null && parentValue !== '') return parentValue;
    }
    return null;
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
    const rows = await dbAll("SELECT id FROM cajas WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
    return rows[0]?.id || null;
}

// Toast Notification
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

// Cargar resumen de pagos
async function loadResumenPagos() {
    try {
        // Total recaudado
        const pagosResult = await dbAll(
            'SELECT SUM(monto) as total, COUNT(*) as count FROM pagos WHERE paciente_id = ?',
            [currentPacienteId]
        );
        const totalRecaudado = pagosResult[0]?.total || 0;
        const totalPagosCount = pagosResult[0]?.count || 0;

        // Costo total de tratamientos
        const tratamientosResult = await dbAll(
            'SELECT SUM(costo_total) as total, COUNT(*) as count FROM planes_tratamiento WHERE paciente_id = ?',
            [currentPacienteId]
        );
        const tratamientosExtrasResult = await dbAll(
            'SELECT SUM(COALESCE(costo, 0)) as total, COUNT(*) as count FROM tratamientos WHERE paciente_id = ?',
            [currentPacienteId]
        );
        const costoTratamientos = (tratamientosResult[0]?.total || 0) + (tratamientosExtrasResult[0]?.total || 0);
        const tratamientosCount = (tratamientosResult[0]?.count || 0) + (tratamientosExtrasResult[0]?.count || 0);

        // Balance pendiente
        const balancePendiente = costoTratamientos - totalRecaudado;

        // Actualizar UI
        document.getElementById('total-recaudado').textContent = `$${totalRecaudado.toFixed(2)}`;
        document.getElementById('total-pagos-count').textContent = `${totalPagosCount} pago${totalPagosCount !== 1 ? 's' : ''} registrado${totalPagosCount !== 1 ? 's' : ''}`;

        document.getElementById('costo-tratamientos').textContent = `$${costoTratamientos.toFixed(2)}`;
        document.getElementById('tratamientos-count').textContent = `${tratamientosCount} tratamiento${tratamientosCount !== 1 ? 's' : ''}`;

        const balanceEl = document.getElementById('balance-pendiente');
        balanceEl.textContent = `$${Math.abs(balancePendiente).toFixed(2)}`;

        // Cambiar color si está pagado completamente
        if (balancePendiente <= 0 && costoTratamientos > 0) {
            balanceEl.parentElement.className = balanceEl.parentElement.className.replace(/amber/g, 'green');
            balanceEl.nextElementSibling.textContent = 'Pagado completamente';
        }
    } catch (e) {
        console.error('Error cargando resumen:', e);
        showToast('Error cargando resumen de pagos', 'error');
    }
}

// Cargar historial de pagos
async function loadPagosHistorial() {
    try {
        const pagos = await dbAll(`
      SELECT 
        p.id, p.monto, p.fecha, p.descripcion, p.metodo, p.plan_tratamiento_id,
        t.nombre as tratamiento_nombre
      FROM pagos p
      LEFT JOIN planes_tratamiento pt ON p.plan_tratamiento_id = pt.id
      LEFT JOIN tratamientos_catalogo t ON pt.catalogo_id = t.id
      WHERE p.paciente_id = ?
      ORDER BY p.fecha DESC
    `, [currentPacienteId]);

        const listDiv = document.getElementById('pagos-list');
        if (!listDiv) return;

        if (pagos.length === 0) {
            listDiv.innerHTML = `
        <div class="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <svg class="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p class="text-gray-500 dark:text-gray-400">No hay pagos registrados</p>
        </div>
      `;
            return;
        }

        listDiv.innerHTML = pagos.map(pago => {
            const fecha = new Date(pago.fecha);
            const fechaStr = fecha.toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const metodoIcons = {
                'Efectivo': '💵',
                'Tarjeta': '💳',
                'Transferencia': '🏦',
                'Cheque': '📝',
                'Otro': '💰'
            };

            return `
        <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition">
          <div class="flex justify-between items-start mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-2xl">${metodoIcons[pago.metodo] || '💰'}</span>
                <div>
                  <p class="font-bold text-lg text-[#1D5D69] dark:text-[#4EABBE]">$${parseFloat(pago.monto).toFixed(2)}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${fechaStr}</p>
                </div>
              </div>
              ${pago.descripcion ? `<p class="text-sm text-gray-600 dark:text-gray-300 mt-2">${pago.descripcion}</p>` : ''}
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#4EABBE]/20 text-[#1D5D69] dark:text-[#4EABBE]">
                ${pago.metodo}
              </span>
              ${pago.tratamiento_nombre ? `
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <span class="font-semibold">Tratamiento:</span><br/>
                  ${pago.tratamiento_nombre}
                </p>
              ` : ''}
            </div>
          </div>
        </div>
      `;
        }).join('');
    } catch (e) {
        console.error('Error cargando historial:', e);
        listDiv.innerHTML = '<p class="text-red-500">Error cargando historial de pagos</p>';
    }
}

// Cargar planes de tratamiento para el selector
async function loadPlanesTratamiento() {
    try {
        const planes = await dbAll(`
      SELECT 
        p.id, 
        t.nombre as tratamiento_nombre,
        p.estado,
        p.costo_total
      FROM planes_tratamiento p
      JOIN tratamientos_catalogo t ON p.catalogo_id = t.id
      WHERE p.paciente_id = ? AND p.estado IN ('pendiente', 'en_progreso', 'completado')
      ORDER BY p.fecha_inicio DESC
    `, [currentPacienteId]);

        const select = document.getElementById('pago-plan');
        if (!select) return;

        select.innerHTML = '<option value="">Sin asociar</option>';

        planes.forEach(plan => {
            const option = document.createElement('option');
            option.value = plan.id;
            option.textContent = `${plan.tratamiento_nombre} - $${parseFloat(plan.costo_total).toFixed(2)} (${plan.estado})`;
            select.appendChild(option);
        });
    } catch (e) {
        console.error('Error cargando planes:', e);
    }
}

// Abrir modal de nuevo pago
function openNuevoPagoModal() {
    document.getElementById('form-pago').reset();
    loadPlanesTratamiento();
    document.getElementById('modal-pago').classList.remove('hidden');
}

// Cerrar modal
function closeModalPago() {
    document.getElementById('modal-pago').classList.add('hidden');
    document.getElementById('form-pago').reset();
}

// Guardar nuevo pago
async function savePago(e) {
    e.preventDefault();

    const form = e.target;
    const monto = parseFloat(form.monto.value);
    const metodo = form.metodo.value;
    const descripcion = form.descripcion.value.trim();
    const planId = form.plan_tratamiento_id.value || null;

    if (!monto || monto <= 0) {
        showToast('El monto debe ser mayor a 0', 'error');
        return;
    }

    if (!metodo) {
        showToast('Debe seleccionar un método de pago', 'error');
        return;
    }

    try {
        const cajaId = await getCajaAbiertaId();
        if (!cajaId) {
            showToast('Debe abrir una caja para registrar el pago', 'error');
            return;
        }
        await dbRun(
            'INSERT INTO pagos (paciente_id, monto, metodo, descripcion, plan_tratamiento_id, fecha) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [currentPacienteId, monto, metodo, descripcion, planId]
        );
        const usuarioId = getCurrentUserId();
        const concepto = descripcion ? `Pago: ${descripcion}` : `Pago paciente #${currentPacienteId}`;
        await dbRun(
            'INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)',
            [cajaId, 'ingreso', monto, concepto, usuarioId]
        );

        showToast('Pago registrado exitosamente', 'success');
        closeModalPago();
        await loadResumenPagos();
        await loadPagosHistorial();
    } catch (e) {
        console.error('Error guardando pago:', e);
        showToast('Error al guardar el pago: ' + e.message, 'error');
    }
}

// Inicializar
async function init() {
    currentPacienteId = getQueryParam('id');
    if (!currentPacienteId) {
        console.error('No se encontró el ID del paciente');
        return;
    }

    // Setup event listeners
    document.getElementById('btn-nuevo-pago')?.addEventListener('click', openNuevoPagoModal);
    document.getElementById('close-modal-pago')?.addEventListener('click', closeModalPago);
    document.getElementById('cancel-pago')?.addEventListener('click', closeModalPago);
    document.getElementById('form-pago')?.addEventListener('submit', savePago);

    // Load initial data
    await loadResumenPagos();
    await loadPagosHistorial();
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
