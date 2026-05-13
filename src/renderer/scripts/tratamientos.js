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

function resolveApi() {
  if (window.api) return window.api;
  if (window.parent && window.parent !== window && window.parent.api) {
    return window.parent.api;
  }
  return null;
}

function getFinanceApi() {
  return resolveApi()?.finance || null;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDateDisplay(value) {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTimeDisplay(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInstallmentBadge(item = {}) {
  const scheduled = roundMoney(item.monto_programado || 0);
  const paid = roundMoney(item.monto_pagado || 0);
  const pending = roundMoney(item.saldo_pendiente != null ? item.saldo_pendiente : (scheduled - paid));
  const dueDate = String(item.fecha_vencimiento || '').slice(0, 10);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const overdue = pending > 0 && !!dueDate && dueDate < todayKey;

  if (pending <= 0.01 || paid >= scheduled) {
    return { label: 'Pagada', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' };
  }
  if (overdue) {
    return { label: 'Vencida', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' };
  }
  if (paid > 0) {
    return { label: 'Parcial', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' };
  }
  return { label: 'Pendiente', className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
}

function renderCommercialVersionHistory(plan) {
  const reasonWrapper = document.getElementById('plan-version-reason-wrapper');
  const reasonInput = document.getElementById('plan-version-reason');
  const versionsWrapper = document.getElementById('plan-versiones-wrapper');
  const versionsList = document.getElementById('plan-versiones-list');
  const versionsEmpty = document.getElementById('plan-versiones-empty');
  const versionBadge = document.getElementById('plan-version-actual-badge');

  if (!reasonWrapper || !reasonInput || !versionsWrapper || !versionsList || !versionsEmpty || !versionBadge) return;

  const isEdit = !!plan?.id;
  reasonWrapper.classList.toggle('hidden', !isEdit);
  reasonInput.value = '';

  if (!isEdit) {
    versionsWrapper.classList.add('hidden');
    versionsList.innerHTML = '';
    versionsEmpty.classList.add('hidden');
    versionBadge.textContent = 'v1';
    return;
  }

  const currentVersion = Math.max(1, Number(plan.version_comercial || 1));
  versionBadge.textContent = `v${currentVersion}`;
  versionsWrapper.classList.remove('hidden');

  const versions = Array.isArray(plan.commercial_versions) ? plan.commercial_versions : [];
  if (!versions.length) {
    versionsList.innerHTML = '';
    versionsEmpty.classList.remove('hidden');
    return;
  }

  versionsEmpty.classList.add('hidden');
  versionsList.innerHTML = versions.map(version => {
    const versionNum = Math.max(1, Number(version.version_num || 1));
    const total = formatCurrency(version.total_final || 0);
    const user = escapeHtml(version.usuario_nombre || 'Sistema');
    const reason = escapeHtml(version.motivo_cambio || '-');
    const rowClass = versionNum === currentVersion
      ? 'bg-[#8BCFDD]/10 dark:bg-slate-800/70'
      : '';

    return `
      <tr class="border-t border-[#8BCFDD]/20 dark:border-slate-700 ${rowClass}">
        <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100 font-semibold">v${versionNum}</td>
        <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100">${escapeHtml(formatDateTimeDisplay(version.fecha_creacion))}</td>
        <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100">${user}</td>
        <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100">${reason}</td>
        <td class="py-2 text-emerald-600 dark:text-emerald-400 font-semibold">${total}</td>
      </tr>
    `;
  }).join('');
}

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('sesionActual')) || {};
  } catch (e) {
    return {};
  }
}

function getCurrentUserId() {
  return getSessionUser().id || null;
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
      const trustedOrigin = !event?.origin || event.origin === 'null' || event.origin === 'file://' || event.origin === window.location.origin;
      if (event.source !== window.parent || !trustedOrigin) return;
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
let planSchemaColumns = null;

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

const FACE_LABELS = window.OdontoRender?.FACE_LABELS || {
  oclusal: 'Oclusal',
  mesial: 'Mesial',
  distal: 'Distal',
  vestibular: 'Vestibular',
  lingual: 'Lingual',
};

const VALID_PLAN_FACES = Object.keys(FACE_LABELS);

const DIAGNOSIS_LOOKUP = {
  // Preexistencias
  'crown-ok': { id: 'crown-ok', name: 'Corona', cssClass: 'tooth-crown-ok', color: '#3b82f6', status: 'Realizado', target: 'tooth' },
  'provisional-ok': { id: 'provisional-ok', name: 'Corona provisoria', cssClass: 'tooth-provisional-ok', color: '#60a5fa', status: 'Realizado', target: 'tooth' },
  'endo': { id: 'endo', name: 'Endodoncia', cssClass: 'state-endo', color: '#a855f7', status: 'Realizado', target: 'whole' },
  'rest-ok': { id: 'rest-ok', name: 'Restauración', cssClass: 'state-rest-ok', color: '#3b82f6', status: 'Realizado', target: 'face' },
  'implante': { id: 'implante', name: 'Implante', cssClass: 'state-implante', color: '#059669', status: 'Realizado', target: 'whole' },
  'perno': { id: 'perno', name: 'Perno muñón', cssClass: 'state-perno', color: '#0f172a', status: 'Realizado', target: 'whole' },
  'removible-ok': { id: 'removible-ok', name: 'Prótesis removible', cssClass: 'state-removible-ok', color: '#14b8a6', status: 'Realizado', target: 'tooth' },
  'amalgam': { id: 'amalgam', name: 'Amalgama', cssClass: 'state-amalgam', color: '#64748b', status: 'Realizado', target: 'face' },
  'sealant': { id: 'sealant', name: 'Sellante', cssClass: 'state-sealant', color: '#facc15', status: 'Realizado', target: 'face' },
  'puente-ok': { id: 'puente-ok', name: 'Puente dental', cssClass: 'state-puente-ok', color: '#8b5cf6', status: 'Realizado', target: 'tooth' },
  'carilla-ok': { id: 'carilla-ok', name: 'Carilla dental', cssClass: 'state-carilla-ok', color: '#ec4899', status: 'Realizado', target: 'tooth' },
  'ortodoncia': { id: 'ortodoncia', name: 'Ortodoncia', cssClass: 'state-ortodoncia', color: '#6366f1', status: 'Realizado', target: 'tooth' },
  'brackets': { id: 'brackets', name: 'Brackets', cssClass: 'state-brackets', color: '#3b82f6', status: 'Realizado', target: 'tooth' },
  'otro-pre': { id: 'otro-pre', name: 'Otro', cssClass: 'state-otro-pre', color: '#9ca3af', status: 'Realizado', target: 'tooth' },

  // Preexistencias (mal estado)
  'crown-bad': { id: 'crown-bad', name: 'Corona (mal estado)', cssClass: 'tooth-crown-bad', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'provisional-bad': { id: 'provisional-bad', name: 'Corona provisoria (mal estado)', cssClass: 'tooth-provisional-bad', color: '#f87171', status: 'Pendiente', target: 'tooth' },
  'rest-bad': { id: 'rest-bad', name: 'Restauración (mal estado)', cssClass: 'state-rest-bad', color: '#f97316', status: 'Pendiente', target: 'face' },
  'implante-bad': { id: 'implante-bad', name: 'Implante (mal estado)', cssClass: 'state-implante-bad', color: '#ef4444', status: 'Pendiente', target: 'whole' },
  'perno-bad': { id: 'perno-bad', name: 'Perno muñón (mal estado)', cssClass: 'state-perno-bad', color: '#ef4444', status: 'Pendiente', target: 'whole' },
  'amalgam-bad': { id: 'amalgam-bad', name: 'Amalgama (mal estado)', cssClass: 'state-amalgam-bad', color: '#f97316', status: 'Pendiente', target: 'face' },
  'endo-bad': { id: 'endo-bad', name: 'Endodoncia (mal estado)', cssClass: 'state-endo-bad', color: '#ef4444', status: 'Pendiente', target: 'whole' },
  'removible-bad': { id: 'removible-bad', name: 'Prótesis removible (mal estado)', cssClass: 'state-removible-bad', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'puente-bad': { id: 'puente-bad', name: 'Puente dental (mal estado)', cssClass: 'state-puente-bad', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'carilla-bad': { id: 'carilla-bad', name: 'Carilla dental (mal estado)', cssClass: 'state-carilla-bad', color: '#ef4444', status: 'Pendiente', target: 'tooth' },

  // Lesiones
  'caries-dx': { id: 'caries-dx', name: 'Caries', cssClass: 'state-caries', color: '#ef4444', status: 'Pendiente', target: 'face' },
  'pulpar': { id: 'pulpar', name: 'Infección pulpar', cssClass: 'state-pulpar', color: '#f87171', status: 'Pendiente', target: 'whole' },
  'fractura': { id: 'fractura', name: 'Fractura', cssClass: 'state-fractura', color: '#f59e0b', status: 'Pendiente', target: 'whole' },
  'movilidad': { id: 'movilidad', name: 'Movilidad', cssClass: 'state-mov', color: '#0ea5e9', status: 'Pendiente', target: 'whole' },
  'resto': { id: 'resto', name: 'Residuo radicular', cssClass: 'state-resto', color: '#0f172a', status: 'Pendiente', target: 'whole' },
  'erosion': { id: 'erosion', name: 'Erosión', cssClass: 'state-erosion', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'atricion': { id: 'atricion', name: 'Atrición', cssClass: 'state-atricion', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'abfraccion': { id: 'abfraccion', name: 'Abfracción', cssClass: 'state-abfraccion', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'recesion': { id: 'recesion', name: 'Recesión gingival', cssClass: 'state-recesion', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'bolsa': { id: 'bolsa', name: 'Bolsa periodontal', cssClass: 'state-bolsa', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'sangrado': { id: 'sangrado', name: 'Sangrado gingival', cssClass: 'state-sangrado', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'calculo': { id: 'calculo', name: 'Cálculo dental', cssClass: 'state-calculo', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'gingivitis': { id: 'gingivitis', name: 'Gingivitis', cssClass: 'state-gingivitis', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'necrosis': { id: 'necrosis', name: 'Necrosis pulpar', cssClass: 'state-necrosis', color: '#0f172a', status: 'Pendiente', target: 'tooth' },
  'fistula': { id: 'fistula', name: 'Fístula', cssClass: 'state-fistula', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'absceso': { id: 'absceso', name: 'Absceso', cssClass: 'state-absceso', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'hipoplasia': { id: 'hipoplasia', name: 'Hipoplasia', cssClass: 'state-hipoplasia', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'desgaste': { id: 'desgaste', name: 'Desgaste dental', cssClass: 'state-desgaste', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'pigmentacion': { id: 'pigmentacion', name: 'Pigmentación', cssClass: 'state-pigmentacion', color: '#0ea5e9', status: 'Pendiente', target: 'tooth' },
  'sensibilidad': { id: 'sensibilidad', name: 'Sensibilidad dental', cssClass: 'state-sensibilidad', color: '#3b82f6', status: 'Pendiente', target: 'tooth' },
  'otro-lesion': { id: 'otro-lesion', name: 'Otro', cssClass: 'state-otro-lesion', color: '#9ca3af', status: 'Pendiente', target: 'tooth' },

  // Otras simbologías
  'sano': { id: 'sano', name: 'Diente sano', cssClass: 'clean', color: '#10b981', status: 'Realizado', target: 'face' },
  'sano-plus': { id: 'sano-plus', name: 'Diente sano+', cssClass: 'clean-plus', color: '#059669', status: 'Realizado', target: 'tooth' },
  'erupcion': { id: 'erupcion', name: 'Sin erupcionar', cssClass: 'state-erup', color: '#cbd5e1', status: 'Pendiente', target: 'whole' },
  'absent': { id: 'absent', name: 'Ausente', cssClass: 'tooth-absent', color: '#6b7280', status: 'Pendiente', target: 'tooth' },
  'supernumerario': { id: 'supernumerario', name: 'Supernumerario', cssClass: 'state-supernumerario', color: '#3b82f6', status: 'Pendiente', target: 'tooth' },
  'retenido': { id: 'retenido', name: 'Retenido', cssClass: 'state-retenido', color: '#f59e0b', status: 'Pendiente', target: 'tooth' },
  'impactado': { id: 'impactado', name: 'Impactado', cssClass: 'state-impactado', color: '#ef4444', status: 'Pendiente', target: 'tooth' },
  'temporal': { id: 'temporal', name: 'Diente temporal', cssClass: 'state-temporal', color: '#3b82f6', status: 'Pendiente', target: 'tooth' },
  'permanente': { id: 'permanente', name: 'Diente permanente', cssClass: 'state-permanente', color: '#10b981', status: 'Pendiente', target: 'tooth' },
  'extrusion': { id: 'extrusion', name: 'Extrusión', cssClass: 'state-extrusion', color: '#8b5cf6', status: 'Pendiente', target: 'tooth' },
  'intrusion': { id: 'intrusion', name: 'Intrusión', cssClass: 'state-intrusion', color: '#8b5cf6', status: 'Pendiente', target: 'tooth' },
  'giroversion': { id: 'giroversion', name: 'Giroversión', cssClass: 'state-giroversion', color: '#8b5cf6', status: 'Pendiente', target: 'tooth' },
  'diastema': { id: 'diastema', name: 'Diastema', cssClass: 'state-diastema', color: '#8b5cf6', status: 'Pendiente', target: 'tooth' }
};

const SURFACE_DX_IDS = new Set(['caries-dx', 'rest-ok', 'rest-bad', 'sealant', 'amalgam']);
const WHOLE_TOOTH_TREATMENT_IDS = new Set(['corona', 'implante', 'perno', 'endodoncia', 'fractura', 'pulpar', 'ausente']);
const PLAN_TREATMENT_VISUALS = {
  caries: { id: 'caries', name: 'Caries', color: '#EF4444' },
  restauracion: { id: 'restauracion', name: 'Restauracion', color: '#10B981' },
  endodoncia: { id: 'endodoncia', name: 'Endodoncia', color: '#A855F7' },
  ausente: { id: 'ausente', name: 'Ausente', color: '#6B7280' },
  corona: { id: 'corona', name: 'Corona', color: '#FBBF24' },
  implante: { id: 'implante', name: 'Implante', color: '#059669' },
  perno: { id: 'perno', name: 'Perno Munon', color: '#0F172A' },
  fractura: { id: 'fractura', name: 'Fractura', color: '#F59E0B' },
  pulpar: { id: 'pulpar', name: 'Infeccion Pulpar', color: '#F87171' },
};

let toothImages = {};
let showAdultTeeth = true;

function calculateAgeYears(dateStr) {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years;
}

function faceLabel(faceId) {
  return FACE_LABELS[faceId] || faceId || 'Cara';
}

function findDiagnosisSpec(id) {
  return DIAGNOSIS_LOOKUP[id] || null;
}

function findPlanVisualSpec(id) {
  return DIAGNOSIS_LOOKUP[id] || PLAN_TREATMENT_VISUALS[id] || null;
}

function normalizePlanFace(face) {
  const value = String(face || '').trim().toLowerCase();
  return VALID_PLAN_FACES.includes(value) ? value : null;
}

function parsePlanFaces(raw) {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(normalizePlanFace).filter(Boolean))];
  }

  const text = String(raw || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsePlanFaces(parsed);
  } catch (e) {
  }

  return [...new Set(text.split(',').map(normalizePlanFace).filter(Boolean))];
}

function serializePlanFaces(faces) {
  const normalized = parsePlanFaces(faces);
  return normalized.length ? JSON.stringify(normalized) : '';
}

function getDiagnosisPriority(dxId) {
  const priorityMap = {
    absent: 100,
    pulpar: 95,
    fractura: 92,
    'rest-bad': 88,
    'caries-dx': 85,
    movilidad: 82,
    resto: 80,
    'crown-bad': 72,
    erupcion: 60,
    endo: 54,
    implante: 52,
    perno: 50,
    'rest-ok': 45,
    amalgam: 44,
    sealant: 40,
    'crown-ok': 38,
    sano: 10,
  };

  return priorityMap[dxId] || 20;
}

function getToothDiagnostics(toothNumber) {
  const state = odontoData?.diagnosticsState?.[toothNumber];
  if (!state) return [];

  const entries = [];

  if (state.tooth?.id) {
    const dx = findDiagnosisSpec(state.tooth.id) || state.tooth;
    entries.push({
      key: 'tooth',
      id: dx.id,
      name: dx.name,
      cssClass: dx.cssClass,
      status: dx.status || state.tooth.status || '',
      color: dx.color || '#4EABBE',
      target: 'tooth',
      face: null,
      priority: getDiagnosisPriority(dx.id),
    });
  }

  Object.entries(state.faces || {}).forEach(([face, rawDx]) => {
    if (!rawDx?.id) return;
    const dx = findDiagnosisSpec(rawDx.id) || rawDx;
    entries.push({
      key: face,
      id: dx.id,
      name: rawDx.name || dx.name,
      cssClass: rawDx.cssClass || dx.cssClass,
      status: rawDx.status || dx.status || '',
      color: rawDx.color || dx.color || '#4EABBE',
      target: 'face',
      face,
      priority: getDiagnosisPriority(dx.id),
    });
  });

  return entries.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

function getDiagnosisSummaryTitle(toothNumber) {
  const entries = getToothDiagnostics(toothNumber);
  if (!entries.length) return `Pieza ${toothNumber}`;

  const detail = entries
    .map(entry => entry.target === 'tooth' ? `Pieza: ${entry.name}` : `${faceLabel(entry.face)}: ${entry.name}`)
    .join(' | ');

  return `Pieza ${toothNumber} | ${detail}`;
}

function buildDxStyle(color) {
  return `--dx-color:${color || BRAND.primary}; --dx-glow:${hexToRgba(color || BRAND.primary, 0.34)};`;
}

function compactVisualLabel(name) {
  const plain = String(name || '').toLowerCase();
  if (!plain) return '';
  if (plain.includes('corona') && plain.includes('mal')) return 'Corona mal';
  if (plain.includes('corona')) return 'Corona';
  if (plain.includes('implante')) return 'Implante';
  if (plain.includes('perno')) return 'Perno';
  if (plain.includes('endodon')) return 'Endodoncia';
  if (plain.includes('caries')) return 'Caries';
  if (plain.includes('restaur') && plain.includes('mal')) return 'Rest. mal';
  if (plain.includes('restaur')) return 'Restauracion';
  if (plain.includes('fractura')) return 'Fractura';
  if (plain.includes('pulpar')) return 'Pulpar';
  if (plain.includes('ausent')) return 'Ausente';
  if (plain.includes('radicular')) return 'Resto rad.';
  if (plain.includes('movilidad')) return 'Movilidad';
  if (plain.includes('erup')) return 'No erup.';
  return name;
}

function getPlanTreatmentVisual(treatmentId, color) {
  if (!treatmentId && !color) return null;
  const base = PLAN_TREATMENT_VISUALS[treatmentId] || {};
  return {
    id: treatmentId || base.id || '',
    name: base.name || treatmentId || '',
    color: color || base.color || BRAND.primary,
  };
}

function getToothQuickTag(toothNumber) {
  const entries = getToothDiagnostics(toothNumber);
  const primaryEntry = entries[0] || null;
  const status = odontoData?.teethStatus?.[toothNumber] || null;

  if (primaryEntry) {
    return {
      text: compactVisualLabel(primaryEntry.name),
      color: primaryEntry.color || BRAND.primary,
    };
  }

  if (status?.color) {
    const treatment = getPlanTreatmentVisual(status.treatment, status.color);
    return {
      text: compactVisualLabel(treatment?.name || 'Tratado'),
      color: treatment?.color || status.color,
    };
  }

  return null;
}

function renderToothQuickTag(toothNumber) {
  const tag = getToothQuickTag(toothNumber);
  if (!tag) return '<div class="tooth-quick-tag-slot"></div>';

  return `
    <div class="tooth-quick-tag-slot">
      <span class="tooth-quick-tag" style="${buildDxStyle(tag.color)}">${escapeHtml(tag.text)}</span>
    </div>
  `;
}

function renderToothDxHud(toothNumber, isUpper) {
  const entries = getToothDiagnostics(toothNumber);
  if (!entries.length) return '';

  const popoverClass = isUpper ? 'tooth-dx-popover-top' : 'tooth-dx-popover-bottom';
  const rows = entries.map(entry => `
    <div class="tooth-dx-item">
      <span class="tooth-dx-chip" style="${buildDxStyle(entry.color)}">${escapeHtml(entry.target === 'tooth' ? 'Pieza' : faceLabel(entry.face))}</span>
      <span class="tooth-dx-text">${escapeHtml(entry.name)}</span>
    </div>
  `).join('');

  return `
    <div class="tooth-dx-hud">
      <div class="tooth-dx-popover ${popoverClass}">
        <p class="tooth-dx-popover-title">Diagnosticos activos</p>
        ${rows}
      </div>
    </div>
  `;
}

function isDiagnosisFresh() {
  return false;
}

function getPlanToothVisualState(toothNumber) {
  const status = odontoData?.teethStatus?.[toothNumber] || null;
  const treatment = getPlanTreatmentVisual(status?.treatment, status?.color);
  const entries = getToothDiagnostics(toothNumber);
  const toothEntry = entries.find(entry => entry.target === 'tooth') || null;
  const faceEntries = entries.filter(entry => entry.target === 'face');
  const ids = new Set(entries.map(entry => entry.id));
  if (treatment?.id) ids.add(treatment.id);

  return {
    status,
    treatment,
    entries,
    toothEntry,
    faceEntries,
    has(id) {
      return ids.has(id);
    },
    primaryColor: toothEntry?.color || treatment?.color || faceEntries[0]?.color || BRAND.primary,
  };
}

function renderPlanToothDiagnosisMarkers(toothNumber) {
  const visual = getPlanToothVisualState(toothNumber);
  if (!visual.entries.length && !visual.treatment) return '';

  const toothFresh = isDiagnosisFresh(toothNumber, 'tooth') ? ' dx-feedback-fresh' : '';
  const showFrame = !!visual.toothEntry || WHOLE_TOOTH_TREATMENT_IDS.has(visual.treatment?.id);
  const frame = showFrame ? `
    <span class="tooth-dx-frame${visual.has('absent') || visual.has('ausente') ? ' dxfx-absent' : ''}${toothFresh}"
      style="${buildDxStyle(visual.primaryColor)}"></span>
  ` : '';

  const crownId = visual.has('crown-bad') ? 'crown-bad' : visual.has('crown-ok') ? 'crown-ok' : visual.has('corona') ? 'corona' : '';
  const crown = crownId ? `
    <span class="tooth-dx-crown dxfx-${crownId}${toothFresh}" style="${buildDxStyle(findPlanVisualSpec(crownId)?.color)}">
      <span class="tooth-dx-crown-band"></span>
    </span>
  ` : '';

  const implant = visual.has('implante') ? `
    <span class="tooth-dx-implant dxfx-implante${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('implante')?.color)}">
      <span class="tooth-dx-implant-cap"></span>
      <span class="tooth-dx-implant-body"></span>
      <span class="tooth-dx-implant-tip"></span>
    </span>
  ` : '';

  const post = visual.has('perno') ? `
    <span class="tooth-dx-post dxfx-perno${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('perno')?.color)}">
      <span class="tooth-dx-post-core"></span>
      <span class="tooth-dx-post-pin"></span>
    </span>
  ` : '';

  const endoId = visual.has('endo') ? 'endo' : visual.has('endodoncia') ? 'endodoncia' : '';
  const endo = endoId ? `
    <span class="tooth-dx-endo dxfx-${endoId}${toothFresh}" style="${buildDxStyle(findPlanVisualSpec(endoId)?.color)}">
      <span class="tooth-dx-endo-line"></span>
      <span class="tooth-dx-endo-node"></span>
    </span>
  ` : '';

  const fracture = visual.has('fractura') ? `
    <span class="tooth-dx-fracture dxfx-fractura${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('fractura')?.color)}">
      <span class="tooth-dx-fracture-a"></span>
      <span class="tooth-dx-fracture-b"></span>
    </span>
  ` : '';

  const pulpar = visual.has('pulpar') ? `
    <span class="tooth-dx-pulp dxfx-pulpar${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('pulpar')?.color)}"></span>
  ` : '';

  const rootStub = visual.has('resto') ? `
    <span class="tooth-dx-root-stub dxfx-resto${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('resto')?.color)}"></span>
  ` : '';

  const eruption = visual.has('erupcion') ? `
    <span class="tooth-dx-eruption dxfx-erupcion${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('erupcion')?.color)}"></span>
  ` : '';

  const mobility = visual.has('movilidad') ? `
    <span class="tooth-dx-mobility dxfx-movilidad${toothFresh}" style="${buildDxStyle(findPlanVisualSpec('movilidad')?.color)}">
      <span class="tooth-dx-mobility-bar left"></span>
      <span class="tooth-dx-mobility-bar right"></span>
    </span>
  ` : '';

  const surfaceEntries = visual.faceEntries.filter(entry => SURFACE_DX_IDS.has(entry.id));
  const surfaces = surfaceEntries.length ? `
    <div class="tooth-dx-surface-map">
      ${surfaceEntries.map(entry => `
        <span class="tooth-dx-surface tooth-dx-surface-${entry.face} dxsurface-${entry.id}${isDiagnosisFresh(toothNumber, entry.face) ? ' dx-feedback-fresh' : ''}"
          style="${buildDxStyle(entry.color)}"
          title="${escapeAttr(`${faceLabel(entry.face)}: ${entry.name}`)}"></span>
      `).join('')}
    </div>
  ` : '';

  return `<div class="tooth-dx-layer">${frame}${surfaces}${crown}${endo}${post}${implant}${pulpar}${fracture}${rootStub}${eruption}${mobility}</div>`;
}

function normalizeToothImageEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { imagen_v: '', imagen_p: '', imagen_url: '' };
  }

  const normalized = {
    imagen_v: typeof entry.imagen_v === 'string' ? entry.imagen_v : '',
    imagen_p: typeof entry.imagen_p === 'string' ? entry.imagen_p : '',
    imagen_url: typeof entry.imagen_url === 'string' ? entry.imagen_url : '',
  };

  if (!normalized.imagen_v && !normalized.imagen_p && normalized.imagen_url) {
    normalized.imagen_v = normalized.imagen_url;
    normalized.imagen_p = normalized.imagen_url;
  }

  return normalized;
}

function getPlanToothImageUrl(toothNumber) {
  const entry = toothImages[toothNumber];
  if (!entry) return '';
  return (entry.imagen_v || entry.imagen_url || entry.imagen_p || '').trim();
}

async function loadPlanToothImagesFromPeriodontograma() {
  toothImages = {};
  if (!currentPacienteId) return;

  try {
    const columns = await dbAll('PRAGMA table_info(periodontograma)');
    const hasImagesColumn = Array.isArray(columns) && columns.some(column => column?.name === 'dientes_imagenes');
    const selectCols = hasImagesColumn ? 'datos, dientes_imagenes' : 'datos';
    let row = await dbGet(`SELECT ${selectCols} FROM periodontograma WHERE paciente_id = ?`, [currentPacienteId]);

    // Fallback: si no tiene imágenes, tomar las más recientes de la base de datos
    if (hasImagesColumn && (!row || !row.dientes_imagenes || row.dientes_imagenes === '{}' || row.dientes_imagenes === 'null')) {
      const fallbackRow = await dbGet(`SELECT dientes_imagenes FROM periodontograma WHERE dientes_imagenes IS NOT NULL AND dientes_imagenes != '{}' AND dientes_imagenes != 'null' AND length(dientes_imagenes) > 50 ORDER BY id DESC LIMIT 1`);
      if (fallbackRow && fallbackRow.dientes_imagenes) {
        if (!row) row = {};
        row.dientes_imagenes = fallbackRow.dientes_imagenes;
      }
    }

    if (!row) return;

    if (row.datos) {
      const parsedDatos = JSON.parse(row.datos);
      const rawTeeth = parsedDatos?.teeth && typeof parsedDatos.teeth === 'object' ? parsedDatos.teeth : parsedDatos;
      if (rawTeeth && typeof rawTeeth === 'object') {
        Object.entries(rawTeeth).forEach(([toothNumber, entry]) => {
          if (!/^\d+$/.test(String(toothNumber))) return;
          toothImages[toothNumber] = normalizeToothImageEntry(entry);
        });
      }
    }

    if (!row.dientes_imagenes) return;

    const parsedImages = JSON.parse(row.dientes_imagenes);
    if (!parsedImages || typeof parsedImages !== 'object') return;

    Object.entries(parsedImages).forEach(([toothNumber, entry]) => {
      if (!/^\d+$/.test(String(toothNumber))) return;
      toothImages[toothNumber] = normalizeToothImageEntry(entry);
    });
  } catch (e) {
    console.error('Error cargando imagenes del periodontograma para planes:', e);
  }
}

async function loadPlanSchemaColumns(force = false) {
  if (planSchemaColumns && !force) return planSchemaColumns;

  try {
    const rows = await dbAll('PRAGMA table_info(planes_tratamiento)');
    planSchemaColumns = new Set((rows || []).map(row => row?.name).filter(Boolean));
  } catch (e) {
    console.error('Error loading planes_tratamiento schema:', e);
    planSchemaColumns = new Set();
  }

  return planSchemaColumns;
}

async function hasPlanTargetColumns() {
  const columns = await loadPlanSchemaColumns();
  return columns.has('diente') && columns.has('caras');
}

function formatPlanTarget(diente, carasRaw) {
  const tooth = String(diente || '').trim();
  if (!tooth) return null;

  const faces = parsePlanFaces(carasRaw);
  return {
    title: `Pieza ${tooth}`,
    detail: faces.length ? faces.map(faceLabel).join(', ') : 'Pieza completa',
  };
}

let globalTratamientosList = [];

function getSelectedTreatmentCosts() {
  const hiddenInput = document.getElementById('select-tratamiento');
  const selectedId = Number(hiddenInput?.value);
  const selectedObj = globalTratamientosList.find(t => t.id === selectedId);

  if (!selectedObj) {
    return {
      costoBase: 0,
      costoMedicina: 0,
      costoMiscelanea: 0,
    };
  }

  return {
    costoBase: parseFloat(selectedObj.costo_base || 0),
    costoMedicina: parseFloat(selectedObj.costo_medicina_estandar || 0),
    costoMiscelanea: parseFloat(selectedObj.costo_miscelanea_estandar || 0),
  };
}

function updateFinancingVisibility() {
  const financingEnabled = document.getElementById('plan-financiar')?.checked;
  const wrapper = document.getElementById('financing-fields');
  if (!wrapper) return;
  wrapper.classList.toggle('hidden', !financingEnabled);
}

function recalculateFinancialPreview() {
  const { costoBase, costoMedicina, costoMiscelanea } = getSelectedTreatmentCosts();
  const costoTotal = roundMoney(costoBase + costoMedicina + costoMiscelanea);
  const discountType = document.getElementById('plan-descuento-tipo')?.value || 'ninguno';
  const discountValue = parseFloat(document.getElementById('plan-descuento-valor')?.value || 0);
  const taxType = document.getElementById('plan-impuesto-tipo')?.value || 'ninguno';
  const taxValue = parseFloat(document.getElementById('plan-impuesto-valor')?.value || 0);
  let discountAmount = 0;
  let taxAmount = 0;

  if (discountType === 'porcentaje') {
    discountAmount = roundMoney(costoTotal * (discountValue / 100));
  } else if (discountType === 'monto_fijo') {
    discountAmount = roundMoney(discountValue);
  }

  let subtotal = costoTotal - discountAmount;
  if (subtotal < 0) subtotal = 0;

  if (taxType === 'porcentaje') {
    taxAmount = roundMoney(subtotal * (taxValue / 100));
  } else if (taxType === 'monto_fijo') {
    taxAmount = roundMoney(taxValue);
  }

  const totalFinal = roundMoney(subtotal + taxAmount);

  const discountEl = document.getElementById('info-descuento-monto');
  if (discountEl) discountEl.textContent = `-${formatCurrency(discountAmount)}`;

  const taxEl = document.getElementById('info-impuesto-monto');
  if (taxEl) taxEl.textContent = `+${formatCurrency(taxAmount)}`;

  const finalEl = document.getElementById('info-total-final');
  if (finalEl) finalEl.textContent = formatCurrency(totalFinal);

  updateFinancingVisibility();
}

function parseFinancingData() {
  const financingEnabled = document.getElementById('plan-financiar')?.checked;
  if (!financingEnabled) return null;

  const fechaInicio = document.getElementById('plan-fecha-inicio')?.value;
  return {
    enabled: true,
    downPayment: parseFloat(document.getElementById('plan-anticipo')?.value || 0),
    installmentCount: parseInt(document.getElementById('plan-numero-cuotas')?.value || 0, 10),
    frequency: document.getElementById('plan-frecuencia')?.value || 'mensual',
    interestPercent: parseFloat(document.getElementById('plan-interes')?.value || 0),
    firstDueDate: document.getElementById('plan-primer-vencimiento')?.value || fechaInicio || null,
  };
}

// Cargar lista de tratamientos del catálogo
async function loadTratamientosCatalogo() {
  try {
    const tratamientos = await dbAll('SELECT id, nombre, descripcion, costo_base, costo_medicina_estandar, costo_miscelanea_estandar, activo FROM tratamientos_catalogo ORDER BY nombre ASC');
    globalTratamientosList = tratamientos;
    renderTratamientoDropdown();
  } catch (e) {
    console.error('Error cargando catalogo:', e);
    showToast('Error cargando catalogo: ' + (e && e.message ? e.message : e), 'error');
  }
}

function renderTratamientoDropdown(filter = '') {
  const listEl = document.getElementById('tratamiento-list');
  const addActionEl = document.getElementById('tratamiento-add-action');
  const addTermEl = document.getElementById('add-tratamiento-term');
  if (!listEl) return;

  const searchStr = filter.trim().toLowerCase();
  let html = '';
  let exactMatch = false;
  let matchCount = 0;

  globalTratamientosList.forEach(t => {
    const isActive = t.activo === 1 || t.activo === true || t.activo === '1';
    if (!isActive) return;

    const nombreLow = t.nombre.toLowerCase();
    if (!searchStr || nombreLow.includes(searchStr)) {
      if (nombreLow === searchStr) exactMatch = true;
      matchCount++;
      html += `<li class="px-4 py-2 hover:bg-[#8BCFDD]/20 dark:hover:bg-slate-700 cursor-pointer transition select-tratamiento-item" data-id="${t.id}" data-nombre="${t.nombre}">
        <div class="font-medium">${t.nombre}</div>
        <div class="text-xs text-slate-500 truncate">${t.descripcion || 'Sin descripción'} - ${formatCurrency(t.costo_base || 0)}</div>
      </li>`;
    }
  });

  if (matchCount === 0) {
    html = `<li class="px-4 py-3 text-sm text-slate-500 italic">No se encontraron tratamientos</li>`;
  }

  listEl.innerHTML = html;

  if (searchStr && !exactMatch) {
    addTermEl.textContent = filter.trim();
    addActionEl.classList.remove('hidden');
  } else {
    addActionEl.classList.add('hidden');
  }

  // Bind clicks
  listEl.querySelectorAll('.select-tratamiento-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const nombre = item.getAttribute('data-nombre');
      selectTratamiento(id, nombre);
    });
  });
}

function selectTratamiento(id, nombre) {
  const hiddenInput = document.getElementById('select-tratamiento');
  const searchInput = document.getElementById('search-tratamiento');
  const dropdown = document.getElementById('tratamiento-dropdown');
  
  if (hiddenInput && searchInput) {
    hiddenInput.value = id;
    searchInput.value = nombre;
    dropdown.classList.add('hidden');
    
    // Trigger onTratamientoSelected
    onTratamientoSelected({ target: { value: id } });
  }
}

async function addNuevoTratamiento(nombre) {
  if (!db) return;
  try {
    const insert = await dbRun(
      `INSERT INTO tratamientos_catalogo (nombre, descripcion, categoria, costo_base, duracion_estimada, activo, costo_medicina_estandar, costo_miscelanea_estandar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, 'Agregado rápidamente', 'General', 0, 30, 1, 0, 0]
    );
    
    await loadTratamientosCatalogo();
    selectTratamiento(insert.lastID, nombre);
    showToast('Tratamiento agregado y seleccionado', 'success');
  } catch (e) {
    console.error('Error agregando tratamiento:', e);
    showToast('Error al agregar: ' + e.message, 'error');
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
    recalculateFinancialPreview();

    infoDiv.classList.remove('hidden');
  } catch (e) {
    console.error('Error cargando tratamiento:', e);
  }
}

// Guardar el progreso del plan a la BD
async function updateProgressToDb(planId, nuevoProgreso) {
  if (!currentPacienteId || !db) return;

  try {
    await dbRun('UPDATE planes_tratamiento SET progreso = ? WHERE id = ?', [nuevoProgreso, planId]);
  } catch (e) {
    console.error('Error actualizando progreso:', e);
  }
}

// Cargar planes pendientes del paciente
async function loadPlanesPendientes() {
  try {
    const targetColumnsAvailable = await hasPlanTargetColumns();
    const planTargetSelect = targetColumnsAvailable
      ? 'p.diente, p.caras,'
      : 'NULL as diente, NULL as caras,';
    const planes = await dbAll(`
      SELECT
        p.id, p.catalogo_id, p.especialista_asignado, p.estado, p.fecha_inicio, p.costo_total, p.total_final, p.descuento_monto, p.impuesto_monto, p.version_comercial, p.notas, p.progreso, ${planTargetSelect}
        EXISTS(SELECT 1 FROM planes_financiamiento pf WHERE pf.plan_tratamiento_id = p.id) as tiene_financiamiento,
        t.nombre as tratamiento_nombre, t.descripcion as tratamiento_desc,
        t.categoria, t.costo_base, t.costo_medicina_estandar, t.costo_miscelanea_estandar,
        t.duracion_estimada
      FROM planes_tratamiento p
      JOIN tratamientos_catalogo t ON p.catalogo_id = t.id
      WHERE p.paciente_id = ? AND p.estado IN ('pendiente', 'en_progreso')
      ORDER BY p.fecha_inicio DESC, p.id DESC
    `, [currentPacienteId]);

    const financeByPlan = new Map();
    const installmentsByPlan = new Map();
    const financeApi = getFinanceApi();

    if (financeApi?.getPatientSummary) {
      try {
        const financeData = await financeApi.getPatientSummary(Number(currentPacienteId));
        (financeData?.plans || []).forEach(plan => {
          financeByPlan.set(Number(plan.id), plan);
        });
        (financeData?.installments || []).forEach(installment => {
          const key = Number(installment.plan_tratamiento_id);
          if (!installmentsByPlan.has(key)) installmentsByPlan.set(key, []);
          installmentsByPlan.get(key).push(installment);
        });
      } catch (financeError) {
        console.warn('No se pudieron cargar los datos financieros del paciente:', financeError);
      }
    }

    const listDiv = document.getElementById('planes-pendientes-list');
    if (!listDiv) return;

    if (planes.length === 0) {
      listDiv.className = "space-y-4";
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

    listDiv.className = "grid grid-cols-1 gap-6";
    let htmlContent = '';

    planes.forEach(p => {
      const financePlan = financeByPlan.get(Number(p.id)) || null;
      const planInstallments = (installmentsByPlan.get(Number(p.id)) || []).slice();
      planInstallments.sort((left, right) => {
        const leftDate = String(left.fecha_vencimiento || '');
        const rightDate = String(right.fecha_vencimiento || '');
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return Number(left.numero || 0) - Number(right.numero || 0);
      });

      const progreso = Math.max(0, Math.min(100, p.progreso || 0));
      const totalFinal = roundMoney(financePlan?.total_final || p.total_final || p.costo_total || 0);
      const totalPagado = roundMoney(financePlan?.neto_pagado || 0);
      const saldoPendiente = roundMoney(financePlan?.saldo_pendiente != null ? financePlan.saldo_pendiente : Math.max(totalFinal - totalPagado, 0));
      const montoVencido = roundMoney(financePlan?.monto_vencido || 0);
      const descuentoMonto = roundMoney(p.descuento_monto || 0);
      const impuestoMonto = roundMoney(financePlan?.impuesto_monto != null ? financePlan.impuesto_monto : (p.impuesto_monto || 0));
      const versionComercial = Math.max(1, Number(financePlan?.version_comercial || p.version_comercial || 1));
      const target = formatPlanTarget(p.diente, p.caras);
      const nextPendingInstallments = planInstallments.filter(item => roundMoney(item.saldo_pendiente != null ? item.saldo_pendiente : (item.monto_programado - item.monto_pagado)) > 0);
      const nextDue = nextPendingInstallments.length ? nextPendingInstallments[0] : null;
      const radius = 45;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference * (1 - progreso / 100);

      htmlContent += `
        <div class="rounded-3xl bg-white dark:bg-[#0E1A25] border border-[#8BCFDD]/50 dark:border-[#4EABBE]/30 shadow-lg shadow-[#8BCFDD]/10 dark:shadow-none p-6 flex flex-col md:flex-row gap-6 hover:shadow-xl transition-all duration-300" data-plan-id="${p.id}">
          <!-- Círculo de Progreso -->
          <div class="flex flex-col items-center gap-3 min-w-fit">
            <div style="position:relative; width:120px; height:120px;">
              <svg style="width:100%; height:100%; transform:rotate(-90deg);" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="6" />
                <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#4EABBE" stroke-width="6"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.3s ease; filter: drop-shadow(0 2px 4px rgba(15,37,50,0.1));" />
              </svg>
              <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                <p style="font-size:24px; font-weight:bold; color:#4EABBE; margin:0;">${progreso}%</p>
              </div>
            </div>
            <input type="range" min="0" max="100" value="${progreso}" class="progress-slider"
              data-plan-id="${p.id}"
              style="width:100px; cursor:pointer; accent-color:#4EABBE; margin-top:5px;">
            <p style="font-size:10px; color:#999; margin:0;">Ajustar progreso</p>
          </div>

          <!-- Contenido del Plan -->
          <div class="flex-1">
            <div class="flex justify-between items-start mb-4 pb-4 border-b border-[#8BCFDD]/20 dark:border-slate-700">
              <div>
                <p class="text-[10px] font-bold text-[#4EABBE] dark:text-[#8BCFDD] uppercase tracking-widest mb-1">Tratamiento</p>
                <p class="text-xl font-extrabold text-[#0F2532] dark:text-white leading-tight">${escapeHtml(p.tratamiento_nombre)}</p>
              </div>
              <span class="px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
                p.estado === 'completado' ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                p.estado === 'en_progreso' ? 'bg-blue-100/80 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
                'bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              }">
                ${p.estado.charAt(0).toUpperCase() + p.estado.slice(1).replace('_', ' ')}
              </span>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-6 bg-[#F8F7F7] dark:bg-slate-800/40 rounded-2xl p-4 border border-[#8BCFDD]/20 dark:border-slate-700">
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Total Final</p>
                <p class="text-lg font-bold text-[#4EABBE] dark:text-[#8BCFDD]">$${totalFinal.toFixed(2)}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Duración</p>
                <p class="font-semibold text-[#0F2532] dark:text-slate-100">${p.duracion_estimada || 30} min</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Especialista</p>
                <p class="font-semibold text-[#0F2532] dark:text-slate-100">${escapeHtml(p.especialista_asignado || 'Sin asignar')}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Categoría</p>
                <p class="font-semibold text-[#0F2532] dark:text-slate-100">${escapeHtml(p.categoria || 'General')}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-6">
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Descuento</p>
                <p class="font-medium text-[#0F2532] dark:text-slate-100">$${descuentoMonto.toFixed(2)}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Impuesto</p>
                <p class="font-medium text-[#0F2532] dark:text-slate-100">$${impuestoMonto.toFixed(2)}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Cobro</p>
                <p class="font-medium text-[#0F2532] dark:text-slate-100">${Number(p.tiene_financiamiento) ? 'En cuotas' : 'Pago libre'}</p>
              </div>
              <div>
                <p class="text-[10px] uppercase tracking-wider font-semibold text-[#1D5D69] dark:text-slate-400">Version</p>
                <p class="font-medium text-[#0F2532] dark:text-slate-100">v${versionComercial}</p>
              </div>
            </div>

            <div class="bg-[#F8F7F7] dark:bg-slate-800/40 rounded-2xl p-4 border border-[#8BCFDD]/30 dark:border-slate-700 mb-6">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p class="text-xs font-semibold text-[#1D5D69] dark:text-slate-400">Pagos / Cuotas</p>
                <p class="text-xs text-[#0F2532]/70 dark:text-slate-300">
                  ${nextDue
          ? `${nextDue.es_anticipo ? 'Anticipo' : `Cuota #${nextDue.numero}`} - ${formatDateDisplay(nextDue.fecha_vencimiento)}`
          : 'Sin cuotas pendientes'}
                </p>
              </div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div>
                  <p class="text-xs text-[#1D5D69] dark:text-slate-400">Total</p>
                  <p class="font-semibold text-[#0F2532] dark:text-slate-100">${formatCurrency(totalFinal)}</p>
                </div>
                <div>
                  <p class="text-xs text-[#1D5D69] dark:text-slate-400">Abonado</p>
                  <p class="font-semibold text-emerald-600 dark:text-emerald-400">${formatCurrency(totalPagado)}</p>
                </div>
                <div>
                  <p class="text-xs text-[#1D5D69] dark:text-slate-400">Saldo</p>
                  <p class="font-semibold ${saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${formatCurrency(saldoPendiente)}</p>
                </div>
                <div>
                  <p class="text-xs text-[#1D5D69] dark:text-slate-400">Vencido</p>
                  <p class="font-semibold ${montoVencido > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#0F2532] dark:text-slate-100'}">${formatCurrency(montoVencido)}</p>
                </div>
              </div>

              ${planInstallments.length ? `
                <div class="mt-3 overflow-x-auto">
                  <table class="min-w-full text-xs">
                    <thead>
                      <tr class="text-left text-[#1D5D69] dark:text-slate-400">
                        <th class="py-2 pr-3 font-semibold">Cuota</th>
                        <th class="py-2 pr-3 font-semibold">Vencimiento</th>
                        <th class="py-2 pr-3 font-semibold">Monto</th>
                        <th class="py-2 pr-3 font-semibold">Abonado</th>
                        <th class="py-2 pr-3 font-semibold">Saldo</th>
                        <th class="py-2 pr-3 font-semibold">Estado</th>
                        <th class="py-2 font-semibold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${planInstallments.map(item => {
            const badge = getInstallmentBadge(item);
            const scheduled = roundMoney(item.monto_programado || 0);
            const paid = roundMoney(item.monto_pagado || 0);
            const pending = roundMoney(item.saldo_pendiente != null ? item.saldo_pendiente : (scheduled - paid));
            return `
                          <tr class="border-t border-[#8BCFDD]/20 dark:border-slate-700">
                            <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100">${item.es_anticipo ? 'Anticipo' : `#${item.numero}`}</td>
                            <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100">${formatDateDisplay(item.fecha_vencimiento)}</td>
                            <td class="py-2 pr-3 text-[#0F2532] dark:text-slate-100">${formatCurrency(scheduled)}</td>
                            <td class="py-2 pr-3 text-emerald-600 dark:text-emerald-400">${formatCurrency(paid)}</td>
                            <td class="py-2 pr-3 ${pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${formatCurrency(pending)}</td>
                            <td class="py-2 pr-3">
                              <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${badge.className}">
                                ${badge.label}
                              </span>
                            </td>
                            <td class="py-2 text-right">
                              ${pending > 0 ? `
                                <button type="button" class="px-3 py-1.5 rounded-lg bg-[#4EABBE]/15 text-[#1D5D69] dark:text-[#8BCFDD] text-[11px] font-semibold hover:bg-[#4EABBE]/25 transition"
                                        onclick="abrirModalPago(${p.id}, ${item.id}, ${pending}, '${item.es_anticipo ? 'Anticipo' : 'Cuota #' + item.numero}')">
                                  Abonar
                                </button>
                              ` : ''}
                            </td>
                          </tr>
                        `;
          }).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="flex items-center justify-between mt-3">
                  <p class="text-xs text-[#0F2532]/70 dark:text-slate-300">Cobro libre (sin cuotas).</p>
                  ${saldoPendiente > 0 ? `
                    <button type="button" class="px-3 py-1.5 rounded-lg bg-[#4EABBE]/15 text-[#1D5D69] dark:text-[#8BCFDD] text-[11px] font-semibold hover:bg-[#4EABBE]/25 transition"
                            onclick="abrirModalPago(${p.id}, null, ${saldoPendiente}, 'Pago libre')">
                      Abonar
                    </button>
                  ` : ''}
                </div>
              `}
            </div>

            ${target ? `
              <div class="bg-[#8BCFDD]/10 dark:bg-[#4EABBE]/10 rounded-2xl p-4 border border-[#8BCFDD]/30 dark:border-[#4EABBE]/20 mb-5">
                <p class="text-[10px] uppercase tracking-wider font-bold text-[#1D5D69] dark:text-[#8BCFDD] mb-1">Pieza objetivo</p>
                <p class="text-base font-bold text-[#0F2532] dark:text-white">${escapeHtml(target.title)}</p>
                <p class="text-sm text-[#0F2532]/80 dark:text-slate-300 mt-1">${escapeHtml(target.detail)}</p>
              </div>
            ` : ''}

            ${p.notas ? `
              <div class="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-200/60 dark:border-amber-700/40 mb-5">
                <p class="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-500 mb-1">Notas del Plan</p>
                <p class="text-sm text-amber-900 dark:text-amber-100/90 leading-relaxed">${escapeHtml(p.notas)}</p>
              </div>
            ` : ''}

            <div class="flex justify-end gap-2 pt-3 border-t border-[#8BCFDD]/20">
              <button class="px-4 py-2 rounded-lg bg-green-500/20 text-green-600 text-sm font-semibold hover:bg-green-500/30 transition"
                onclick="changeEstado(${p.id}, 'completado')">
                ✓ Completar
              </button>
            </div>
          </div>
        </div>
      `;
    });

    listDiv.innerHTML = htmlContent;

    // Bind sliders DESPUÉS de que el HTML esté en el DOM
    setTimeout(() => {
      document.querySelectorAll('.progress-slider').forEach(slider => {
        slider.addEventListener('input', async (e) => {
          const planId = parseInt(e.target.getAttribute('data-plan-id'), 10);
          const nuevoProgreso = parseInt(e.target.value, 10);
          await updateProgressToDb(planId, nuevoProgreso);
          await loadPlanesPendientes();
        });
      });
    }, 100);

  } catch (e) {
    console.error('Error cargando planes:', e);
    showToast('Error cargando planes: ' + e.message, 'error');
  }
}

// Abrir modal para nuevo plan
async function openNewPlanModal() {
  currentEditingPlanId = null;
  document.getElementById('plan-id').value = '';
  document.getElementById('form-plan').reset();
  document.getElementById('modal-plan-subtitle').textContent = 'Seleccionar';
  document.getElementById('tratamiento-info').classList.add('hidden');
  document.getElementById('plan-descuento-tipo').value = 'ninguno';
  document.getElementById('plan-descuento-valor').value = '0';
  document.getElementById('plan-impuesto-tipo').value = 'ninguno';
  document.getElementById('plan-impuesto-valor').value = '0';
  document.getElementById('plan-financiar').checked = false;
  document.getElementById('plan-anticipo').value = '0';
  document.getElementById('plan-numero-cuotas').value = '1';
  document.getElementById('plan-frecuencia').value = 'mensual';
  document.getElementById('plan-interes').value = '0';
  document.getElementById('plan-primer-vencimiento').value = '';
  updateFinancingVisibility();
  recalculateFinancialPreview();
  clearPlanTargetSelection({ rerender: false });
  renderCommercialVersionHistory(null);
  await loadTratamientosCatalogo();
  document.getElementById('modal-plan').classList.remove('hidden');
}

// Editar plan existente
async function editPlan(planId) {
  try {
    const financeApi = getFinanceApi();
    const plan = financeApi
      ? await financeApi.getTreatmentPlanDetail(planId)
      : await dbGet('SELECT * FROM planes_tratamiento WHERE id = ?', [planId]);
    if (!plan) return showToast('Plan no encontrado', 'error');

    currentEditingPlanId = planId;
    await loadTratamientosCatalogo();
    document.getElementById('plan-id').value = plan.id;
    document.getElementById('select-tratamiento').value = plan.catalogo_id;
    document.getElementById('select-especialista').value = plan.especialista_asignado || '';
    document.getElementById('plan-notas').value = plan.notas || '';
    document.getElementById('plan-fecha-inicio').value = plan.fecha_inicio || '';
    document.getElementById('plan-descuento-tipo').value = plan.descuento_tipo || 'ninguno';
    document.getElementById('plan-descuento-valor').value = plan.descuento_valor || 0;
    document.getElementById('plan-impuesto-tipo').value = plan.impuesto_tipo || 'ninguno';
    document.getElementById('plan-impuesto-valor').value = plan.impuesto_valor || 0;
    setPlanTargetSelection({
      tooth: plan.diente || null,
      faces: parsePlanFaces(plan.caras),
      mode: plan.diente ? (parsePlanFaces(plan.caras).length ? 'face' : 'tooth') : null,
    }, { rerender: true, syncForm: true });

    const financing = plan.financing || null;
    document.getElementById('plan-financiar').checked = !!financing;
    document.getElementById('plan-anticipo').value = financing?.anticipo || 0;
    document.getElementById('plan-numero-cuotas').value = financing?.numero_cuotas || 1;
    document.getElementById('plan-frecuencia').value = financing?.frecuencia || 'mensual';
    document.getElementById('plan-interes').value = financing?.interes_porcentaje || 0;
    document.getElementById('plan-primer-vencimiento').value = financing?.fecha_primer_vencimiento || '';
    updateFinancingVisibility();
    renderCommercialVersionHistory(plan);

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
      // Intentar crear registro en historial, pero no fallar si hay un error
      try {
        await dbRun(`
          INSERT INTO planes_tratamiento_historial
          (plan_id, paciente_id, catalogo_id, especialista_ejecuto, costo_total, fecha_ejecucion)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [planId, plan.paciente_id, plan.catalogo_id, plan.especialista_asignado || null, plan.total_final || plan.costo_total]);
      } catch (historialError) {
        // Log del error pero continuar
        console.warn('No se pudo guardar en historial (puede que falten columnas):', historialError);
      }

      // Actualizar estado a completado (esto sí es crítico)
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
    const pagosRelacionados = await dbGet(
      `SELECT COUNT(*) AS total
       FROM pagos
       WHERE plan_tratamiento_id = ?
         AND COALESCE(estado, 'aplicado') = 'aplicado'`,
      [planId]
    );
    if (Number(pagosRelacionados?.total || 0) > 0) {
      showToast('No se puede eliminar un plan con pagos aplicados. Cancela o devuelve los pagos primero.', 'error');
      return;
    }

    await dbRun('DELETE FROM pagos_aplicaciones WHERE cuota_financiamiento_id IN (SELECT id FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?)', [planId]);
    await dbRun('DELETE FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
    await dbRun('DELETE FROM planes_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
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
  const diente = String(form.diente?.value || '').trim() || null;
  const caras = parsePlanFaces(form.caras?.value || '');
  const descuentoTipo = document.getElementById('plan-descuento-tipo').value;
  const descuentoValor = parseFloat(document.getElementById('plan-descuento-valor').value || 0);
  const impuestoTipo = document.getElementById('plan-impuesto-tipo').value;
  const impuestoValor = parseFloat(document.getElementById('plan-impuesto-valor').value || 0);
  const versionReason = document.getElementById('plan-version-reason')?.value?.trim() || '';
  const financing = getFinancingPayload(fechaInicio);
  const financeApi = getFinanceApi();

  if (!catalogoId) {
    showToast('Debe seleccionar un tratamiento', 'error');
    return;
  }

  if (financing.enabled) {
    if (!Number.isFinite(financing.downPayment) || financing.downPayment < 0) {
      showToast('El anticipo es invalido', 'error');
      return;
    }
    if (!Number.isInteger(financing.installmentCount) || financing.installmentCount < 1) {
      showToast('El numero de cuotas debe ser mayor a 0', 'error');
      return;
    }
    if (!Number.isFinite(financing.interestPercent) || financing.interestPercent < 0) {
      showToast('El interes es invalido', 'error');
      return;
    }
  }

  if (!Number.isFinite(impuestoValor) || impuestoValor < 0) {
    showToast('El impuesto es invalido', 'error');
    return;
  }

  if (financeApi?.saveTreatmentPlan) {
    try {
      await financeApi.saveTreatmentPlan({
        id: planId || null,
        paciente_id: currentPacienteId,
        catalogo_id: Number(catalogoId),
        especialista_asignado: especialista,
        notas,
        fecha_inicio: fechaInicio || null,
        diente,
        caras,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoValor,
        impuesto_tipo: impuestoTipo,
        impuesto_valor: impuestoValor,
        version_reason: versionReason || undefined,
        financing,
        usuario_id: getCurrentUserId(),
      });

      showToast(planId ? 'Plan actualizado exitosamente' : 'Plan creado exitosamente', 'success');
      document.getElementById('modal-plan').classList.add('hidden');
      form.reset();
      updateFinancingVisibility();
      clearPlanTargetSelection();
      planSchemaColumns = null;
      await loadPlanesPendientes();
      return;
    } catch (e) {
      console.error('Error guardando plan con finanzas:', e);
      showToast('Error: ' + e.message, 'error');
      return;
    }
  }

  try {
    const targetColumnsAvailable = await hasPlanTargetColumns();
    // Obtener costo total del catálogo
    const tratamiento = await dbGet('SELECT costo_base, costo_medicina_estandar, costo_miscelanea_estandar FROM tratamientos_catalogo WHERE id = ?', [catalogoId]);
    if (!tratamiento) return showToast('Tratamiento no válido', 'error');

    const costoTotal = (parseFloat(tratamiento.costo_base || 0) + parseFloat(tratamiento.costo_medicina_estandar || 0) + parseFloat(tratamiento.costo_miscelanea_estandar || 0));
    const descuentoMonto = descuentoTipo === 'porcentaje'
      ? roundMoney((costoTotal * Math.max(0, descuentoValor)) / 100)
      : descuentoTipo === 'monto_fijo'
        ? roundMoney(Math.max(0, descuentoValor))
        : 0;
    const subtotalNeto = roundMoney(Math.max(0, costoTotal - Math.min(descuentoMonto, costoTotal)));
    const impuestoMonto = impuestoTipo === 'porcentaje'
      ? roundMoney((subtotalNeto * Math.max(0, impuestoValor)) / 100)
      : impuestoTipo === 'monto_fijo'
        ? roundMoney(Math.max(0, impuestoValor))
        : 0;
    const totalFinal = roundMoney(subtotalNeto + impuestoMonto);

    if (planId) {
      // Actualizar
      if (targetColumnsAvailable) {
        await dbRun(`
          UPDATE planes_tratamiento 
          SET catalogo_id = ?, especialista_asignado = ?, notas = ?, fecha_inicio = ?, costo_total = ?,
              descuento_tipo = ?, descuento_valor = ?, descuento_monto = ?, subtotal_neto = ?,
              impuesto_tipo = ?, impuesto_valor = ?, impuesto_monto = ?, total_final = ?,
              version_comercial = COALESCE(version_comercial, 1) + 1, version_actualizada_en = CURRENT_TIMESTAMP,
              diente = ?, caras = ?
          WHERE id = ?
        `, [catalogoId, especialista, notas, fechaInicio, costoTotal, descuentoTipo, descuentoValor, descuentoMonto, subtotalNeto, impuestoTipo, impuestoValor, impuestoMonto, totalFinal, diente, serializePlanFaces(caras), planId]);
      } else {
        await dbRun(`
          UPDATE planes_tratamiento 
          SET catalogo_id = ?, especialista_asignado = ?, notas = ?, fecha_inicio = ?, costo_total = ?,
              descuento_tipo = ?, descuento_valor = ?, descuento_monto = ?, subtotal_neto = ?,
              impuesto_tipo = ?, impuesto_valor = ?, impuesto_monto = ?, total_final = ?,
              version_comercial = COALESCE(version_comercial, 1) + 1, version_actualizada_en = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [catalogoId, especialista, notas, fechaInicio, costoTotal, descuentoTipo, descuentoValor, descuentoMonto, subtotalNeto, impuestoTipo, impuestoValor, impuestoMonto, totalFinal, planId]);
      }
      showToast('Plan actualizado exitosamente', 'success');
    } else {
      // Crear nuevo
      if (targetColumnsAvailable) {
        await dbRun(`
          INSERT INTO planes_tratamiento 
          (paciente_id, catalogo_id, especialista_asignado, notas, fecha_inicio, costo_total, descuento_tipo, descuento_valor, descuento_monto, subtotal_neto, impuesto_tipo, impuesto_valor, impuesto_monto, total_final, version_comercial, version_actualizada_en, diente, caras, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, 'pendiente')
        `, [currentPacienteId, catalogoId, especialista, notas, fechaInicio, costoTotal, descuentoTipo, descuentoValor, descuentoMonto, subtotalNeto, impuestoTipo, impuestoValor, impuestoMonto, totalFinal, diente, serializePlanFaces(caras)]);
      } else {
        await dbRun(`
          INSERT INTO planes_tratamiento 
          (paciente_id, catalogo_id, especialista_asignado, notas, fecha_inicio, costo_total, descuento_tipo, descuento_valor, descuento_monto, subtotal_neto, impuesto_tipo, impuesto_valor, impuesto_monto, total_final, version_comercial, version_actualizada_en, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 'pendiente')
        `, [currentPacienteId, catalogoId, especialista, notas, fechaInicio, costoTotal, descuentoTipo, descuentoValor, descuentoMonto, subtotalNeto, impuestoTipo, impuestoValor, impuestoMonto, totalFinal]);
      }
      showToast('Plan creado exitosamente', 'success');
    }

    document.getElementById('modal-plan').classList.add('hidden');
    form.reset();
    clearPlanTargetSelection();
    planSchemaColumns = null;
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
  updateFinancingVisibility();
  currentEditingPlanId = null;
  clearPlanTargetSelection();
  renderCommercialVersionHistory(null);
}

// ===== MINI ODONTOGRAMA =====
// Variables locales para el odontograma mini
let odontoData = {
  teethStatus: {},
  diagnosticsState: {},
  selectedTooth: null,
  selectedFaces: [],
  selectionMode: null,
};

const { createToothSVG: basicCreateToothSVG, adultTeeth, childTeeth, arcOffset, BRAND, hexToRgba, renderSurfaceMarks } = window.OdontoRender;

function getPlanSelectionState() {
  return {
    tooth: odontoData.selectedTooth || null,
    faces: parsePlanFaces(odontoData.selectedFaces),
    mode: odontoData.selectionMode || null,
  };
}

function syncPlanTargetFields() {
  const selection = getPlanSelectionState();
  const toothInput = document.getElementById('plan-diente');
  const facesInput = document.getElementById('plan-caras');
  const summary = document.getElementById('plan-target-summary');
  const title = document.getElementById('plan-target-title');
  const detail = document.getElementById('plan-target-detail');

  if (toothInput) toothInput.value = selection.tooth || '';
  if (facesInput) facesInput.value = selection.mode === 'face' ? serializePlanFaces(selection.faces) : '';

  if (!summary || !title || !detail) return;
  if (!selection.tooth) {
    summary.classList.add('hidden');
    title.textContent = '';
    detail.textContent = '';
    return;
  }

  summary.classList.remove('hidden');
  title.textContent = `Pieza ${selection.tooth}`;
  detail.textContent = selection.mode === 'face' && selection.faces.length
    ? selection.faces.map(faceLabel).join(', ')
    : 'Pieza completa';
}

function updateMiniSelectionHint() {
  const selection = getPlanSelectionState();
  const hint = document.getElementById('mini-odonto-selection');
  if (!hint) return;

  if (!selection.tooth) {
    hint.textContent = 'Selecciona una cara desde el círculo o toda la pieza desde el diente para crear el plan.';
    return;
  }

  hint.textContent = selection.mode === 'face' && selection.faces.length
    ? `Seleccion actual: pieza ${selection.tooth} - ${selection.faces.map(faceLabel).join(', ')}.`
    : `Seleccion actual: pieza ${selection.tooth} completa.`;
}

function setPlanTargetSelection(selection = {}, options = {}) {
  const { rerender = true, syncForm = true } = options;
  const tooth = String(selection.tooth || '').trim() || null;
  const faces = parsePlanFaces(selection.faces);
  const mode = tooth ? (selection.mode || (faces.length ? 'face' : 'tooth')) : null;

  odontoData.selectedTooth = tooth;
  odontoData.selectedFaces = mode === 'face' ? faces : [];
  odontoData.selectionMode = tooth ? mode : null;

  if (syncForm) syncPlanTargetFields();
  updateMiniSelectionHint();
  if (rerender) renderMiniOdontograma();
}

function clearPlanTargetSelection(options = {}) {
  setPlanTargetSelection({ tooth: null, faces: [], mode: null }, options);
}

function getDiagnosesForSelection(selection = {}) {
  const tooth = String(selection.tooth || '').trim();
  if (!tooth) return [];

  const dx = odontoData.diagnosticsState[tooth] || odontoData.diagnosticsState[Number(tooth)] || null;
  if (!dx) return [];

  if (selection.mode === 'face') {
    return parsePlanFaces(selection.faces)
      .map(face => dx.faces?.[face])
      .filter(Boolean);
  }

  const toothDx = dx.tooth ? [dx.tooth] : [];
  const faceDx = Object.values(dx.faces || {});
  return [...toothDx, ...faceDx].filter(Boolean);
}

function buildPlanNotesFromSelection(selection = {}) {
  const tooth = String(selection.tooth || '').trim();
  if (!tooth) return '';

  const diagnoses = getDiagnosesForSelection(selection);
  const uniqueNames = [...new Set(diagnoses.map(item => item.name).filter(Boolean))];
  let notes = `Tratamiento para pieza ${tooth}.`;

  if (selection.mode === 'face' && parsePlanFaces(selection.faces).length) {
    notes += ` Caras afectadas: ${parsePlanFaces(selection.faces).map(faceLabel).join(', ')}.`;
  } else {
    notes += ' Zona: pieza completa.';
  }

  if (uniqueNames.length) {
    notes += ` Diagnostico: ${uniqueNames.join(', ')}.`;
  }

  return notes;
}

function suggestTreatmentFromSelection(selection = {}) {
  const diagnoses = getDiagnosesForSelection(selection);
  const ids = new Set(diagnoses.map(item => item.id));

  let match = null;

  if (ids.has('pulpar') || ids.has('endo')) {
    match = globalTratamientosList.find(t => t.nombre.toLowerCase().includes('endodon'));
  } else if (ids.has('absent')) {
    match = globalTratamientosList.find(t => {
      const text = t.nombre.toLowerCase();
      return text.includes('implante') || text.includes('puente');
    });
  } else if (ids.has('crown-bad') || ids.has('crown-ok')) {
    match = globalTratamientosList.find(t => t.nombre.toLowerCase().includes('corona'));
  } else if (ids.has('fractura') || ids.has('caries-dx') || ids.has('rest-bad')) {
    match = globalTratamientosList.find(t => {
      const text = t.nombre.toLowerCase();
      return text.includes('restauraci') || text.includes('obturaci');
    });
  }

  if (!match) return;
  selectTratamiento(match.id, match.nombre);
}

function createPlanToothSVG(num, isUpper, isSelected, treatmentColor, surfaces, isMissing) {
  const toothImageUrl = getPlanToothImageUrl(num);
  if (!toothImageUrl) {
    return `
      <div class="tooth-visual">
        <div class="tooth-image-stage tooth-svg-stage">
          ${renderPlanToothDiagnosisMarkers(num)}
          ${basicCreateToothSVG(num, isUpper, isSelected, treatmentColor, surfaces, isMissing)}
        </div>
      </div>
    `;
  }

  const w = 80;
  const h = 104;
  const surfaceColor = treatmentColor || BRAND.primary;
  const overlays = !isMissing && surfaces ? renderSurfaceMarks(surfaces, isUpper, surfaceColor, w, h) : '';
  const missingMark = isMissing ? `
    <line x1="${w * 0.2}" y1="${h * 0.2}" x2="${w * 0.8}" y2="${h * 0.8}" stroke="#EF4444" stroke-width="3.5" opacity="0.85" stroke-linecap="round"/>
    <line x1="${w * 0.8}" y1="${h * 0.2}" x2="${w * 0.2}" y2="${h * 0.8}" stroke="#EF4444" stroke-width="3.5" opacity="0.85" stroke-linecap="round"/>
  ` : '';
  const baseOpacity = isMissing ? 0.45 : 1;

  return `
    <div class="tooth-visual tooth-visual-image">
      <div class="tooth-image-stage">
        <img src="${escapeAttr(toothImageUrl)}" alt="Diente ${num}"
          class="tooth-illustration"
          style="opacity:${baseOpacity};" draggable="false" />
        ${renderPlanToothDiagnosisMarkers(num)}
        <svg viewBox="0 0 ${w} ${h}" class="absolute inset-0 w-full h-full pointer-events-none">
          ${overlays}
          ${missingMark}
        </svg>
      </div>
    </div>
  `;
}

function renderMiniGeoCircle(num, dxState) {
  const state = dxState || {};
  const faces = state.faces || {};
  const toothClass = state.tooth?.cssClass || '';
  const isAbsent = state.tooth?.id === 'absent';
  const entries = getToothDiagnostics(num);
  const selection = getPlanSelectionState();
  const isSelectedTooth = selection.tooth === String(num) && selection.mode === 'tooth';
  const selectedFaces = selection.tooth === String(num) && selection.mode === 'face'
    ? new Set(selection.faces)
    : new Set();
  const faceCls = (id) => {
    const dx = faces[id];
    const classes = [];
    if (dx?.id) {
      classes.push(dx.cssClass || '', `dxfx-${dx.id}`);
    }
    if (selectedFaces.has(id)) classes.push('geo-sector-target');
    return classes.length ? ` ${classes.join(' ')}` : '';
  };
  const circleClasses = ['geo-circle', toothClass || ''];
  if (state.tooth?.id) circleClasses.push(`dxfx-${state.tooth.id}`);
  if (isSelectedTooth) circleClasses.push('geo-circle-selected');
  const countBadge = entries.length
    ? `<span class="geo-dx-count" style="${buildDxStyle(entries[0].color)}">${entries.length}</span>`
    : '';

  return `
    <div class="geo-mini geo-mini-selectable ${toothClass || ''}" title="${escapeAttr(getDiagnosisSummaryTitle(num))}">
      ${countBadge}
      <svg viewBox="0 0 100 100" class="geo-svg">
        <circle cx="50" cy="50" r="48" class="${circleClasses.filter(Boolean).join(' ')}" />

        <path d="M15,15 L85,85 M85,15 L15,85" stroke="#0f172a" stroke-width="4" class="geo-cross ${isAbsent ? '' : 'hidden'}" />

        <path d="M15,15 L85,15 L65,35 L35,35 Z" class="geo-sector${faceCls('vestibular')}"
          data-plan-face="vestibular" data-tooth="${num}" />
        <path d="M15,85 L85,85 L65,65 L35,65 Z" class="geo-sector${faceCls('lingual')}"
          data-plan-face="lingual" data-tooth="${num}" />
        <path d="M15,15 L15,85 L35,65 L35,35 Z" class="geo-sector${faceCls('mesial')}"
          data-plan-face="mesial" data-tooth="${num}" />
        <path d="M85,15 L85,85 L65,65 L65,35 Z" class="geo-sector${faceCls('distal')}"
          data-plan-face="distal" data-tooth="${num}" />
        <rect x="35" y="35" width="30" height="30" class="geo-sector${faceCls('oclusal')}"
          data-plan-face="oclusal" data-tooth="${num}" />
      </svg>
    </div>
  `;
}

// Cargar estado del odontograma (diagnósticos y tratamientos previos)
async function loadOdontogramData() {
  if (!currentPacienteId) return;
  const loading = document.getElementById('odonto-loading');
  if (loading) loading.classList.remove('hidden');

  try {
    await loadPlanToothImagesFromPeriodontograma();
    const rows = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND diente IS NOT NULL', [currentPacienteId]);

    const status = {};
    const dxState = {};

    rows.forEach(row => {
      const toothNum = parseInt(row.diente, 10);
      if (isNaN(toothNum)) return;

      // 1. Diagnósticos
      if (row.notas && row.notas.startsWith("DX:")) {
        try {
          const json = JSON.parse(row.notas.substring(3));

          // Helper local similar a ensureDxState
          if (!dxState[toothNum]) dxState[toothNum] = { faces: {}, tooth: null };

          // Mapear diagnóstico simple
          // Nota: No tenemos acceso directo a DIAGNOSES completo aquí salvo si lo exportamos en odonto-render.
          // Pero para visualizar el círculo o color, podemos inferir o usar CSS si 'odonto-render' tuviera todo.
          // Por simplicidad, asumimos que 'odonto-render' solo pinta SVG y clases CSS básicas.
          // Usaremos la clase CSS guardada en el JSON si existe, o defaults.

          const spec = findDiagnosisSpec(json.dxId);
          const diagData = {
            id: json.dxId,
            name: spec?.name || json.dxId,
            cssClass: spec?.cssClass || json.cssClass || 'state-caries',
            color: spec?.color || '#ef4444',
            status: spec?.status || 'Pendiente',
          };

          if (json.face) {
            dxState[toothNum].faces[json.face] = diagData;
          } else {
            dxState[toothNum].tooth = diagData;
          }
        } catch (e) { }
        return;
      }

      // 2. Tratamientos realizados (para pintar diente completo)
      // Simplificado: si tiene tratamiento, lo marcamos realizado.
      const proc = (row.procedimiento || "").toLowerCase();
      let color = null;
      let treatId = null;

      // Colores hardcodeados o reusar logica similar a odontograma.js si se quiere exactitud
      if (proc.includes("caries")) { color = "#EF4444"; treatId = "caries"; }
      else if (proc.includes("restauracion")) { color = "#10B981"; treatId = "restauracion"; }
      else if (proc.includes("endodoncia")) { color = "#A855F7"; treatId = "endodoncia"; }
      else if (proc.includes("ausente")) { color = "#6B7280"; treatId = "ausente"; }
      else if (proc.includes("corona")) { color = "#FBBF24"; treatId = "corona"; }

      if (treatId) {
        status[toothNum] = { treatment: treatId, color };
      }
    });

    odontoData.teethStatus = status;
    odontoData.diagnosticsState = dxState;
    renderMiniOdontograma();
    updateMiniSelectionHint();

  } catch (e) {
    console.error("Error loading odonto data:", e);
    renderMiniOdontograma();
    updateMiniSelectionHint();
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

// Renderizar el mini odontograma
function renderMiniOdontograma() {
  const container = document.getElementById('mini-odonto-content');
  if (!container) return;
  const teethSet = showAdultTeeth ? adultTeeth : childTeeth;

  const renderRow = (teeth, isUpper) => {
    return teeth.map((num, i) => {
      const offset = arcOffset(i, teeth.length, isUpper, showAdultTeeth);
      return renderMiniTooth(num, isUpper, offset);
    }).join('');
  };

  container.innerHTML = `
    <div class="mb-10 w-full">
      <div class="text-center mb-4">
        <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold text-white shadow-lg bg-gradient-to-r from-[#4EABBE] to-[#8BCFDD]">
          <span class="opacity-95">Arcada superior</span>
        </span>
      </div>
      <div class="odonto-row odonto-row-top">
        ${renderRow(teethSet.superior, true)}
      </div>
    </div>
    <div class="relative my-8">
      <div class="h-px bg-gradient-to-r from-transparent via-[#8BCFDD]/30 dark:via-slate-700 to-transparent"></div>
    </div>
    <div class="w-full">
      <div class="odonto-row odonto-row-bottom mb-4">
        ${renderRow(teethSet.inferior, false)}
      </div>
      <div class="text-center">
        <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold text-white shadow-lg bg-gradient-to-r from-[#4EABBE] to-[#8BCFDD]">
          <span class="opacity-95">Arcada inferior</span>
        </span>
      </div>
    </div>
  `;

  container.querySelectorAll('.mini-tooth-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.dataset.tooth, 10);
      handleToothClick(num);
    });
  });

  container.querySelectorAll('[data-plan-face]').forEach(faceEl => {
    faceEl.addEventListener('click', (event) => {
      event.stopPropagation();
      const num = parseInt(faceEl.getAttribute('data-tooth'), 10);
      const face = faceEl.getAttribute('data-plan-face');
      handleFaceClick(num, face);
    });
  });
}


function renderMiniTooth(num, isUpper, offset) {
  const status = odontoData.teethStatus[num];
  const dx = odontoData.diagnosticsState[num];
  const surfaces = status?.surfaces || {};
  const hasSurfaces = Object.values(surfaces).some(Boolean);
  const treatment = getPlanTreatmentVisual(status?.treatment, status?.color);
  const treatColor = treatment?.color || '';
  const isSelected = String(odontoData.selectedTooth || '') === String(num);
  const isMissing = status?.treatment === 'ausente' || dx?.tooth?.id === 'absent';
  const border = isSelected ? BRAND.primary : (treatColor || '#CBD5E1');
  const shadow = isSelected
    ? `0 0 0 4px ${BRAND.ring}, 0 16px 32px rgba(15,37,50,.14)`
    : treatColor
      ? `0 0 0 2px ${hexToRgba(treatColor, 0.18)}, 0 12px 24px rgba(15,37,50,.12)`
      : `0 8px 18px rgba(15,37,50,.08)`;
  const label = treatment?.name || '';
  const title = escapeAttr(`${getDiagnosisSummaryTitle(num)}${label ? ` | Tratamiento: ${label}` : ''}`);
  const selectedCls = isSelected ? 'shadow-ring' : '';

  const selection = getPlanSelectionState();
  const selectedFacesSet = selection.tooth === String(num) && selection.mode === 'face'
    ? new Set(selection.faces)
    : new Set();
  
  const mergedSurfaces = { ...(hasSurfaces ? surfaces : {}) };
  for(const f of selectedFacesSet) {
    mergedSurfaces[f] = true;
  }
  const hasMergedSurfaces = Object.values(mergedSurfaces).some(Boolean);

  const svg = createPlanToothSVG(num, isUpper, isSelected, treatColor, hasMergedSurfaces ? mergedSurfaces : null, isMissing);
  const geoHtml = renderMiniGeoCircle(num, dx);
  const baseBtn =
    `tooth-btn rounded-[24px] border-[2.5px] bg-white
     transition will-change-transform
     hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(15,37,50,.16)]
     dark:hover:shadow-[0_18px_40px_rgba(0,0,0,.35)]
     active:translate-y-0`;

  if (isUpper) {
    return `
      <div class="odonto-tooth odonto-tooth-upper flex flex-col items-center gap-3" style="transform: translateY(${offset}px);">
        ${renderToothDxHud(num, true)}
        <div class="tooth-number-badge">${num}</div>

        <button class="${baseBtn} ${selectedCls} mini-tooth-btn relative overflow-hidden"
          style="border-color:${border}; box-shadow:${shadow};"
          data-tooth="${num}" title="${title}" aria-label="${title}">
          <div class="tooth-shell">
            ${svg}
          </div>
        </button>

        ${geoHtml}
        ${renderToothQuickTag(num)}
      </div>
    `;
  }

  return `
    <div class="odonto-tooth odonto-tooth-lower flex flex-col items-center gap-3" style="transform: translateY(${offset}px);">
      ${renderToothDxHud(num, false)}
      ${geoHtml}

      <button class="${baseBtn} ${selectedCls} mini-tooth-btn relative overflow-hidden"
        style="border-color:${border}; box-shadow:${shadow};"
        data-tooth="${num}" title="${title}" aria-label="${title}">
        <div class="tooth-shell">
          ${svg}
        </div>
      </button>

      ${renderToothQuickTag(num)}
      <div class="tooth-number-badge">${num}</div>
    </div>
  `;
}

function handleToothClick(num) {
  const dx = odontoData.diagnosticsState[num];
  const hasDiagnosis = dx && (dx.tooth || (dx.faces && Object.keys(dx.faces).length > 0));

  if (!hasDiagnosis) {
    showToast("Solo se pueden planificar tratamientos en dientes con diagnóstico.", "error");
    return;
  }

  const selection = { tooth: String(num), faces: [], mode: 'tooth' };
  setPlanTargetSelection(selection);
  openNewPlanModalWithSelection(selection);
}

function openNewPlanModalWithTooth(num) {
  return openNewPlanModalWithSelection({ tooth: String(num), faces: [], mode: 'tooth' });

  // Personalizar modal
  const form = document.getElementById('form-plan');
  if (form) {
    // Buscar si hay diagnósticos para este diente para pre-llenar notas
    const dx = odontoData.diagnosticsState[num];
    let notas = `Tratamiento para pieza ${num}.`;

    if (dx) {
      if (dx.tooth) notas += ` Diagnóstico: ${dx.tooth.id}.`;
      if (dx.faces) {
        const faces = Object.keys(dx.faces).join(', ');
        if (faces) notas += ` Caras afectadas: ${faces}.`;
      }
    }

    document.getElementById('plan-notas').value = notas;

    // Sugerir tratamiento basado en Diagnostico?
    // (Opcional: lógica de mapeo simple)
    const select = document.getElementById('select-tratamiento');
    if (select && dx) {
      // Ejemplo: Si hay caries, sugerir Restauracion si existe en el select
      const options = Array.from(select.options);
      if (dx.faces && Object.keys(dx.faces).length > 0) {
        const rest = options.find(o => o.text.toLowerCase().includes('restauraci'));
        if (rest) select.value = rest.value;
      } else if (dx.tooth && dx.tooth.id === 'absent') {
        const implante = options.find(o => o.text.toLowerCase().includes('implante') || o.text.toLowerCase().includes('puente'));
        if (implante) select.value = implante.value;
      }

      // Disparar evento change para actualizar costos
      if (select.value) {
        select.dispatchEvent(new Event('change'));
      }
    }
  }
}

function handleFaceClick(num, face) {
  const dx = odontoData.diagnosticsState[num];
  if (!dx?.faces?.[face]) {
    showToast("Selecciona una cara que tenga un problema diagnosticado.", "error");
    return;
  }

  const selection = { tooth: String(num), faces: [face], mode: 'face' };
  setPlanTargetSelection(selection);
  openNewPlanModalWithSelection(selection);
}

async function openNewPlanModalWithSelection(selection) {
  await openNewPlanModal();
  setPlanTargetSelection(selection, { rerender: true, syncForm: true });

  const form = document.getElementById('form-plan');
  if (!form) return;

  document.getElementById('plan-notas').value = buildPlanNotesFromSelection(selection);
  suggestTreatmentFromSelection(selection);
}

// Inicializar
async function init() {
  currentPacienteId = getQueryParam('paciente_id') || getQueryParam('id');
  if (!currentPacienteId) return;

  try {
    const paciente = await dbGet('SELECT fecha_nacimiento FROM pacientes WHERE id = ?', [currentPacienteId]);
    const edad = calculateAgeYears(paciente?.fecha_nacimiento);
    if (edad !== null) showAdultTeeth = edad >= 12;
  } catch (e) {
    console.error('Error loading patient age:', e);
  }

  // Setup event listeners
  document.getElementById('add-plan-btn')?.addEventListener('click', openNewPlanModal);
  document.getElementById('close-modal-plan')?.addEventListener('click', closeModalPlan);
  document.getElementById('cancel-plan')?.addEventListener('click', closeModalPlan);
  document.getElementById('clear-plan-target')?.addEventListener('click', () => clearPlanTargetSelection());
  document.getElementById('form-plan')?.addEventListener('submit', savePlan);
  document.getElementById('plan-descuento-tipo')?.addEventListener('change', recalculateFinancialPreview);
  document.getElementById('plan-descuento-valor')?.addEventListener('input', recalculateFinancialPreview);
  document.getElementById('plan-impuesto-tipo')?.addEventListener('change', recalculateFinancialPreview);
  document.getElementById('plan-impuesto-valor')?.addEventListener('input', recalculateFinancialPreview);
  document.getElementById('plan-financiar')?.addEventListener('change', updateFinancingVisibility);
  document.getElementById('plan-anticipo')?.addEventListener('input', recalculateFinancialPreview);

  // Searchable dropdown listeners
  const searchInput = document.getElementById('search-tratamiento');
  const dropdownList = document.getElementById('tratamiento-dropdown');
  const btnAdd = document.getElementById('btn-add-tratamiento');
  
  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      dropdownList?.classList.remove('hidden');
      renderTratamientoDropdown(searchInput.value);
    });
    
    searchInput.addEventListener('input', (e) => {
      dropdownList?.classList.remove('hidden');
      renderTratamientoDropdown(e.target.value);
      // Clear hidden input if user types
      const hiddenInput = document.getElementById('select-tratamiento');
      if (hiddenInput && hiddenInput.value) {
        hiddenInput.value = '';
        onTratamientoSelected({ target: { value: '' } });
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      const container = document.getElementById('tratamiento-dropdown-container');
      if (container && !container.contains(e.target)) {
        dropdownList?.classList.add('hidden');
      }
    });
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      const term = document.getElementById('add-tratamiento-term')?.textContent || '';
      if (term) {
        addNuevoTratamiento(term);
      }
    });
  }

  // Load initial data
  await loadPlanesPendientes();
  await loadOdontogramData();
}

// Make functions globally available
window.changeEstado = changeEstado;

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
window.closeModalPago = () => {
  const modal = document.getElementById('modal-pago');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.abrirModalPago = (planId, cuotaId, maxMonto, cuotaDesc) => {
  const modal = document.getElementById('modal-pago');
  const form = document.getElementById('form-pago');
  
  if (!modal || !form) return;

  form.reset();
  
  document.getElementById('pago-plan-id').value = planId;
  document.getElementById('pago-cuota-id').value = cuotaId;
  document.getElementById('pago-cuota-info').textContent = `${cuotaDesc} • Pendiente: ${formatCurrency(maxMonto)}`;
  
  const montoInput = document.getElementById('pago-monto');
  montoInput.value = maxMonto;
  montoInput.max = maxMonto;
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

document.getElementById('close-modal-pago')?.addEventListener('click', window.closeModalPago);
document.getElementById('cancel-pago')?.addEventListener('click', window.closeModalPago);

document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submit-pago-btn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Procesando...';
  submitBtn.disabled = true;

  try {
    const sessionStr = localStorage.getItem('sesionActual') || sessionStorage.getItem('sesionActual');
    const session = sessionStr ? JSON.parse(sessionStr) : {};
    const userId = session.id || session.usuario_id || session.user_id;

    if (!userId) {
      throw new Error("No se pudo validar la sesión del usuario. Cierra sesión y vuelve a entrar.");
    }

    const payload = {
      paciente_id: Number(currentPacienteId),
      usuario_id: userId,
      user_id: userId,
      monto: parseFloat(document.getElementById('pago-monto').value || 0),
      metodo: document.getElementById('pago-metodo').value,
      plan_tratamiento_id: document.getElementById('pago-plan-id').value,
      cuota_financiamiento_id: document.getElementById('pago-cuota-id').value,
      descripcion: document.getElementById('pago-descripcion').value.trim()
    };

    if (!window.api || !window.api.finance) {
      throw new Error("API de finanzas no disponible.");
    }

    await window.api.finance.registerPayment(payload);
    
    showToast('Abono registrado correctamente', 'success');
    window.closeModalPago();
    await loadPlanesPendientes(); // Recargar la lista de planes para reflejar el pago
  } catch (error) {
    console.error('Error al registrar abono:', error);
    let msg = error.message || 'Error al procesar el pago';
    if (msg.toLowerCase().includes('caja propia') || msg.toLowerCase().includes('abrir una caja')) {
      msg = '¡Caja cerrada! Debes abrir una caja en la sección de Cajas antes de poder registrar pagos.';
    }
    showToast(msg, 'error');
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});
