// pacientes.js — Renderer script limpio y consistente
// - Configuración de campos (show + required) guardada en admin_config
// - Formularios dinámicos según configuración
// - Guarda campos extra en columna `meta` como JSON

let db;

// Intentar usar wrapper expuesto por preload (soporta callback o promise)
if (window.api && window.api.db) db = window.api.db;

// Lista maestra de campos
const masterFields = [
  { key: 'nombre', label: 'Nombre legal', type: 'text', mapTo: 'nombre' },
  { key: 'nombre_social', label: 'Nombre social', type: 'text', mapTo: 'meta' },
  { key: 'apellido', label: 'Apellidos', type: 'text', mapTo: 'apellido' },
  { key: 'curp', label: 'CURP/RFC', type: 'text', mapTo: 'meta' },
  { key: 'email', label: 'Email', type: 'email', mapTo: 'email' },
  { key: 'convenio', label: 'Convenio', type: 'text', mapTo: 'meta' },
  { key: 'numero_interno', label: 'Numero Interno', type: 'text', mapTo: 'meta' },
  { key: 'sexo', label: 'Sexo', type: 'text', mapTo: 'meta' },
  { key: 'genero', label: 'Genero', type: 'text', mapTo: 'meta' },
  { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', type: 'date', mapTo: 'fecha_nacimiento' },
  { key: 'ciudad', label: 'Ciudad', type: 'text', mapTo: 'meta' },
  { key: 'delegacion', label: 'Delegación', type: 'text', mapTo: 'meta' },
  { key: 'direccion', label: 'Dirección', type: 'text', mapTo: 'direccion' },
  { key: 'telefono', label: 'Teléfono', type: 'tel', mapTo: 'telefono' },
  { key: 'actividad', label: 'Actividad', type: 'text', mapTo: 'meta' },
  { key: 'profesion', label: 'Profesión', type: 'text', mapTo: 'meta' },
  { key: 'empleador', label: 'Empleador', type: 'text', mapTo: 'meta' },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea', mapTo: 'meta' },
  { key: 'apoderado', label: 'Apoderado', type: 'text', mapTo: 'meta' }
];

// fieldConfig: { key: { show: boolean, required: boolean }, ... }
let fieldConfig = {};

function isShown(key) { return !!(fieldConfig[key] && fieldConfig[key].show); }
function isRequired(key) { return !!(fieldConfig[key] && fieldConfig[key].required); }

// Helpers
const createEl = (tag, classes = '', html = '') => {
  const el = document.createElement(tag);
  if (classes) el.className = classes;
  if (html) el.innerHTML = html;
  return el;
};

// Cargar configuración desde admin_config (clave: required_fields_paciente)
function loadConfig(cb) {
  const applyDefaults = () => {
    masterFields.forEach(f => { if (!fieldConfig[f.key]) fieldConfig[f.key] = { show: false, required: false }; });
    // nombre y apellido siempre visibles y requeridos por la DB
    fieldConfig['nombre'] = Object.assign({ show: true, required: true }, fieldConfig['nombre']);
    fieldConfig['apellido'] = Object.assign({ show: true, required: true }, fieldConfig['apellido']);
  };

  if (!db) { applyDefaults(); if (typeof cb === 'function') cb(); return; }

  const clave = 'required_fields_paciente';
  try {
    if (db.get.length >= 3) {
      db.get("SELECT valor FROM admin_config WHERE clave = ?", [clave], (err, row) => {
        if (!err && row && row.valor) {
          try {
            const parsed = JSON.parse(row.valor);
            if (Array.isArray(parsed)) {
              // formato legacy: array de claves -> marcar show+required
              fieldConfig = {};
              parsed.forEach(k => { fieldConfig[k] = { show: true, required: true }; });
            } else if (typeof parsed === 'object' && parsed !== null) {
              fieldConfig = parsed;
            }
          } catch (e) { fieldConfig = {}; }
        }
        applyDefaults(); if (typeof cb === 'function') cb();
      });
    } else {
      db.get("SELECT valor FROM admin_config WHERE clave = ?", [clave]).then(row => {
        if (row && row.valor) {
          try {
            const parsed = JSON.parse(row.valor);
            if (Array.isArray(parsed)) {
              fieldConfig = {};
              parsed.forEach(k => { fieldConfig[k] = { show: true, required: true }; });
            } else if (typeof parsed === 'object' && parsed !== null) {
              fieldConfig = parsed;
            }
          } catch (e) { fieldConfig = {}; }
        }
        applyDefaults(); if (typeof cb === 'function') cb();
      }).catch(() => { applyDefaults(); if (typeof cb === 'function') cb(); });
    }
  } catch (e) { applyDefaults(); if (typeof cb === 'function') cb(); }
}

// Guardar configuración (objeto fieldConfig) en admin_config
function saveFieldConfig(newConfig, cb) {
  const clave = 'required_fields_paciente';
  const valor = JSON.stringify(newConfig);
  const sql = `INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)`;

  if (!db) { fieldConfig = newConfig; if (typeof cb === 'function') cb(null); return; }

  try {
    if (db.run.length >= 3) {
      db.run(sql, [clave, valor], (err) => { if (!err) fieldConfig = newConfig; if (typeof cb === 'function') cb(err); });
    } else {
      db.run(sql, [clave, valor]).then(() => { fieldConfig = newConfig; if (typeof cb === 'function') cb(null); }).catch(cb);
    }
  } catch (e) { if (typeof cb === 'function') cb(e); }
}

// Render principal
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const header = createEl('div', 'flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4');
  header.innerHTML = `
    <div>
      <h1 class="text-4xl font-bold text-gray-900">Pacientes</h1>
      <p class="text-gray-600 mt-1 text-sm">Gestiona la información de tus pacientes registrados.</p>
    </div>
    <div class="flex gap-3">
      <button id="configBtn" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition">Configuración</button>
      <button id="newPatientBtn" class="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium shadow-md">Nuevo Paciente</button>
    </div>
  `;

  const tableContainer = createEl('div', 'bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden');
  const table = createEl('table', 'w-full text-sm');
  const thead = createEl('thead', 'bg-cyan-600 text-white');
  thead.innerHTML = `
    <tr>
      <th class="py-3 px-6 text-left font-semibold">#</th>
      <th class="py-3 px-6 text-left font-semibold">Nombre</th>
      <th class="py-3 px-6 text-left font-semibold">Apellidos</th>
      <th class="py-3 px-6 text-left font-semibold">Teléfono</th>
      <th class="py-3 px-6 text-left font-semibold">Email</th>
    </tr>`;
  const tbody = createEl('tbody'); tbody.id = 'patients-list-body';
  table.append(thead, tbody); tableContainer.appendChild(table);

  const profileContainer = createEl('div', 'hidden mt-6', ''); profileContainer.id = 'patient-profile';
  app.append(header, tableContainer, profileContainer);

  document.getElementById('configBtn').addEventListener('click', toggleConfigModal);
  document.getElementById('newPatientBtn').addEventListener('click', showNewPatientModal);

  // Cargar configuración y pacientes
  loadConfig(() => loadPatients());
}

