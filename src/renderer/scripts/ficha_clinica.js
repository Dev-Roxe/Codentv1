// ficha_clinica.js
// Vista dedicada para la ficha clínica tipo Dentalink
// Refactorizado para usar estructura HTML estática

let db = (window.api && window.api.db) ? window.api.db : null;
let currentPaciente = null;
let dienteSeleccionadoLocal = null; // Para odontograma

// --- DB Helpers ---
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

async function loadPaciente(id) {
  try {
    const row = await dbGet('SELECT * FROM pacientes WHERE id = ?', [id]);
    return row || null;
  } catch (e) {
    console.error('loadPaciente error', e);
    return null;
  }
}

// --- Initialization ---

async function init() {
  const app = document.getElementById('app');
  const id = getQueryParam('id');

  if (!id) {
    alert('ID de paciente no especificado.');
    window.location.href = 'pacientes.html';
    return;
  }

  currentPaciente = await loadPaciente(id);
  if (!currentPaciente) {
    alert('Paciente no encontrado.');
    window.location.href = 'pacientes.html';
    return;
  }

  // Populate Header
  document.getElementById('header-nombre').textContent = `${currentPaciente.nombre} ${currentPaciente.apellido}`;
  document.getElementById('header-id').textContent = currentPaciente.id;
  document.getElementById('header-fecha').textContent = currentPaciente.fecha_registro || 'N/A';

  // Setup Event Listeners
  document.getElementById('back-btn').addEventListener('click', () => { window.location.href = 'pacientes.html'; });

  document.getElementById('tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-tab]');
    if (b) switchTab(b.getAttribute('data-tab'));
  });

  // Initialize Tabs Logic
  setupDatosTab();
  setupAntecedentesTab();
  setupTratamientosTab();
  setupRecetasTab();
  setupOdontogramaTab();
  setupPeriodontogramaTab();

  // Show default tab
  switchTab('datos');
}

function switchTab(name) {
  // Hide all tabs
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));

  // Show selected tab
  const selectedTab = document.getElementById(`tab-${name}`);
  if (selectedTab) selectedTab.classList.remove('hidden');

  // Update button styles
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === name) {
      btn.className = 'tab-btn px-3 py-2 bg-cyan-50 dark:bg-cyan-900/30 rounded text-cyan-600 dark:text-cyan-400 whitespace-nowrap font-medium shadow-sm border border-cyan-100 dark:border-cyan-800 transition-colors';
    } else {
      btn.className = 'tab-btn px-3 py-2 rounded whitespace-nowrap hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors';
    }
  });

  // Load specific tab data if needed
  if (name === 'tratamientos') loadTratamientosList();
  if (name === 'recetas') loadRecetasList();
  if (name === 'antecedentes') loadTimeline(); // Refresh timeline
}

// --- Tab: Datos ---

function setupDatosTab() {
  const form = document.getElementById('form-datos');
  const meta = (() => { try { return JSON.parse(currentPaciente.meta || '{}'); } catch (e) { return {}; } })();

  // Populate form
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
    ['nombre_social', 'curp', 'convenio', 'numero_interno', 'profesion', 'empleador', 'observaciones'].forEach(k => { newMeta[k] = formData.get(k) || ''; });

    const sql = `UPDATE pacientes SET nombre = ?, apellido = ?, telefono = ?, email = ?, direccion = ?, fecha_nacimiento = ?, meta = ? WHERE id = ?`;
    const params = [core.nombre, core.apellido, core.telefono, core.email, core.direccion, core.fecha_nacimiento || null, JSON.stringify(newMeta), currentPaciente.id];

    try {
      await dbRun(sql, params);
      currentPaciente = await loadPaciente(currentPaciente.id);
      alert('Datos guardados correctamente');
    } catch (e) { console.error(e); alert('Error guardando datos: ' + (e && e.message)); }
  });
}

// --- Tab: Antecedentes ---

let selectedPadecimientos = [];

