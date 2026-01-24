// tratamientos.js
// Gestión de Planes de Tratamiento para el paciente
// Permite asignar tratamientos del catálogo y hacer seguimiento de su estado

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
let currentEditingPlanId = null;

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

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const resolvedDb = resolveDb();
      if (!resolvedDb) {
        return requestParentDb('db-get', sql, params)
          .then(row => resolve(row || null))
          .catch(reject);
      }
      if (resolvedDb.get && resolvedDb.get.length >= 3) {
        resolvedDb.get(sql, params, (err, row) => { if (err) return reject(err); resolve(row || null); });
      } else if (resolvedDb.get) {
        resolvedDb.get(sql, params).then(row => resolve(row || null)).catch(reject);
      } else {
        resolve(null);
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

// Cargar lista de tratamientos del catálogo
async function loadTratamientosCatalogo() {
  try {
    const tratamientos = await dbAll('SELECT id, nombre, descripcion, costo_base, costo_medicina_estandar, costo_miscelanea_estandar, activo FROM tratamientos_catalogo ORDER BY nombre ASC');

    const select = document.getElementById('select-tratamiento');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar tratamiento...</option>';

    if (tratamientos.length === 0) {
      select.innerHTML = '<option value="">No hay tratamientos en el catalogo</option>';
      return;
    }

    tratamientos.forEach(t => {
      const isActive = t.activo === 1 || t.activo === true || t.activo === '1';
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = isActive ? t.nombre : `${t.nombre} (inactivo)`;
      option.disabled = !isActive;
      option.dataset.descripcion = t.descripcion || '';
      option.dataset.costoBas = t.costo_base || 0;
      option.dataset.costoMedicina = t.costo_medicina_estandar || 0;
      option.dataset.costoMiscelanea = t.costo_miscelanea_estandar || 0;
      select.appendChild(option);
    });
  } catch (e) {
    console.error('Error cargando catalogo:', e);
    const select = document.getElementById('select-tratamiento');
    if (select) {
      select.innerHTML = '<option value="">Error cargando catalogo</option>';
    }
    showToast('Error cargando catalogo: ' + (e && e.message ? e.message : e), 'error');
  }
}

// Mostrar info del tratamiento seleccionado
async function onTratamientoSelected(e) {
  const catalogoId = e.target.value;
  const infoDiv = document.getElementById('tratamiento-info');

  if (!catalogoId) {
    infoDiv.classList.add('hidden');
    return;
  }

  try {
    const tratamiento = await dbGet('SELECT * FROM tratamientos_catalogo WHERE id = ?', [catalogoId]);
    if (!tratamiento) return;

    const costoBas = parseFloat(tratamiento.costo_base || 0);
    const costoMedicina = parseFloat(tratamiento.costo_medicina_estandar || 0);
    const costoMiscelanea = parseFloat(tratamiento.costo_miscelanea_estandar || 0);
    const total = costoBas + costoMedicina + costoMiscelanea;

    document.getElementById('info-descripcion').textContent = tratamiento.descripcion || '';
    document.getElementById('info-costo-base').textContent = `$${costoBas.toFixed(2)}`;
    document.getElementById('info-costo-medicina').textContent = `$${costoMedicina.toFixed(2)}`;
    document.getElementById('info-costo-miscelanea').textContent = `$${costoMiscelanea.toFixed(2)}`;
    document.getElementById('info-costo-total').textContent = `$${total.toFixed(2)}`;

    infoDiv.classList.remove('hidden');
  } catch (e) {
    console.error('Error cargando tratamiento:', e);
  }
}

// Cargar planes pendientes del paciente
async function loadPlanesPendientes() {
  try {
    const planes = await dbAll(`
      SELECT 
        p.id, p.catalogo_id, p.especialista_asignado, p.estado, p.fecha_inicio, p.costo_total, p.notas,
        t.nombre as tratamiento_nombre, t.descripcion as tratamiento_desc,
        t.categoria, t.costo_base, t.costo_medicina_estandar, t.costo_miscelanea_estandar,
        t.duracion_estimada
      FROM planes_tratamiento p
      JOIN tratamientos_catalogo t ON p.catalogo_id = t.id
      WHERE p.paciente_id = ? AND p.estado IN ('pendiente', 'en_progreso')
      ORDER BY p.fecha_inicio DESC, p.id DESC
    `, [currentPacienteId]);

    const listDiv = document.getElementById('planes-pendientes-list');
    if (!listDiv) return;

    if (planes.length === 0) {
      listDiv.innerHTML = `
        <div class="text-center py-12">
          <svg class="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-500 dark:text-gray-400">No hay planes de tratamiento pendientes</p>
        </div>
      `;
      return;
    }

    listDiv.innerHTML = planes.map(p => {
      const costoBase = parseFloat(p.costo_base || 0);
      const costoMedicina = parseFloat(p.costo_medicina_estandar || 0);
      const costoMiscelanea = parseFloat(p.costo_miscelanea_estandar || 0);
      const costoTotal = costoBase + costoMedicina + costoMiscelanea;

      return `
      <div class="bg-white dark:bg-[#0E1A25] border border-[#8BCFDD]/30 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-lg font-bold text-[#1D5D69] dark:text-white">${p.tratamiento_nombre}</h3>
              ${p.categoria ? `<span class="px-2 py-1 rounded-lg text-xs font-semibold bg-[#4EABBE]/20 text-[#1D5D69] dark:text-[#4EABBE]">${p.categoria}</span>` : ''}
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400">${p.tratamiento_desc || ''}</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${p.estado === 'pendiente'
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
        }">${p.estado === 'pendiente' ? 'Pendiente' : 'En Progreso'}</span>
        </div>
        
        <!-- Desglose de Costos -->
        <div class="bg-[#8BCFDD]/10 dark:bg-slate-800/30 rounded-xl p-4 border border-[#8BCFDD]/20 dark:border-slate-700">
          <p class="text-xs font-semibold uppercase tracking-[0.1em] text-[#1D5D69] dark:text-slate-400 mb-3">Desglose de Costos</p>
          <div class="grid grid-cols-3 gap-4 text-sm mb-3">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Base</p>
              <p class="font-mono font-semibold text-[#0F2532] dark:text-slate-100">$${costoBase.toFixed(2)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Medicina</p>
              <p class="font-mono font-semibold text-[#0F2532] dark:text-slate-100">$${costoMedicina.toFixed(2)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Miscelánea</p>
              <p class="font-mono font-semibold text-[#0F2532] dark:text-slate-100">$${costoMiscelanea.toFixed(2)}</p>
            </div>
          </div>
          <div class="pt-3 border-t border-[#8BCFDD]/20 dark:border-slate-700">
            <div class="flex justify-between items-center">
              <p class="text-sm font-semibold text-[#1D5D69] dark:text-slate-300">Total Estimado</p>
              <p class="text-xl font-bold text-[#4EABBE] dark:text-[#8BCFDD]">$${costoTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-xs font-semibold text-[#1D5D69] dark:text-slate-400">Especialista</p>
            <p class="text-[#0F2532] dark:text-slate-100">${p.especialista_asignado || 'Sin asignar'}</p>
          </div>
          <div>
            <p class="text-xs font-semibold text-[#1D5D69] dark:text-slate-400">Duración Estimada</p>
            <p class="text-[#0F2532] dark:text-slate-100">${p.duracion_estimada || 30} minutos</p>
          </div>
        </div>
        
        ${p.notas ? `
          <div class="bg-[#8BCFDD]/10 dark:bg-slate-800/30 rounded-lg p-3 border border-[#8BCFDD]/20 dark:border-slate-700">
            <p class="text-xs font-semibold text-[#1D5D69] dark:text-slate-400 mb-1">Notas del Plan</p>
            <p class="text-sm text-[#0F2532] dark:text-slate-200">${p.notas}</p>
          </div>
        ` : ''}
        
        <div class="flex justify-end gap-2 pt-3 border-t border-[#8BCFDD]/20 dark:border-slate-700">
          <button onclick="changeEstado(${p.id}, 'completado')" class="px-4 py-2 rounded-lg bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 text-sm font-semibold transition">
            ✓ Completar
          </button>
        </div>
      </div>
    `}).join('');
  } catch (e) {
    console.error('Error cargando planes:', e);
    showToast('Error cargando planes: ' + e.message, 'error');
  }
}

// Abrir modal para nuevo plan
function openNewPlanModal() {
  currentEditingPlanId = null;
  document.getElementById('plan-id').value = '';
  document.getElementById('form-plan').reset();
  document.getElementById('modal-plan-subtitle').textContent = 'Seleccionar';
  document.getElementById('tratamiento-info').classList.add('hidden');
  loadTratamientosCatalogo();
  document.getElementById('modal-plan').classList.remove('hidden');
}

// Editar plan existente
async function editPlan(planId) {
  try {
    const plan = await dbGet('SELECT * FROM planes_tratamiento WHERE id = ?', [planId]);
    if (!plan) return showToast('Plan no encontrado', 'error');

    currentEditingPlanId = planId;
    document.getElementById('plan-id').value = plan.id;
    document.getElementById('select-tratamiento').value = plan.catalogo_id;
    document.getElementById('select-especialista').value = plan.especialista_asignado || '';
    document.getElementById('plan-notas').value = plan.notas || '';
    document.getElementById('plan-fecha-inicio').value = plan.fecha_inicio || '';

    document.getElementById('modal-plan-subtitle').textContent = 'Editar';
    await onTratamientoSelected({ target: { value: plan.catalogo_id } });
    document.getElementById('modal-plan').classList.remove('hidden');
  } catch (e) {
    console.error('Error editando plan:', e);
    showToast('Error cargando plan: ' + e.message, 'error');
  }
}

// Cambiar estado del plan
async function changeEstado(planId, nuevoEstado) {
  if (nuevoEstado === 'completado' && !confirm('¿Marcar este plan como completado? Se moverá al historial.')) {
    return;
  }

  try {
    // Primero obtener los datos del plan
    const plan = await dbGet('SELECT * FROM planes_tratamiento WHERE id = ?', [planId]);
    if (!plan) return showToast('Plan no encontrado', 'error');

    if (nuevoEstado === 'completado') {
      // Crear registro en historial
      await dbRun(`
        INSERT INTO planes_tratamiento_historial 
        (plan_id, paciente_id, catalogo_id, especialista_ejecuto, costo_base, costo_medicina, costo_miscelanea, costo_total, fecha_ejecucion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [planId, plan.paciente_id, plan.catalogo_id, plan.especialista_asignado, plan.costo_total, 0, 0, plan.costo_total]);

      // Actualizar estado a completado
      await dbRun('UPDATE planes_tratamiento SET estado = ? WHERE id = ?', ['completado', planId]);
      showToast('Plan marcado como completado', 'success');
    } else {
      await dbRun('UPDATE planes_tratamiento SET estado = ? WHERE id = ?', [nuevoEstado, planId]);
      showToast('Estado del plan actualizado', 'success');
    }

    await loadPlanesPendientes();
  } catch (e) {
    console.error('Error cambiando estado:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

// Eliminar plan
async function deletePlan(planId) {
  if (!confirm('¿Estás seguro de eliminar este plan de tratamiento?')) return;

  try {
    await dbRun('DELETE FROM planes_tratamiento WHERE id = ?', [planId]);
    showToast('Plan eliminado exitosamente', 'success');
    await loadPlanesPendientes();
  } catch (e) {
    console.error('Error eliminando plan:', e);
    showToast('Error eliminando plan: ' + e.message, 'error');
  }
}

// Guardar plan
async function savePlan(e) {
  e.preventDefault();

  const form = e.target;
  const planId = document.getElementById('plan-id').value;
  const catalogoId = form.catalogo_id.value;
  const especialista = form.especialista_asignado.value;
  const notas = form.notas.value.trim();
  const fechaInicio = form.fecha_inicio.value;

  if (!catalogoId) {
    showToast('Debe seleccionar un tratamiento', 'error');
    return;
  }

  try {
    // Obtener costo total del catálogo
    const tratamiento = await dbGet('SELECT costo_base, costo_medicina_estandar, costo_miscelanea_estandar FROM tratamientos_catalogo WHERE id = ?', [catalogoId]);
    if (!tratamiento) return showToast('Tratamiento no válido', 'error');

    const costoTotal = (parseFloat(tratamiento.costo_base || 0) + parseFloat(tratamiento.costo_medicina_estandar || 0) + parseFloat(tratamiento.costo_miscelanea_estandar || 0));

    if (planId) {
      // Actualizar
      await dbRun(`
        UPDATE planes_tratamiento 
        SET catalogo_id = ?, especialista_asignado = ?, notas = ?, fecha_inicio = ?, costo_total = ?
        WHERE id = ?
      `, [catalogoId, especialista, notas, fechaInicio, costoTotal, planId]);
      showToast('Plan actualizado exitosamente', 'success');
    } else {
      // Crear nuevo
      await dbRun(`
        INSERT INTO planes_tratamiento 
        (paciente_id, catalogo_id, especialista_asignado, notas, fecha_inicio, costo_total, estado)
        VALUES (?, ?, ?, ?, ?, ?, 'pendiente')
      `, [currentPacienteId, catalogoId, especialista, notas, fechaInicio, costoTotal]);
      showToast('Plan creado exitosamente', 'success');
    }

    document.getElementById('modal-plan').classList.add('hidden');
    form.reset();
    await loadPlanesPendientes();
  } catch (e) {
    console.error('Error guardando plan:', e);
    showToast('Error: ' + e.message, 'error');
  }
}

// Cerrar modal
function closeModalPlan() {
  document.getElementById('modal-plan').classList.add('hidden');
  document.getElementById('form-plan').reset();
  currentEditingPlanId = null;
}

// Inicializar
async function init() {
  currentPacienteId = getQueryParam('id');
  if (!currentPacienteId) return;

  // Setup event listeners
  document.getElementById('add-plan-btn')?.addEventListener('click', openNewPlanModal);
  document.getElementById('close-modal-plan')?.addEventListener('click', closeModalPlan);
  document.getElementById('cancel-plan')?.addEventListener('click', closeModalPlan);
  document.getElementById('form-plan')?.addEventListener('submit', savePlan);
  document.getElementById('select-tratamiento')?.addEventListener('change', onTratamientoSelected);

  // Load initial data
  await loadPlanesPendientes();
}

// Make functions globally available
window.changeEstado = changeEstado;

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