// Cargar pacientes
function loadPatients() {
  if (!db) return;
  const tbody = document.getElementById('patients-list-body');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando...</td></tr>';

  db.all("SELECT * FROM pacientes ORDER BY id DESC", [], (err, rows) => {
    if (err) { console.error(err); tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error al cargar pacientes</td></tr>'; return; }
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No hay pacientes registrados</td></tr>'; return; }

    rows.forEach(p => {
      const row = createEl('tr', 'border-b border-gray-100 hover:bg-cyan-50 cursor-pointer transition');
      row.innerHTML = `
        <td class="py-3 px-6">${p.id}</td>
        <td class="py-3 px-6 font-medium">${p.nombre}</td>
        <td class="py-3 px-6">${p.apellido}</td>
        <td class="py-3 px-6">${p.telefono || '-'}</td>
        <td class="py-3 px-6">${p.email || '-'}</td>`;
      // Navegar a la ficha clínica (vista completa) con query param id
      row.addEventListener('click', () => { window.location.href = `ficha_clinica.html?id=${p.id}`; });
      tbody.appendChild(row);
    });
  });
}

// Mostrar perfil (simplificado)
function showProfile(p) {
  const profile = document.getElementById('patient-profile');
  profile.innerHTML = `
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        <div class="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white p-6 flex justify-between items-start">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-white/30">${p.name.charAt(0)}${p.lastname.charAt(0)}</div>
            <div><h2 class="text-2xl font-bold">${p.name} ${p.lastname}</h2><div class="flex gap-3 text-cyan-100 text-sm mt-1"><span>${p.email}</span><span>${p.phone}</span></div></div>
          </div>
          <button onclick="document.getElementById('patient-profile').classList.add('hidden')" class="text-white/70">Cerrar</button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 bg-gray-50">Ficha del paciente...</div>
      </div>
    </div>`;
  profile.classList.remove('hidden');
}

// Config modal
function toggleConfigModal() {
  let modal = document.getElementById('config-modal');
  if (!modal) { modal = createConfigModal(); document.body.appendChild(modal); modal.classList.remove('hidden'); return; }
  const isHidden = modal.classList.contains('hidden');
  if (isHidden) { loadConfig(() => { renderChecklist(modal); modal.classList.remove('hidden'); }); }
  else modal.classList.add('hidden');
}

function createConfigModal() {
  const modal = createEl('div', 'hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4'); modal.id = 'config-modal';
  const inner = createEl('div', 'bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden');
  inner.innerHTML = `
    <div class="bg-cyan-600 text-white p-5 flex justify-between items-center"><h2 class="text-xl font-semibold">Configuración de Campos</h2><button id="close-config" class="p-1">X</button></div>
    <div class="p-6 max-h-[70vh] overflow-y-auto"><p class="text-gray-600 mb-4 text-sm">Para cada campo: Mostrar y Requerido</p><div id="config-checklist" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"></div></div>
    <div class="p-4 bg-gray-50 border-t flex justify-end gap-3"><button id="cancel-config" class="px-5 py-2">Cancelar</button><button id="save-config" class="px-5 py-2 bg-cyan-600 text-white">Guardar</button></div>`;
  modal.appendChild(inner);
  // render inicial
  renderChecklist(inner);

  // close handlers
  inner.querySelector('#close-config').addEventListener('click', () => modal.remove());
  inner.querySelector('#cancel-config').addEventListener('click', () => modal.remove());
  inner.querySelector('#save-config').addEventListener('click', () => {
    // construir newConfig desde inputs
    const checklist = inner.querySelector('#config-checklist');
    const newConfig = {};
    masterFields.forEach(f => { newConfig[f.key] = { show: false, required: false }; });
    Array.from(checklist.querySelectorAll('.field-row')).forEach(row => {
      const key = row.getAttribute('data-key');
      const show = !!row.querySelector('input[name="show-' + key + '"]')?.checked;
      const required = !!row.querySelector('input[name="req-' + key + '"]')?.checked;
      newConfig[key] = { show, required };
    });
    saveFieldConfig(newConfig, (err) => { if (err) alert('Error guardando configuración: ' + err.message); else modal.remove(); });
  });

  // overlay close
  modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
  return modal;
}

function renderChecklist(containerEl) {
  let container = null;
  if (containerEl instanceof HTMLElement) container = containerEl.querySelector('#config-checklist') || containerEl;
  else container = document.getElementById('config-checklist');
  if (!container) return;

  // Asegurarse de tener configuración cargada
  loadConfig(() => {
    container.innerHTML = masterFields.map(f => {
      const cfg = fieldConfig[f.key] || { show: false, required: false };
      return `
        <div class="field-row border p-3 rounded-lg" data-key="${f.key}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3"><strong>${f.label}</strong></div>
            <div class="flex items-center gap-3">
              <label class="text-sm"><input type="checkbox" name="show-${f.key}" ${cfg.show ? 'checked' : ''}> Mostrar</label>
              <label class="text-sm"><input type="checkbox" name="req-${f.key}" ${cfg.required ? 'checked' : ''}> Requerido</label>
            </div>
          </div>
        </div>`;
    }).join('');
  });
}

// Nuevo Paciente — mostrar sólo los campos con show=true (nombre/apellido siempre)
function showNewPatientModal() {
  loadConfig(() => {
    const visibleFields = masterFields.filter(f => f.key === 'nombre' || f.key === 'apellido' || isShown(f.key));
    const rows = visibleFields.map(f => {
      const required = isRequired(f.key) ? 'required' : '';
      if (f.type === 'textarea') return `<div class="md:col-span-2"><label class="block text-sm font-medium mb-1">${f.label} ${required ? '*' : ''}</label><textarea name="${f.key}" ${required} rows="3" class="w-full p-3 border rounded"></textarea></div>`;
      return `<div><label class="block text-sm font-medium mb-1">${f.label} ${required ? '*' : ''}</label><input type="${f.type}" name="${f.key}" ${required} class="w-full p-3 border rounded"></div>`;
    }).join('');

    const modalHtml = `
      <div id="new-patient-modal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div class="bg-cyan-600 text-white p-6 flex justify-between items-center sticky top-0"><h2 class="text-2xl">Registrar Nuevo Paciente</h2><button id="close-new">X</button></div>
          <form id="form-new-patient" class="p-6 space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${rows}
            </div>
            <div class="flex justify-end gap-3"><button type="button" id="cancel-new" class="px-4 py-2">Cancelar</button><button type="submit" class="px-4 py-2 bg-cyan-600 text-white">Guardar Paciente</button></div>
          </form>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('new-patient-modal');
    const close = () => { if (modalEl) modalEl.remove(); window.removeEventListener('keydown', onEsc); };
    const onEsc = (ev) => { if (ev.key === 'Escape') close(); };
    modalEl.addEventListener('click', (ev) => { if (ev.target === modalEl) close(); });
    document.getElementById('close-new').addEventListener('click', close);
    document.getElementById('cancel-new').addEventListener('click', close);
    window.addEventListener('keydown', onEsc);

    document.getElementById('form-new-patient').addEventListener('submit', (e) => { e.preventDefault(); savePatient(e.target); });
  });
}

// Guardar paciente — mapear columnas core y meta
function savePatient(form) {
  if (!db) return alert('Error: Base de datos no conectada');

  // core columns supported by DB
  const core = { nombre: '', apellido: '', telefono: null, email: null, direccion: null, fecha_nacimiento: null };
  const meta = {};

  masterFields.forEach(f => {
    const el = form[f.key];
    const val = el ? el.value : '';
    if (f.mapTo && f.mapTo !== 'meta') core[f.mapTo] = val || core[f.mapTo];
    if (f.mapTo === 'meta') meta[f.key] = val || '';
  });

  const sql = `INSERT INTO pacientes (nombre, apellido, telefono, email, direccion, fecha_nacimiento, meta) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [core.nombre, core.apellido, core.telefono, core.email, core.direccion, core.fecha_nacimiento || null, JSON.stringify(meta)];

  try {
    if (db.run.length >= 3) {
      db.run(sql, params, function(err) { if (err) return alert('Error al guardar paciente: ' + err.message); const modal = document.getElementById('new-patient-modal'); if (modal) modal.remove(); loadPatients(); });
    } else {
      db.run(sql, params).then(() => { const modal = document.getElementById('new-patient-modal'); if (modal) modal.remove(); loadPatients(); }).catch(err => alert('Error al guardar paciente: ' + err.message));
    }
  } catch (e) { alert('Error al guardar paciente: ' + (e && e.message)); }
}

// Inicializar
document.addEventListener('DOMContentLoaded', renderApp);
