// datos.js
// Manejo de la pestaña de datos básicos del paciente.

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}

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

async function loadPaciente(id) {
  try {
    const row = await dbGet('SELECT * FROM pacientes WHERE id = ?', [id]);
    return row || null;
  } catch (e) {
    console.error('loadPaciente error', e);
    return null;
  }
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

  const meta = (() => { try { return JSON.parse(currentPaciente.meta || '{}'); } catch (e) { return {}; } })();
  console.log('[datos.js] Patient meta data:', meta);

  // Poblar formulario
  form.nombre.value = currentPaciente.nombre || '';
  form.apellido.value = currentPaciente.apellido || '';
  form.telefono.value = currentPaciente.telefono || '';
  form.email.value = currentPaciente.email || '';
  form.direccion.value = currentPaciente.direccion || '';
  form.fecha_nacimiento.value = currentPaciente.fecha_nacimiento || '';
  form.nombre_social.value = meta.nombre_social || '';
  form.curp.value = meta.curp || '';
  form.convenio.value = meta.convenio || '';
  form.numero_interno.value = meta.numero_interno || '';
  form.profesion.value = meta.profesion || '';
  form.empleador.value = meta.empleador || '';
  form.observaciones.value = meta.observaciones || '';

  console.log('[datos.js] Form populated successfully');

  // Guardar
  document.getElementById('save-datos').addEventListener('click', async () => {
    const formData = new FormData(form);
    const core = {
      nombre: formData.get('nombre') || '',
      apellido: formData.get('apellido') || '',
      telefono: formData.get('telefono') || null,
      email: formData.get('email') || null,
      direccion: formData.get('direccion') || null,
      fecha_nacimiento: formData.get('fecha_nacimiento') || null
    };
    const newMeta = Object.assign({}, meta);
    ['nombre_social', 'curp', 'convenio', 'numero_interno', 'profesion', 'empleador', 'observaciones'].forEach(k => {
      newMeta[k] = formData.get(k) || '';
    });
    const sql = `UPDATE pacientes SET nombre = ?, apellido = ?, telefono = ?, email = ?, direccion = ?, fecha_nacimiento = ?, meta = ? WHERE id = ?`;
    const params = [core.nombre, core.apellido, core.telefono, core.email, core.direccion, core.fecha_nacimiento || null, JSON.stringify(newMeta), currentPaciente.id];
    try {
      await dbRun(sql, params);
      alert('Datos guardados correctamente');
    } catch (e) {
      console.error(e);
      alert('Error guardando datos: ' + (e && e.message));
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
