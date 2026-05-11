// historial_tratamientos.js - Timeline de tratamientos y recetas del paciente

// Obtener parámetros de URL
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}

const pacienteId = getQueryParam('paciente_id');
let tratamientos = [];
let recetas = [];
let filtroEstado = '';
let vistaActual = 'tratamientos'; // 'tratamientos' o 'recetas'

// Helpers de base de datos
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve([]);
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
  });
}

function formatPeriodontoValue(value) {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPeriodontoRange(values, unit) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (nums.length === 0) return '';
  const min = nums[0];
  const max = nums[nums.length - 1];
  const minLabel = formatPeriodontoValue(min);
  const maxLabel = formatPeriodontoValue(max);
  if (min === max) return `${minLabel}${unit}`;
  return `${minLabel} a ${maxLabel}${unit}`;
}

function getPeriodontogramaDetalles(perTooth) {
  if (!perTooth || typeof perTooth !== 'object') return [];
  const entries = [];

  Object.entries(perTooth).forEach(([num, tooth]) => {
    if (!tooth || typeof tooth !== 'object') return;
    const psValues = [];
    const recValues = [];
    let hasBop = false;
    let hasPlaque = false;
    let hasSupp = false;

    if (tooth.sites && typeof tooth.sites === 'object') {
      Object.values(tooth.sites).forEach(site => {
        if (!site || typeof site !== 'object') return;
        if (site.ps !== '' && site.ps !== null && site.ps !== undefined) {
          const ps = Number(site.ps);
          if (Number.isFinite(ps)) psValues.push(ps);
        }
        if (site.rec !== '' && site.rec !== null && site.rec !== undefined) {
          const rec = Number(site.rec);
          if (Number.isFinite(rec)) recValues.push(rec);
        }
        if (site.bop) hasBop = true;
        if (site.plaque) hasPlaque = true;
        if (site.supp) hasSupp = true;
      });
    }

    const parts = [];
    const psRange = formatPeriodontoRange(psValues, ' mm');
    if (psRange) parts.push(`PS ${psRange}`);
    const recRange = formatPeriodontoRange(recValues, ' mm');
    if (recRange) parts.push(`REC ${recRange}`);
    if (hasBop) parts.push('BOP');
    if (hasPlaque) parts.push('Placa');
    if (hasSupp) parts.push('Supuración');

    const mobility = Number(tooth.mobility || 0);
    const furcation = Number(tooth.furcation || 0);
    if (mobility > 0) parts.push(`Movilidad ${formatPeriodontoValue(mobility)}`);
    if (furcation > 0) parts.push(`Furcación ${formatPeriodontoValue(furcation)}`);

    if (parts.length === 0) return;
    entries.push({ num, detail: parts.join(', ') });
  });

  entries.sort((a, b) => Number(a.num) - Number(b.num));
  return entries;
}

const FACE_LABELS = {
  oclusal: 'Oclusal',
  mesial: 'Mesial',
  distal: 'Distal',
  vestibular: 'Vestibular',
  lingual: 'Lingual',
  palatino: 'Palatino',
};

function formatDxNote(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('DX:')) return null;
  try {
    const data = JSON.parse(raw.slice(3));
    if (!data || typeof data !== 'object') return null;
    const parts = [];
    const faceLabel = FACE_LABELS[String(data.face || '').toLowerCase()];
    if (faceLabel) parts.push(`Cara: ${faceLabel}`);
    return parts.join(' · ');
  } catch (e) {
    return null;
  }
}

function summarizePeriodontograma(perTooth, maxTeeth = 6) {
  const entries = getPeriodontogramaDetalles(perTooth);
  if (entries.length === 0) return 'Periodontograma guardado (sin datos clínicos)';
  const total = entries.length;
  const suffix = total === 1 ? '' : 's';
  const slice = entries.slice(0, maxTeeth);
  const detail = slice.map(item => `Pieza ${item.num} (${item.detail})`).join(', ');
  const extra = total > maxTeeth ? ` y ${total - maxTeeth} más` : '';
  return `Periodontograma guardado (${total} pieza${suffix}): ${detail}${extra}`;
}

function formatTratamientoNotas(tratamiento) {
  if (!tratamiento) return '';
  if (tratamiento.tratamiento_descripcion) return tratamiento.tratamiento_descripcion;
  const raw = String(tratamiento.notas || '').trim();
  if (!raw) return '';
  const dxNote = formatDxNote(raw);
  if (dxNote) return dxNote;
  if (!raw.startsWith('{')) return raw;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return raw;
    if (data.perTooth && typeof data.perTooth === 'object') {
      return summarizePeriodontograma(data.perTooth);
    }
    return raw;
  } catch (e) {
    return raw;
  }
}