function setupAntecedentesTab() {
  // Load Antecedentes Data
  dbGet('SELECT * FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]).then(async row => {
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
  }).catch(err => console.error('Error cargando antecedentes', err));

  // Save Antecedentes
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
      loadTimeline(); // Refresh timeline
    } catch (e) { console.error(e); alert('Error guardando antecedentes: ' + (e && e.message)); }
  });

  // Add Padecimiento Logic
  document.getElementById('btn-add-padecimiento').addEventListener('click', async () => {
    const input = document.getElementById('new-padecimiento');
    const val = input.value.trim();
    if (!val) return;

    try {
      await dbRun('INSERT INTO padecimientos_default (nombre) VALUES (?)', [val]);
      input.value = '';
      loadPadecimientosList();
    } catch (e) {
      console.error(e);
      alert('Error al agregar (posible duplicado)');
    }
  });

  // Expose delete function globally
  window.deletePadecimientoDefault = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}" de la lista de opciones?`)) return;
    try {
      await dbRun('DELETE FROM padecimientos_default WHERE id = ?', [id]);
      loadPadecimientosList();
    } catch (e) {
      console.error(e);
      alert('Error al eliminar');
    }
  };
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
        <button class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1" title="Eliminar de la lista" onclick="deletePadecimientoDefault(${p.id}, '${p.nombre}')">
          ×
        </button>
      `;
      const checkbox = div.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedPadecimientos.includes(p.nombre)) selectedPadecimientos.push(p.nombre);
        } else {
          selectedPadecimientos = selectedPadecimientos.filter(x => x !== p.nombre);
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
        type: 'registro',
        title: 'Paciente Registrado',
        desc: 'Alta en el sistema',
        icon: '👤',
        color: 'bg-blue-100 text-blue-600'
      });
    }

    const tratamientos = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? ORDER BY fecha DESC', [currentPaciente.id]);
    tratamientos.forEach(t => {
      const isReceta = t.procedimiento.startsWith('Receta:');
      events.push({
        date: new Date(t.fecha),
        type: isReceta ? 'receta' : 'tratamiento',
        title: t.procedimiento,
        desc: t.notas || (isReceta ? 'Receta médica generada' : 'Tratamiento realizado'),
        icon: isReceta ? '💊' : '🦷',
        color: isReceta ? 'bg-green-100 text-green-600' : 'bg-[#4EABBE]/20 text-[#1D5D69]'
      });
    });

    events.sort((a, b) => b.date - a.date);

    if (events.length === 0) {
      container.innerHTML = '<p class="text-gray-400 pl-4">No hay eventos registrados.</p>';
      return;
    }

    container.innerHTML = events.map(e => `
      <div class="relative pl-8 group">
        <!--Dot -->
        <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full ${e.color} border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center text-[10px]">
        </div>
        <!--Content -->
        <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 mb-1">
          <span class="text-sm font-bold text-gray-800 dark:text-gray-200">${e.title}</span>
          <span class="text-xs text-gray-400 font-medium">${e.date.toLocaleDateString()} ${e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 group-hover:border-gray-200 dark:group-hover:border-gray-500 transition-colors">${e.desc}</p>
      </div>
    `).join('');

  } catch (e) {
    console.error('Error loading timeline', e);
    container.innerHTML = '<p class="text-red-500 pl-4">Error cargando línea de tiempo.</p>';
  }
}

// --- Tab: Tratamientos ---

function setupTratamientosTab() {
  document.getElementById('add-tratamiento-btn').addEventListener('click', openTratamientoModal);

  // Modal Logic
  const modal = document.getElementById('modal-tratamiento');
  const form = document.getElementById('form-tratamiento');
  const closeBtn = document.getElementById('close-modal-tratamiento');
  const cancelBtn = document.getElementById('cancel-tratamiento');

  const closeModal = () => {
    modal.classList.add('hidden');
    form.reset();
    document.getElementById('lista-receta-tratamiento').innerHTML = '';
    recetaTemp = [];
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Inventory Logic in Modal
  let recetaTemp = [];
  const select = document.getElementById('select-medicamento-tratamiento');
  const btnAdd = document.getElementById('btn-add-med-tratamiento');
  const list = document.getElementById('lista-receta-tratamiento');

  btnAdd.addEventListener('click', () => {
    const id = select.value;
    if (!id) return;
    const name = select.options[select.selectedIndex].dataset.nombre;
    const indicaciones = prompt(`Indicaciones para ${name}:`, 'Tomar cada 8 horas');
    if (indicaciones === null) return;

    recetaTemp.push({ id, name, indicaciones });
    renderRecetaTemp();
    select.value = '';
  });

  function renderRecetaTemp() {
    list.innerHTML = recetaTemp.map((r, i) => `
      <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded">
        <span>${r.name} <span class="text-xs text-gray-500">(${r.indicaciones})</span></span>
        <button type="button" class="text-red-500 hover:text-red-700" onclick="removeRecetaTemp(${i})">×</button>
      </div>
    `).join('');
  }

  window.removeRecetaTemp = (i) => {
    recetaTemp.splice(i, 1);
    renderRecetaTemp();
  };

  // Save Tratamiento
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const procedimiento = form.procedimiento.value;
    const diente = form.diente.value || null;
    const costo = form.costo.value || 0;
    let notas = form.notas.value || '';

    if (recetaTemp.length > 0) {
      notas += '\n\n[RECETA]\n' + recetaTemp.map(r => `- ${r.name}: ${r.indicaciones} `).join('\n');
    }

    try {
      await dbRun('INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas) VALUES (?, ?, ?, ?, ?)', [currentPaciente.id, diente, procedimiento, costo || null, notas]);

      // Update inventory stock
      for (const item of recetaTemp) {
        await dbRun('UPDATE medicamentos SET stock = stock - 1 WHERE id = ?', [item.id]);
      }

      closeModal();
      await loadTratamientosList();
      alert('Tratamiento guardado exitosamente');
    } catch (e) { console.error(e); alert('Error agregando tratamiento: ' + (e && e.message)); }
  });
}

async function openTratamientoModal() {
  const modal = document.getElementById('modal-tratamiento');
  const select = document.getElementById('select-medicamento-tratamiento');

  // Load inventory
  select.innerHTML = '<option value="">Seleccionar medicamento...</option>';
  const meds = await dbAll('SELECT * FROM medicamentos WHERE stock > 0 ORDER BY nombre ASC');
  meds.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.nombre} - Stock: ${m.stock}`;
    opt.dataset.nombre = m.nombre;
    select.appendChild(opt);
  });

  modal.classList.remove('hidden');
}

