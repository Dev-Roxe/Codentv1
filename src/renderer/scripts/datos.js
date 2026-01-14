// datos.js
// Manejo de la pestaña de datos básicos del paciente.

let db = (window.api && window.api.db) ? window.api.db : null;

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
  return params.get(name);
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
  const id = getQueryParam('id');
  if (!id) return;
  currentPaciente = await loadPaciente(id);
  if (!currentPaciente) return;
  const form = document.getElementById('form-datos');
  const meta = (() => { try { return JSON.parse(currentPaciente.meta || '{}'); } catch (e) { return {}; } })();
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
    ['nombre_social','curp','convenio','numero_interno','profesion','empleador','observaciones'].forEach(k => {
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