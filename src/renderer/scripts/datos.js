// datos.js
// Manejo de la pestaña de datos básicos del paciente.
import { generatePersonalFormHTML, PERSONAL_FIELDS } from './personal-form-ui.js';

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}
const patientsApi = window.api?.patients || window.parent?.api?.patients || null;
const META_FIELD_KEYS = [
  'nombre_social',
  'curp',
  'convenio',
  'numero_interno',
  'sexo',
  'ciudad',
  'delegacion',
  'actividad',
  'profesion',
  'empleador',
  'observaciones',
  'apoderado'
];

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve(null);
      if (db.get.length >= 3) {
        db.get(sql, params, (err, row) => { if (err) return reject(err); resolve(row); });
      } else {
        db.get(sql, params).then(row => resolve(row)).catch(reject);
      }
    } catch (e) { reject(e); }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return reject(new Error('DB no disponible'));
      if (db.run.length >= 3) {
        db.run(sql, params, function (err) { if (err) return reject(err); resolve(this); });
      } else {
        db.run(sql, params).then(res => resolve(res)).catch(reject);
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

let currentPaciente = null;
let lastFocusState = null;

function showFeedback(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  if (window.parent && typeof window.parent.showToast === 'function') {
    window.parent.showToast(message, type);
    return;
  }
  console[type === 'error' ? 'error' : 'log'](message);
}

function captureFocusState(form) {
  const active = document.activeElement;
  if (!active || !form?.contains(active) || !active.name) return null;

  return {
    name: active.name,
    selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
  };
}

function trackFormFocus(form) {
  if (!form || form.dataset.focusTracking === 'true') return;
  form.dataset.focusTracking = 'true';

  form.addEventListener('focusin', (event) => {
    const field = event.target;
    if (!field?.name || field.disabled) return;
    lastFocusState = {
      name: field.name,
      selectionStart: typeof field.selectionStart === 'number' ? field.selectionStart : null,
      selectionEnd: typeof field.selectionEnd === 'number' ? field.selectionEnd : null
    };
  });
}

function restoreFocusState(form, focusState) {
  if (!form || !focusState?.name) return;
  const field = form.elements?.namedItem?.(focusState.name) || form[focusState.name];
  if (!field || typeof field.focus !== 'function') return;

  requestAnimationFrame(() => {
    window.ensureAppFocus?.();
    field.focus({ preventScroll: true });
    if (typeof field.setSelectionRange === 'function'
      && focusState.selectionStart !== null
      && focusState.selectionEnd !== null) {
      field.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  });
}

async function loadPaciente(id) {
  try {
    const row = await dbGet('SELECT * FROM pacientes WHERE id = ?', [id]);
    return row || null;
  } catch (e) {
    console.error('loadPaciente error', e);
    return null;
  }
}

async function loadFieldConfig() {
  if (!patientsApi?.getFieldConfig) {
    return {
      nombre: { show: true, required: true },
      apellido: { show: true, required: true }
    };
  }

  try {
    const config = await patientsApi.getFieldConfig();
    return config && typeof config === 'object' ? config : {};
  } catch (error) {
    console.error('loadFieldConfig error', error);
    return {};
  }
}

function applyFieldConfig(form, config = {}) {
  const normalizedConfig = { ...config };
  normalizedConfig.nombre = { show: true, required: true, ...(normalizedConfig.nombre || {}) };
  normalizedConfig.apellido = { show: true, required: true, ...(normalizedConfig.apellido || {}) };

  form.querySelectorAll('[data-field]').forEach((fieldWrapper) => {
    const key = fieldWrapper.dataset.field;
    if (!key) return;

    const fieldConfig = normalizedConfig[key] || { show: false, required: false };
    const isCore = key === 'nombre' || key === 'apellido';
    const shouldShow = isCore || !!fieldConfig.show;
    const isRequired = isCore || !!fieldConfig.required;
    const control = fieldWrapper.querySelector('[name]');

    fieldWrapper.classList.toggle('hidden', !shouldShow);
    if (control) {
      control.required = shouldShow && isRequired;
      control.disabled = !shouldShow;
    }
  });
}

async function init() {
  console.log('[datos.js] Initializing...');

  const id = getQueryParam('id');
  console.log('[datos.js] Patient ID from URL:', id);

  if (!id) {
    console.error('[datos.js] No patient ID provided');
    return;
  }

  console.log('[datos.js] Loading patient data for ID:', id);
  currentPaciente = await loadPaciente(id);

  if (!currentPaciente) {
    console.error('[datos.js] Patient not found for ID:', id);
    return;
  }

  console.log('[datos.js] Patient loaded successfully:', currentPaciente);

  const form = document.getElementById('form-datos');
  if (!form) {
    console.error('[datos.js] Form not found!');
    return;
  }
  trackFormFocus(form);

  // Poblar formulario
  const container = document.getElementById('personal-data-container');
  if (container) {
    const fieldConfig = await loadFieldConfig();
    container.innerHTML = generatePersonalFormHTML(currentPaciente, fieldConfig);
    window.refreshDateInputs?.(form);
  }

  console.log('[datos.js] Form populated successfully');

  // Guardar
  document.getElementById('save-datos').addEventListener('click', async () => {
    const focusState = captureFocusState(form) || lastFocusState;
    const formData = new FormData(form);
    const payload = {
      id: currentPaciente.id,
      nombre: formData.get('nombre') || '',
      apellido: formData.get('apellido') || '',
      telefono: formData.get('telefono') || null,
      email: formData.get('email') || null,
      direccion: formData.get('direccion') || null,
      fecha_nacimiento: formData.get('fecha_nacimiento') || null
    };

    PERSONAL_FIELDS.forEach(f => {
      if (!['nombre', 'apellido', 'telefono', 'email', 'direccion', 'fecha_nacimiento'].includes(f.key)) {
        payload[f.key] = formData.get(f.key) || null;
      }
    });

    try {
      if (!patientsApi?.save) {
        throw new Error('API de pacientes no disponible');
      }

      await patientsApi.save(payload);
      showFeedback('Datos guardados correctamente', 'success');
      restoreFocusState(form, focusState);
    } catch (e) {
      console.error(e);
      showFeedback('Error guardando datos: ' + (e && e.message), 'error');
      restoreFocusState(form, focusState);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