async function loadTratamientosList() {
  const list = document.getElementById('tratamientos-list');
  try {
    const rows = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND procedimiento NOT LIKE "Receta:%" ORDER BY fecha DESC', [currentPaciente.id]);

    if (rows.length === 0) {
      list.innerHTML = '<div class="p-8 text-center text-gray-500 dark:text-gray-400">No hay tratamientos registrados.</div>';
      return;
    }

    list.innerHTML = `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
            <th class="p-4 font-semibold">Fecha</th>
            <th class="p-4 font-semibold">Procedimiento</th>
            <th class="p-4 font-semibold">Diente</th>
            <th class="p-4 font-semibold">Costo</th>
            <th class="p-4 font-semibold">Notas</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          ${rows.map(r => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td class="p-4 text-sm text-gray-600 dark:text-gray-300">${new Date(r.fecha).toLocaleDateString()}</td>
              <td class="p-4 font-medium text-gray-800 dark:text-gray-200">${r.procedimiento}</td>
              <td class="p-4 text-sm text-gray-500 dark:text-gray-400">${r.diente || '-'}</td>
              <td class="p-4 text-sm font-mono text-gray-600 dark:text-gray-300">$${Number(r.costo).toFixed(2)}</td>
              <td class="p-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title="${r.notas || ''}">${r.notas || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p class="text-red-500 p-4">Error cargando tratamientos.</p>';
  }
}

// --- Tab: Recetas ---

function setupRecetasTab() {
  document.getElementById('btn-nueva-receta').addEventListener('click', openRecetaModal);

  const modal = document.getElementById('modal-receta');
  const closeBtn = document.getElementById('closeRecetaModal');
  const cancelBtn = document.getElementById('cancelReceta');
  const saveBtn = document.getElementById('saveReceta');
  const select = document.getElementById('select-medicamento-receta');
  const btnAdd = document.getElementById('btn-add-med-receta');
  const textarea = document.getElementById('receta-contenido');

  const closeModal = () => {
    modal.classList.add('hidden');
    textarea.value = '';
    select.value = '';
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  btnAdd.addEventListener('click', () => {
    const id = select.value;
    if (!id) return;
    const name = select.options[select.selectedIndex].dataset.nombre;
    textarea.value += `• ${name}: \n`;
    select.value = '';
    textarea.focus();
  });

  saveBtn.addEventListener('click', async () => {
    const contenido = textarea.value.trim();
    if (!contenido) return alert('La receta no puede estar vacía');

    try {
      await dbRun('INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas) VALUES (?, ?, ?, ?, ?)',
        [currentPaciente.id, null, 'Receta: General', 0, contenido]);
      alert('Receta guardada');
      closeModal();
      loadRecetasList();
    } catch (e) {
      console.error(e);
      alert('Error guardando receta');
    }
  });
}

async function openRecetaModal() {
  const modal = document.getElementById('modal-receta');
  const select = document.getElementById('select-medicamento-receta');

  select.innerHTML = '<option value="">Seleccionar medicamento...</option>';
  const meds = await dbAll('SELECT * FROM medicamentos WHERE stock > 0 ORDER BY nombre ASC');
  meds.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.nombre} - Stock: ${m.stock}`;
    opt.dataset.nombre = m.nombre;
    select.appendChild(opt);
  });

  modal.classList.remove('hidden');
}