// Cargar tratamientos del paciente
async function loadTratamientos() {
  if (!pacienteId) return;

  try {
    // Cargar planes de tratamiento
    const planes = await dbAll(`
      SELECT 
        pt.*,
        tc.nombre as tratamiento_nombre,
        tc.categoria,
        tc.descripcion as tratamiento_descripcion
      FROM planes_tratamiento pt
      LEFT JOIN tratamientos_catalogo tc ON pt.catalogo_id = tc.id
      WHERE pt.paciente_id = ?
      ORDER BY pt.fecha_creacion DESC
    `, [pacienteId]);

    tratamientos = planes.map(plan => ({
      ...plan,
      tipo: 'plan',
      nombre: plan.tratamiento_nombre || 'Tratamiento',
      fecha: plan.fecha_inicio || plan.fecha_creacion
    }));

    // También cargar tratamientos antiguos de la tabla tratamientos
    const tratamientosAntiguos = await dbAll(`
      SELECT * FROM tratamientos
      WHERE paciente_id = ? AND (procedimiento NOT LIKE '%Receta%' OR procedimiento IS NULL)
      ORDER BY fecha DESC
    `, [pacienteId]);

    tratamientosAntiguos.forEach(t => {
      const isDiagnostico = String(t.registro_tipo || '').toLowerCase() === 'diagnostico';
      tratamientos.push({
        ...t,
        tipo: isDiagnostico ? 'diagnostico' : 'tratamiento',
        nombre: t.procedimiento,
        estado: isDiagnostico ? 'diagnostico' : 'completado',
        fecha: t.fecha
      });
    });

    // Ordenar por fecha
    tratamientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (vistaActual === 'tratamientos') {
      renderTratamientos();
      updateStats();
    }
  } catch (error) {
    console.error('Error cargando tratamientos:', error);
    tratamientos = [];
    renderTratamientos();
  }
}

// Cargar recetas del paciente
async function loadRecetas() {
  if (!pacienteId) return;

  try {
    // Cargar recetas de la tabla tratamientos (donde procedimiento contiene "Receta")
    const recetasDB = await dbAll(`
      SELECT * FROM tratamientos
      WHERE paciente_id = ? AND procedimiento LIKE '%Receta%'
      ORDER BY fecha DESC
    `, [pacienteId]);

    recetas = recetasDB.map(r => {
      let medicamentos = [];
      try {
        const notas = JSON.parse(r.notas || '{}');
        medicamentos = notas.medicamentos || [];
      } catch (e) {
        medicamentos = [];
      }

      return {
        ...r,
        tipo: 'receta',
        medicamentos: medicamentos,
        fecha: r.fecha
      };
    });

    if (vistaActual === 'recetas') {
      renderRecetas();
      updateStatsRecetas();
    }
  } catch (error) {
    console.error('Error cargando recetas:', error);
    recetas = [];
    renderRecetas();
  }
}

// Actualizar estadísticas de tratamientos
function updateStats() {
  const total = tratamientos.length;
  const completados = tratamientos.filter(t => t.estado === 'completado').length;
  const enProceso = tratamientos.filter(t => t.estado === 'en_proceso').length;
  const pendientes = tratamientos.filter(t => t.estado === 'pendiente').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-completados').textContent = completados;
  document.getElementById('stat-proceso').textContent = enProceso;
  document.getElementById('stat-pendientes').textContent = pendientes;
}

// Actualizar estadísticas de recetas
function updateStatsRecetas() {
  const total = recetas.length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-completados').textContent = total; // Todas completadas
  document.getElementById('stat-proceso').textContent = 0;
  document.getElementById('stat-pendientes').textContent = 0;
}

