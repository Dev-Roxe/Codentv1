// antecedentes.js
// Lógica de la pestaña de antecedentes clínicos cargada en un iframe.

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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return resolve([]);
      if (db.all.length >= 3) {
        db.all(sql, params, (err, rows) => { if (err) return reject(err); resolve(rows || []); });
      } else {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
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
let selectedPadecimientos = [];

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
  await setupAntecedentes();
}

async function setupAntecedentes() {
  // Cargar datos existentes
  try {
    const row = await dbGet('SELECT * FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]);
    if (row) {
      const form = document.getElementById('form-antecedentes-ficha');
      form.alergias.value = row.alergias || '';
      form.enfermedades.value = row.enfermedades || '';
      form.medicamentos.value = row.medicamentos || '';
      form.tipo_sangre.value = row.tipo_sangre || '';
      form.observaciones.value = row.observaciones || '';
      try {
        selectedPadecimientos = row.padecimientos ? JSON.parse(row.padecimientos) : [];
      } catch (e) {
        selectedPadecimientos = [];
      }
    }
    await loadPadecimientosList();
    await loadTimeline();
  } catch (err) {
    console.error('Error cargando antecedentes', err);
  }
  // Guardar antecedentes
  document.getElementById('save-antecedentes-ficha').addEventListener('click', async () => {
    const form = document.getElementById('form-antecedentes-ficha');
    const data = {
      alergias: form.alergias.value || '',
      enfermedades: form.enfermedades.value || '',
      medicamentos: form.medicamentos.value || '',
      tipo_sangre: form.tipo_sangre.value || '',
      observaciones: form.observaciones.value || '',
      padecimientos: JSON.stringify(selectedPadecimientos)
    };
    try {
      const exists = await dbGet('SELECT id FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]);
      if (exists) {
        await dbRun('UPDATE antecedentes_clinicos SET alergias = ?, enfermedades = ?, medicamentos = ?, tipo_sangre = ?, observaciones = ?, padecimientos = ? WHERE paciente_id = ?',
          [data.alergias, data.enfermedades, data.medicamentos, data.tipo_sangre, data.observaciones, data.padecimientos, currentPaciente.id]);
      } else {
        await dbRun('INSERT INTO antecedentes_clinicos (paciente_id, alergias, enfermedades, medicamentos, tipo_sangre, observaciones, padecimientos) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [currentPaciente.id, data.alergias, data.enfermedades, data.medicamentos, data.tipo_sangre, data.observaciones, data.padecimientos]);
      }
      alert('Antecedentes guardados');
      await loadTimeline();
    } catch (e) {
      console.error(e);
      alert('Error guardando antecedentes: ' + (e && e.message));
    }
  });
  // Añadir padecimiento
  document.getElementById('btn-add-padecimiento').addEventListener('click', async () => {
    const input = document.getElementById('new-padecimiento');
    const val = input.value.trim();
    if (!val) return;
    try {
      await dbRun('INSERT INTO padecimientos_default (nombre) VALUES (?)', [val]);
      input.value = '';
      await loadPadecimientosList();
    } catch (e) {
      console.error(e);
      alert('Error al agregar (posible duplicado)');
    }
  });
}

async function loadPadecimientosList() {
  const listContainer = document.getElementById('lista-padecimientos');
  if (!listContainer) return;
  try {
    const defaults = await dbAll('SELECT * FROM padecimientos_default ORDER BY nombre ASC');
    listContainer.innerHTML = '';
    if (defaults.length === 0) {
      listContainer.innerHTML = '<p class="text-xs text-gray-400">No hay padecimientos registrados.</p>';
    }
    defaults.forEach(p => {
      const isChecked = selectedPadecimientos.includes(p.nombre);
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between group';
      div.innerHTML = `
        <label class="flex items-center gap-2 cursor-pointer flex-1">
          <input type="checkbox" value="${p.nombre}" ${isChecked ? 'checked' : ''} class="text-[#4EABBE] focus:ring-[#4EABBE] rounded border-gray-300 dark:border-gray-500 dark:bg-gray-600">
          <span class="text-sm text-gray-700 dark:text-gray-200">${p.nombre}</span>
        </label>
        <button class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1" title="Eliminar de la lista">×</button>
      `;
      const checkbox = div.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedPadecimientos.includes(p.nombre)) selectedPadecimientos.push(p.nombre);
        } else {
          selectedPadecimientos = selectedPadecimientos.filter(x => x !== p.nombre);
        }
      });
      const deleteBtn = div.querySelector('button');
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar "${p.nombre}" de la lista de opciones?`)) return;
        try {
          await dbRun('DELETE FROM padecimientos_default WHERE id = ?', [p.id]);
          await loadPadecimientosList();
        } catch (e) {
          console.error(e);
          alert('Error al eliminar');
        }
      });
      listContainer.appendChild(div);
    });
  } catch (e) {
    console.error('Error loading padecimientos defaults', e);
    listContainer.innerHTML = '<p class="text-xs text-red-400">Error al cargar lista.</p>';
  }
}

async function loadTimeline() {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  try {
    const events = [];
    if (currentPaciente.fecha_registro) {
      events.push({
        date: new Date(currentPaciente.fecha_registro),
        title: 'Paciente Registrado',
        desc: 'Alta en el sistema',
        color: 'bg-blue-100 text-blue-600'
      });
    }
    const tratamientos = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? ORDER BY fecha DESC', [currentPaciente.id]);
    tratamientos.forEach(t => {
      const isReceta = t.procedimiento.startsWith('Receta:');
      events.push({
        date: new Date(t.fecha),
        title: t.procedimiento,
        desc: t.notas || (isReceta ? 'Receta médica generada' : 'Tratamiento realizado'),
        color: isReceta ? 'bg-green-100 text-green-600' : 'bg-[#4EABBE]/20 text-[#1D5D69]'
      });
    });
    events.sort((a,b) => b.date - a.date);
    if (events.length === 0) {
      container.innerHTML = '<p class="text-gray-400 pl-4">No hay eventos registrados.</p>';
      return;
    }
    container.innerHTML = events.map(e => `
      <div class="relative pl-8 group">
        <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full ${e.color} border-2 border-white dark:border-gray-800 shadow-sm"></div>
        <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 mb-1">
          <span class="text-sm font-bold text-gray-800 dark:text-gray-200">${e.title}</span>
          <span class="text-xs text-gray-400 font-medium">${e.date.toLocaleDateString()} ${e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">${e.desc}</p>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error loading timeline', e);
    container.innerHTML = '<p class="text-red-500 pl-4">Error cargando línea de tiempo.</p>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}