async function loadRecetasList() {
  const list = document.getElementById('lista-recetas');
  try {
    const recetas = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND procedimiento LIKE "Receta:%" ORDER BY fecha DESC', [currentPaciente.id]);

    if (recetas.length === 0) {
      list.innerHTML = '<div class="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600"><p class="text-gray-500 dark:text-gray-400">No hay recetas registradas</p></div>';
      return;
    }

    list.innerHTML = recetas.map(r => `
      <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition flex justify-between items-start">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-[#1D5D69] dark:text-[#4EABBE]">${r.procedimiento.replace('Receta: ', '')}</span>
            <span class="text-xs text-gray-400">• ${new Date(r.fecha).toLocaleDateString()}</span>
          </div>
          <p class="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-line">${r.notas || ''}</p>
        </div>
        <button onclick="printReceta(${r.id})" class="text-gray-400 hover:text-[#4EABBE] transition" title="Imprimir">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        </button>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p class="text-red-500">Error cargando recetas</p>';
  }
}

window.printReceta = (id) => {
  alert('Funcionalidad de impresión pendiente de implementar para ID: ' + id);
};

// --- Tab: Odontograma ---

function setupOdontogramaTab() {
  const containerUpper = document.getElementById('arcadaSuperior');
  const containerLower = document.getElementById('arcadaInferior');

  const teethUpper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const teethLower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  // Render teeth
  teethUpper.forEach(n => crearDiente(n, containerUpper));
  teethLower.forEach(n => crearDiente(n, containerLower));

  // Setup Legend and Controls
  setupOdontogramaControls();

  // Load Data
  loadOdontogramaData();

  // Save Button
  document.getElementById('guardar-odontograma').addEventListener('click', saveOdontograma);
  document.getElementById('limpiar-odontograma').addEventListener('click', () => {
    if (confirm('¿Limpiar todo el odontograma?')) {
      dientes = {};
      dienteSeleccionadoLocal = null;
      document.getElementById("dienteSeleccionado").classList.add("hidden");

      [...teethUpper, ...teethLower].forEach(num => {
        actualizarDiente(num);
        const btn = document.getElementById(`diente-${num}`);
        if (btn) {
          btn.className = "w-10 h-14 md:w-12 md:h-14 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:scale-[1.05] transition relative";
          btn.innerHTML = "";
        }
      });

      // Reset buttons
      condiciones.forEach(c => {
        const b = document.getElementById(`btn-${c.id}`);
        if (b) {
          b.disabled = true;
          b.classList.add("opacity-50", "cursor-not-allowed");
          b.classList.remove("cursor-pointer");
        }
      });

      saveOdontograma();
    }
  });
}

// Global state for odontogram
let dientes = {};
const condiciones = [
  { id: 'sano', label: 'Sano', color: 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600' },
  { id: 'caries', label: 'Caries', color: 'bg-red-500 text-white' },
  { id: 'obturado', label: 'Obturado', color: 'bg-blue-500 text-white' },
  { id: 'ausente', label: 'Ausente', color: 'bg-gray-900 dark:bg-black text-white' },
  { id: 'corona', label: 'Corona', color: 'bg-yellow-500 text-white' },
  { id: 'endodoncia', label: 'Endodoncia', color: 'bg-purple-500 text-white' },
  { id: 'fractura', label: 'Fractura', color: 'bg-orange-500 text-white' },
  { id: 'implante', label: 'Implante', color: 'bg-green-500 text-white' }
];

function crearDiente(num, contenedor) {
  const d = document.createElement("div");
  d.className = "flex flex-col items-center";

  d.innerHTML = `
        <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">${num}</span>
        <button 
            id="diente-${num}"
            class="w-10 h-14 md:w-12 md:h-14 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:shadow-md hover:scale-[1.05] transition relative"
        ></button>
    `;

  // Add click listener programmatically to avoid global scope issues if possible, 
  // but for simplicity we can attach it to the button element directly
  const btn = d.querySelector('button');
  btn.onclick = () => seleccionarDiente(num);

  contenedor.appendChild(d);
}

function setupOdontogramaControls() {
  const btnContainer = document.getElementById('botonesCondiciones');
  const legendContainer = document.getElementById('leyenda');

  // Create Condition Buttons
  btnContainer.innerHTML = '';
  condiciones.forEach(c => {
    const b = document.createElement("button");
    b.id = `btn-${c.id}`;
    b.textContent = c.label;
    b.className = `w-full py-2 rounded-lg shadow-sm ${c.color} opacity-50 cursor-not-allowed text-xs md:text-sm font-medium border border-transparent`;
    if (c.id === 'sano') b.classList.add('text-gray-800', 'dark:text-white');

    b.onclick = () => aplicarCondicion(c.id);
    b.disabled = true;
    btnContainer.appendChild(b);
  });

  // Create Legend
  legendContainer.innerHTML = '';
  condiciones.forEach(c => {
    const item = document.createElement("div");
    item.className = "flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300";
    item.innerHTML = `
          <div class="w-5 h-5 rounded border ${c.color}"></div>
          ${c.label}
      `;
    legendContainer.appendChild(item);
  });
}

function seleccionarDiente(num) {
  dienteSeleccionadoLocal = num;

  const panel = document.getElementById("dienteSeleccionado");
  panel.classList.remove("hidden");
  document.getElementById("numeroDiente").textContent = num;

  // Reset selección visual
  document.querySelectorAll("[id^='diente-']").forEach(d => {
    d.classList.remove("ring-2", "ring-blue-400", "border-blue-600");
    // Restore default border if not selected (logic can be improved to not overwrite condition styles)
    // actually we just remove the selection ring
  });

  const btn = document.getElementById(`diente-${num}`);
  btn.classList.add("ring-2", "ring-blue-300", "border-blue-600");

  habilitarBotones();
}

function habilitarBotones() {
  condiciones.forEach(c => {
    const btn = document.getElementById(`btn-${c.id}`);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("opacity-50", "cursor-not-allowed");
      btn.classList.add("cursor-pointer", "hover:opacity-90");
    }
  });
}

function aplicarCondicion(id) {
  if (!dienteSeleccionadoLocal) return;

  dientes[dienteSeleccionadoLocal] = id;
  actualizarDiente(dienteSeleccionadoLocal);
}

function actualizarDiente(num) {
  const btn = document.getElementById(`diente-${num}`);
  if (!btn) return;

  const estado = dientes[num];
  const cond = condiciones.find(c => c.id === estado);

  // Base classes
  let classes = "w-10 h-14 md:w-12 md:h-14 border-2 rounded-lg hover:scale-[1.05] transition relative ";

  if (cond) {
    classes += cond.color;
  } else {
    classes += "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600";
  }

  btn.className = classes;

  if (estado === "ausente") {
    btn.innerHTML = `<div class="absolute inset-0 flex items-center justify-center">
            <div class="w-12 h-1 bg-white rotate-45"></div>
        </div>`;
  } else {
    btn.innerHTML = "";
  }

  // Re-apply selection ring if it's the selected one
  if (dienteSeleccionadoLocal === num) {
    btn.classList.add("ring-2", "ring-blue-300", "border-blue-600");
  }
}

async function loadOdontogramaData() {
  try {
    const meta = JSON.parse(currentPaciente.meta || '{}');
    dientes = meta.odontograma || {};

    Object.keys(dientes).forEach(num => {
      actualizarDiente(parseInt(num));
    });
  } catch (e) { console.error(e); }
}

async function saveOdontograma() {
  try {
    const meta = JSON.parse(currentPaciente.meta || '{}');
    meta.odontograma = dientes;
    await dbRun('UPDATE pacientes SET meta = ? WHERE id = ?', [JSON.stringify(meta), currentPaciente.id]);
    alert('Odontograma guardado');
  } catch (e) { console.error(e); alert('Error al guardar'); }
}

// --- Tab: Periodontograma ---

function setupPeriodontogramaTab() {
  const teethUpper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const teethLower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  // Load existing data first to render correctly
  let perioData = {};
  try {
    const meta = JSON.parse(currentPaciente.meta || '{}');
    perioData = meta.periodontograma || {};
  } catch (e) { }

  const createToothBlock = (tooth, face) => {
    const idBase = `t${tooth}-${face}`;
    const data = perioData[idBase] || { pd: ['', '', ''], gm: ['', '', ''], bop: [false, false, false], mob: 0 };

    return `
      <div class="border border-gray-300 dark:border-gray-600 p-1 bg-gray-50 dark:bg-gray-700 rounded text-xs w-20 flex-shrink-0 transition-colors">
        <div class="text-center font-bold mb-1 text-[#1D5D69] dark:text-[#4EABBE]">${tooth}</div>
        
        <!--Mobility -->
        <div class="mb-1 flex justify-center">
            <select id="${idBase}-mob" class="w-full text-xs border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 text-center bg-white dark:bg-gray-600 dark:text-white">
                <option value="0" ${data.mob == 0 ? 'selected' : ''}>M:0</option>
                <option value="1" ${data.mob == 1 ? 'selected' : ''}>M:1</option>
                <option value="2" ${data.mob == 2 ? 'selected' : ''}>M:2</option>
                <option value="3" ${data.mob == 3 ? 'selected' : ''}>M:3</option>
            </select>
        </div>

        <!--PD(Pocket Depth) -->
        <div class="grid grid-cols-3 gap-0.5 mb-1">
          <input value="${data.pd[0]}" id="${idBase}-pd-0" class="w-full text-center border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 focus:ring-1 focus:ring-blue-500 dark:bg-gray-600 dark:text-white" placeholder="-" maxlength="2">
          <input value="${data.pd[1]}" id="${idBase}-pd-1" class="w-full text-center border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 focus:ring-1 focus:ring-blue-500 dark:bg-gray-600 dark:text-white" placeholder="-" maxlength="2">
          <input value="${data.pd[2]}" id="${idBase}-pd-2" class="w-full text-center border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 focus:ring-1 focus:ring-blue-500 dark:bg-gray-600 dark:text-white" placeholder="-" maxlength="2">
        </div>

        <!-- GM (Gingival Margin) -->
        <div class="grid grid-cols-3 gap-0.5 mb-1">
          <input value="${data.gm[0]}" id="${idBase}-gm-0" class="w-full text-center border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 focus:ring-1 focus:ring-blue-500 text-blue-600 dark:text-blue-400 dark:bg-gray-600" placeholder="-" maxlength="2">
          <input value="${data.gm[1]}" id="${idBase}-gm-1" class="w-full text-center border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 focus:ring-1 focus:ring-blue-500 text-blue-600 dark:text-blue-400 dark:bg-gray-600" placeholder="-" maxlength="2">
          <input value="${data.gm[2]}" id="${idBase}-gm-2" class="w-full text-center border border-gray-200 dark:border-gray-500 rounded px-0 py-0.5 focus:ring-1 focus:ring-blue-500 text-blue-600 dark:text-blue-400 dark:bg-gray-600" placeholder="-" maxlength="2">
        </div>

        <!-- BOP (Bleeding) -->
        <div class="flex justify-center gap-2 mt-1">
          <input type="checkbox" id="${idBase}-bop-0" ${data.bop[0] ? 'checked' : ''} class="w-3 h-3 text-red-500 rounded focus:ring-red-500 dark:bg-gray-600 dark:border-gray-500">
          <input type="checkbox" id="${idBase}-bop-1" ${data.bop[1] ? 'checked' : ''} class="w-3 h-3 text-red-500 rounded focus:ring-red-500 dark:bg-gray-600 dark:border-gray-500">
          <input type="checkbox" id="${idBase}-bop-2" ${data.bop[2] ? 'checked' : ''} class="w-3 h-3 text-red-500 rounded focus:ring-red-500 dark:bg-gray-600 dark:border-gray-500">
        </div>
      </div>
    `;
  };

  document.getElementById('perio-upper-vestibular').innerHTML = teethUpper.map(t => createToothBlock(t, 'V')).join('');
  document.getElementById('perio-upper-palatine').innerHTML = teethUpper.map(t => createToothBlock(t, 'P')).join('');
  document.getElementById('perio-lower-lingual').innerHTML = teethLower.map(t => createToothBlock(t, 'L')).join('');
  document.getElementById('perio-lower-vestibular').innerHTML = teethLower.map(t => createToothBlock(t, 'V')).join('');

  // Save Logic
  document.getElementById('btn-save-perio').addEventListener('click', async () => {
    const newData = {};
    const processArch = (teeth, faces) => {
      teeth.forEach(t => {
        faces.forEach(f => {
          const idBase = `t${t}-${f}`;
          newData[idBase] = {
            mob: document.getElementById(`${idBase}-mob`).value,
            pd: [
              document.getElementById(`${idBase}-pd-0`).value,
              document.getElementById(`${idBase}-pd-1`).value,
              document.getElementById(`${idBase}-pd-2`).value
            ],
            gm: [
              document.getElementById(`${idBase}-gm-0`).value,
              document.getElementById(`${idBase}-gm-1`).value,
              document.getElementById(`${idBase}-gm-2`).value
            ],
            bop: [
              document.getElementById(`${idBase}-bop-0`).checked,
              document.getElementById(`${idBase}-bop-1`).checked,
              document.getElementById(`${idBase}-bop-2`).checked
            ]
          };
        });
      });
    };

    processArch(teethUpper, ['V', 'P']);
    processArch(teethLower, ['L', 'V']);

    try {
      const meta = JSON.parse(currentPaciente.meta || '{}');
      meta.periodontograma = newData;
      await dbRun('UPDATE pacientes SET meta = ? WHERE id = ?', [JSON.stringify(meta), currentPaciente.id]);
      currentPaciente = await loadPaciente(currentPaciente.id); // Reload
      alert('Periodontograma guardado correctamente');
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    }
  });
}

// Start
window.addEventListener('DOMContentLoaded', init);