// Renderizar timeline de tratamientos
function renderTratamientos() {
  const container = document.getElementById('timeline-tratamientos');
  const emptyState = document.getElementById('empty-tratamientos');

  let filtered = tratamientos;
  if (filtroEstado) {
    filtered = tratamientos.filter(t => t.estado === filtroEstado);
  }

  if (filtered.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  const estadoConfig = {
    completado: {
      icon: '✓',
      bgClass: 'bg-green-100 dark:bg-green-900/50',
      textClass: 'text-green-700 dark:text-green-300',
      borderClass: 'border-green-500'
    },
    en_proceso: {
      icon: '⟳',
      bgClass: 'bg-blue-100 dark:bg-blue-900/50',
      textClass: 'text-blue-700 dark:text-blue-300',
      borderClass: 'border-blue-500'
    },
    pendiente: {
      icon: '○',
      bgClass: 'bg-orange-100 dark:bg-orange-900/50',
      textClass: 'text-orange-700 dark:text-orange-300',
      borderClass: 'border-orange-500'
    },
    diagnostico: {
      icon: 'DX',
      bgClass: 'bg-cyan-100 dark:bg-cyan-900/50',
      textClass: 'text-cyan-700 dark:text-cyan-300',
      borderClass: 'border-cyan-500'
    },
    cancelado: {
      icon: '✕',
      bgClass: 'bg-gray-100 dark:bg-gray-700',
      textClass: 'text-gray-600 dark:text-gray-400',
      borderClass: 'border-gray-400'
    }
  };

  container.innerHTML = filtered.map((tratamiento, index) => {
    const config = estadoConfig[tratamiento.estado] || estadoConfig.pendiente;
    const fecha = new Date(tratamiento.fecha);
    const fechaStr = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const notasTexto = formatTratamientoNotas(tratamiento);

    const estadoLabel = {
      completado: 'Completado',
      en_proceso: 'En Proceso',
      pendiente: 'Pendiente',
      diagnostico: 'Diagnóstico',
      cancelado: 'Cancelado'
    }[tratamiento.estado] || 'Sin estado';

    return `
      <div class="relative pl-8 pb-6 ${index < filtered.length - 1 ? 'border-l-2 border-gray-300 dark:border-gray-600' : ''}">
        <div class="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full ${config.borderClass} border-4 bg-white dark:bg-gray-800"></div>
        
        <div class="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-5 hover:shadow-lg transition">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span class="${config.bgClass} ${config.textClass} px-3 py-1 rounded-full text-xs font-bold">
                  ${config.icon} ${estadoLabel}
                </span>
                ${tratamiento.categoria ? `<span class="text-xs text-gray-500 dark:text-gray-400">${tratamiento.categoria}</span>` : ''}
              </div>
              <h3 class="text-lg font-bold text-[#1D5D69] dark:text-white mb-1">${tratamiento.nombre}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">${fechaStr}</p>
            </div>
            ${tratamiento.costo_total || tratamiento.costo ? `
              <div class="text-right">
                <p class="text-sm text-gray-500 dark:text-gray-400">Costo</p>
                <p class="text-lg font-bold text-[#1D5D69] dark:text-white">$${parseFloat(tratamiento.costo_total || tratamiento.costo).toFixed(2)}</p>
              </div>
            ` : ''}
          </div>
          
          ${notasTexto ? `
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
              ${notasTexto}
            </p>
          ` : ''}
          
          ${tratamiento.diente ? `
            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span class="font-medium">Diente:</span> ${tratamiento.diente}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar timeline de recetas
function renderRecetas() {
  const container = document.getElementById('timeline-recetas');
  const emptyState = document.getElementById('empty-recetas');

  if (recetas.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  container.innerHTML = recetas.map((receta, index) => {
    const fecha = new Date(receta.fecha);
    const fechaStr = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <div class="relative pl-8 pb-6 ${index < recetas.length - 1 ? 'border-l-2 border-gray-300 dark:border-gray-600' : ''}">
        <div class="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-purple-500 border-4 bg-white dark:bg-gray-800"></div>
        
        <div class="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-5 hover:shadow-lg transition">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span class="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Receta Médica
                </span>
              </div>
              <h3 class="text-lg font-bold text-[#1D5D69] dark:text-white mb-1">Prescripción Médica</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">${fechaStr}</p>
            </div>
            ${receta.costo ? `
              <div class="text-right">
                <p class="text-sm text-gray-500 dark:text-gray-400">Costo</p>
                <p class="text-lg font-bold text-[#1D5D69] dark:text-white">$${parseFloat(receta.costo).toFixed(2)}</p>
              </div>
            ` : ''}
          </div>
          
          ${receta.medicamentos && receta.medicamentos.length > 0 ? `
            <div class="mt-3 space-y-2">
              <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Medicamentos:</p>
              ${receta.medicamentos.map(med => `
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <p class="font-medium text-gray-900 dark:text-white">${med.nombre}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">${med.indicaciones}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Cambiar entre tabs
function switchTab(tab) {
  vistaActual = tab;

  // Actualizar estilos de tabs
  const tabs = document.querySelectorAll('.tab-historial');
  tabs.forEach(t => {
    if (t.id === `tab-${tab}`) {
      t.className = 'tab-historial px-6 py-3 font-semibold text-[#4EABBE] border-b-2 border-[#4EABBE] transition';
    } else {
      t.className = 'tab-historial px-6 py-3 font-semibold text-gray-500 dark:text-gray-400 border-b-2 border-transparent hover:text-[#4EABBE] transition';
    }
  });

  // Mostrar/ocultar contenido
  if (tab === 'tratamientos') {
    document.getElementById('content-tratamientos').classList.remove('hidden');
    document.getElementById('content-recetas').classList.add('hidden');
    loadTratamientos();
  } else {
    document.getElementById('content-tratamientos').classList.add('hidden');
    document.getElementById('content-recetas').classList.remove('hidden');
    loadRecetas();
  }
}

// Event listeners
document.getElementById('tab-tratamientos').addEventListener('click', () => switchTab('tratamientos'));
document.getElementById('tab-recetas').addEventListener('click', () => switchTab('recetas'));

document.getElementById('filter-estado').addEventListener('change', (e) => {
  filtroEstado = e.target.value;
  if (vistaActual === 'tratamientos') {
    renderTratamientos();
  }
});

// Cargar datos iniciales
loadTratamientos();
