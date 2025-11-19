// ficha_clinica.js
// Vista dedicada para la ficha clínica tipo Dentalink (pestañas: Datos, Antecedentes, Tratamientos, Evolución, Imágenes, Odontograma placeholder)

let db = (window.api && window.api.db) ? window.api.db : null;
let currentPaciente = null;

// Wrap DB calls to support both callback-style and promise-style APIs exposed by preload
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

const createEl = (tag, classes = '', html = '') => {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (html) el.innerHTML = html;
    return el;
};

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

function renderHeader(paciente) {
    const header = createEl('div', 'mb-6 flex items-center justify-between');
    header.innerHTML = `
    <div>
      <h1 class="text-3xl font-bold">Ficha Clínica — ${paciente.nombre} ${paciente.apellido}</h1>
      <p class="text-sm text-gray-600">ID: ${paciente.id} • Registrado: ${paciente.fecha_registro || 'N/A'}</p>
    </div>
    <div class="flex gap-3">
      <button id="back-btn" class="px-4 py-2 bg-gray-100 rounded">Volver</button>
      <button id="save-all" class="px-4 py-2 bg-cyan-600 text-white rounded">Guardar todo</button>
    </div>
  `;
    return header;
}

function renderTabs() {
    const tabs = createEl('div', 'bg-white rounded-lg shadow p-4 mb-6');
    tabs.innerHTML = `
    <div class="flex gap-2 mb-4" id="tabs">
      <button data-tab="datos" class="tab-btn px-3 py-2 bg-cyan-50 rounded text-cyan-600">Datos</button>
      <button data-tab="antecedentes" class="tab-btn px-3 py-2 rounded">Antecedentes</button>
      <button data-tab="tratamientos" class="tab-btn px-3 py-2 rounded">Tratamientos</button>
      <button data-tab="evolucion" class="tab-btn px-3 py-2 rounded">Evolución</button>
      <button data-tab="imagenes" class="tab-btn px-3 py-2 rounded">Imágenes</button>
      <button data-tab="odontograma" class="tab-btn px-3 py-2 rounded">Odontograma</button>
    </div>
    <div id="tab-content"></div>
  `;
    return tabs;
}

function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('bg-cyan-50', 'text-cyan-600'));
    const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
    if (btn) btn.classList.add('bg-cyan-50', 'text-cyan-600');
    const content = document.getElementById('tab-content');
    content.innerHTML = '';

    if (name === 'datos') renderTabDatos(content);
    else if (name === 'antecedentes') renderTabAntecedentes(content);
    else if (name === 'tratamientos') renderTabTratamientos(content);
    else if (name === 'evolucion') renderTabEvolucion(content);
    else if (name === 'imagenes') renderTabImagenes(content);
    else if (name === 'odontograma') renderTabOdontograma(content);
}



function renderTabEvolucion(container) {
    container.innerHTML = `<div class="bg-white p-6 rounded-lg shadow">Notas de evolución / consultas.</div>`;
}

function renderTabImagenes(container) {
    container.innerHTML = `<div class="bg-white p-6 rounded-lg shadow">Galería de imágenes del paciente (placeholder).</div>`;
}

function renderTabOdontograma(container) {
  // Inserta la UI del odontograma dentro de la pestaña y conecta con currentPaciente.meta.odontograma
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Odontograma</h2>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="lg:col-span-1">
          <div class="p-4">
            <div id="dienteSeleccionado" class="mb-4 p-3 bg-blue-50 rounded-lg hidden">
              <p class="text-sm font-medium text-blue-800">Diente seleccionado: <span id="numeroDiente" class="text-xl font-bold"></span></p>
            </div>
            <div id="botonesCondiciones" class="space-y-2"></div>
            <div class="mt-6 space-y-2">
              <button id="guardar-odontograma" class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md">💾 Guardar odontograma</button>
              <button id="limpiar-odontograma" class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md">🗑️ Limpiar</button>
            </div>
          </div>

          <div class="p-4 mt-4">
            <h3 class="text-sm font-semibold mb-3">Leyenda</h3>
            <div id="leyenda" class="space-y-2"></div>
          </div>
        </div>

        <div class="lg:col-span-3">
          <div class="p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input type="text" id="nombrePacienteOdonto" placeholder="Nombre del paciente" class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200" />
              <input type="date" id="fechaConsultaOdonto" class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200" />
            </div>

            <div>
              <h4 class="text-sm font-medium text-gray-600 mb-2 text-center">Arcada Superior</h4>
              <div id="arcadaSuperior" class="flex justify-center gap-2 mb-4 flex-wrap"></div>
            </div>

            <div class="border-t my-4"></div>

            <div>
              <h4 class="text-sm font-medium text-gray-600 mb-2 text-center">Arcada Inferior</h4>
              <div id="arcadaInferior" class="flex justify-center gap-2 flex-wrap"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // --- Lógica del odontograma (contenido local a esta pestaña) ---
  const dientesSuperiores = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const dientesInferiores = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const condiciones = [
    { id: 'sano', label: 'Sano', color: 'bg-white' },
    { id: 'caries', label: 'Caries', color: 'bg-red-500' },
    { id: 'obturado', label: 'Obturado', color: 'bg-blue-500' },
    { id: 'ausente', label: 'Ausente', color: 'bg-gray-800' },
    { id: 'corona', label: 'Corona', color: 'bg-yellow-500' },
    { id: 'endodoncia', label: 'Endodoncia', color: 'bg-purple-500' },
    { id: 'fractura', label: 'Fractura', color: 'bg-orange-500' },
    { id: 'implante', label: 'Implante', color: 'bg-green-500' }
  ];

  let dientesEstado = {};
  let dienteSeleccionadoLocal = null;

  function crearDiente(numero, contenedor) {
    const dienteDiv = document.createElement('div');
    dienteDiv.className = 'flex flex-col items-center gap-1';
    dienteDiv.innerHTML = `
      <span class="text-xs font-medium text-gray-600">${numero}</span>
      <button id="diente-${numero}" class="w-10 h-12 border-2 border-gray-400 rounded transition-all bg-white hover:scale-105 relative"></button>
    `;
    contenedor.appendChild(dienteDiv);
    // click handler
    dienteDiv.querySelector('button').addEventListener('click', () => seleccionarDiente(numero));
  }

  function crearBotonesCondiciones() {
    const cont = document.getElementById('botonesCondiciones');
    cont.innerHTML = '';
    condiciones.forEach(cond => {
      const btn = document.createElement('button');
      btn.className = `w-full px-4 py-2 rounded-md text-white font-medium transition-all ${cond.color} opacity-50 cursor-not-allowed`;
      btn.textContent = cond.label;
      btn.id = `btn-${cond.id}`;
      btn.disabled = true;
      btn.addEventListener('click', () => aplicarCondicion(cond.id));
      cont.appendChild(btn);
    });
  }

  function crearLeyenda() {
    const cont = document.getElementById('leyenda');
    cont.innerHTML = '';
    condiciones.forEach(cond => {
      const item = document.createElement('div');
      item.className = 'flex items-center gap-2';
      item.innerHTML = `<div class="w-6 h-6 rounded ${cond.color} border border-gray-300"></div><span class="text-xs text-gray-700">${cond.label}</span>`;
      cont.appendChild(item);
    });
  }

  function seleccionarDiente(numero) {
    dienteSeleccionadoLocal = numero;
    document.getElementById('dienteSeleccionado').classList.remove('hidden');
    document.getElementById('numeroDiente').textContent = numero;

    document.querySelectorAll('[id^="diente-"]').forEach(d => {
      d.classList.remove('border-blue-600','ring-2','ring-blue-300');
      d.classList.add('border-gray-400');
    });
    const dbtn = document.getElementById(`diente-${numero}`);
    dbtn.classList.remove('border-gray-400');
    dbtn.classList.add('border-blue-600','ring-2','ring-blue-300');

    condiciones.forEach(cond => {
      const b = document.getElementById(`btn-${cond.id}`);
      b.disabled = false;
      b.classList.remove('opacity-50','cursor-not-allowed');
      b.classList.add('hover:opacity-80','cursor-pointer');
    });
  }

  function aplicarCondicion(condId) {
    if (!dienteSeleccionadoLocal) return;
    dientesEstado[dienteSeleccionadoLocal] = condId;
    actualizarDiente(dienteSeleccionadoLocal);
  }

  function actualizarDiente(numero) {
    const btn = document.getElementById(`diente-${numero}`);
    const cond = dientesEstado[numero];
    btn.className = 'w-10 h-12 border-2 rounded transition-all hover:scale-105 relative';
    if (cond) {
      const c = condiciones.find(x => x.id === cond);
      if (c) btn.classList.add(c.color);
      if (cond === 'ausente') btn.innerHTML = '<div class="absolute inset-0 flex items-center justify-center"><div class="w-full h-0.5 bg-white rotate-45"></div></div>';
      else btn.innerHTML = '';
    } else {
      btn.classList.add('bg-white');
      btn.innerHTML = '';
    }
    if (dienteSeleccionadoLocal === numero) btn.classList.add('border-blue-600','ring-2','ring-blue-300'); else btn.classList.add('border-gray-400');
  }

  function limpiarOdontogramaLocal() {
    if (!confirm('¿Limpiar odontograma?')) return;
    dientesEstado = {};
    dienteSeleccionadoLocal = null;
    [...dientesSuperiores, ...dientesInferiores].forEach(n => {
      const btn = document.getElementById(`diente-${n}`);
      if (btn) { btn.className = 'w-10 h-12 border-2 border-gray-400 rounded transition-all bg-white hover:scale-105 relative'; btn.innerHTML = ''; }
    });
    document.getElementById('dienteSeleccionado').classList.add('hidden');
    condiciones.forEach(cond => {
      const b = document.getElementById(`btn-${cond.id}`);
      if (b) { b.disabled = true; b.classList.add('opacity-50','cursor-not-allowed'); b.classList.remove('hover:opacity-80','cursor-pointer'); }
    });
  }

  async function guardarOdontogramaLocal() {
    const nombre = document.getElementById('nombrePacienteOdonto').value || '';
    const fecha = document.getElementById('fechaConsultaOdonto').value || '';
    const datos = { paciente: { nombre, fecha }, dientes: dientesEstado, fechaGuardado: new Date().toISOString() };
    try {
      // actualizar meta en paciente
      const meta = (() => { try { return JSON.parse(currentPaciente.meta || '{}'); } catch (e) { return {}; } })();
      meta.odontograma = datos;
      await dbRun('UPDATE pacientes SET meta = ? WHERE id = ?', [JSON.stringify(meta), currentPaciente.id]);
      // recargar paciente
      currentPaciente = await loadPaciente(currentPaciente.id);
      alert('Odontograma guardado en ficha clínica');
    } catch (e) { console.error('Error guardando odontograma', e); alert('Error guardando odontograma: ' + (e && e.message)); }
  }

  // inicializar DOM
  const arcSup = document.getElementById('arcadaSuperior');
  const arcInf = document.getElementById('arcadaInferior');
  dientesSuperiores.forEach(n => crearDiente(n, arcSup));
  dientesInferiores.forEach(n => crearDiente(n, arcInf));
  crearBotonesCondiciones();
  crearLeyenda();

  // cargar datos existentes si hay
  (function cargarExistente() {
    const meta = (() => { try { return JSON.parse(currentPaciente.meta || '{}'); } catch (e) { return {}; } })();
    const od = meta.odontograma;
    if (od) {
      document.getElementById('nombrePacienteOdonto').value = od.paciente?.nombre || '';
      document.getElementById('fechaConsultaOdonto').value = od.paciente?.fecha || '';
      dientesEstado = od.dientes || {};
      Object.keys(dientesEstado).forEach(k => { actualizarDiente(parseInt(k)); });
    }
  })();

  // eventos
  document.getElementById('limpiar-odontograma').addEventListener('click', limpiarOdontogramaLocal);
  document.getElementById('guardar-odontograma').addEventListener('click', guardarOdontogramaLocal);
}

async function init() {
    const app = document.getElementById('app');
    const id = getQueryParam('id');
    if (!id) { app.innerHTML = '<p>ID de paciente no especificado.</p>'; return; }

    currentPaciente = await loadPaciente(id);
    if (!currentPaciente) { app.innerHTML = '<p>Paciente no encontrado.</p>'; return; }

    app.innerHTML = '';
    const header = renderHeader(currentPaciente);
    const tabs = renderTabs();
    app.append(header, tabs);

    document.getElementById('back-btn').addEventListener('click', () => { window.location.href = 'pacientes.html'; });
    document.getElementById('tabs').addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-tab]');
        if (b) switchTab(b.getAttribute('data-tab'));
    });

    // Mostrar pestaña por defecto
    switchTab('datos');
}

// --- Render de pestañas implementadas ---
function renderTabDatos(container) {
    const meta = (() => { try { return JSON.parse(currentPaciente.meta || '{}'); } catch (e) { return {}; } })();
    container.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow">
      <form id="form-datos" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input name="nombre" value="${currentPaciente.nombre || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
          <input name="apellido" value="${currentPaciente.apellido || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input name="telefono" value="${currentPaciente.telefono || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input name="email" value="${currentPaciente.email || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
          <input name="direccion" value="${currentPaciente.direccion || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
          <input type="date" name="fecha_nacimiento" value="${currentPaciente.fecha_nacimiento || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>

        <div class="md:col-span-2">
          <h3 class="text-md font-semibold mt-4">Campos adicionales</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label class="block text-sm text-gray-700 mb-1">Nombre social</label>
              <input name="nombre_social" value="${meta.nombre_social || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">CURP / RFC</label>
              <input name="curp" value="${meta.curp || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">Convenio</label>
              <input name="convenio" value="${meta.convenio || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">Número interno</label>
              <input name="numero_interno" value="${meta.numero_interno || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">Profesión</label>
              <input name="profesion" value="${meta.profesion || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-1">Empleador</label>
              <input name="empleador" value="${meta.empleador || ''}" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm text-gray-700 mb-1">Observaciones</label>
              <textarea name="observaciones" rows="3" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500">${meta.observaciones || ''}</textarea>
            </div>
          </div>
        </div>

        <div class="md:col-span-2 flex justify-end gap-3 mt-4">
          <button type="button" id="save-datos" class="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">Guardar Datos</button>
        </div>
      </form>
    </div>
  `;

    document.getElementById('save-datos').addEventListener('click', async () => {
        const form = document.getElementById('form-datos');
        const formData = new FormData(form);
        const core = {
            nombre: formData.get('nombre') || '',
            apellido: formData.get('apellido') || '',
            telefono: formData.get('telefono') || null,
            email: formData.get('email') || null,
            direccion: formData.get('direccion') || null,
            fecha_nacimiento: formData.get('fecha_nacimiento') || null
        };
        // construir meta
        const newMeta = Object.assign({}, meta);
        ['nombre_social', 'curp', 'convenio', 'numero_interno', 'profesion', 'empleador', 'observaciones'].forEach(k => { newMeta[k] = formData.get(k) || ''; });

        const sql = `UPDATE pacientes SET nombre = ?, apellido = ?, telefono = ?, email = ?, direccion = ?, fecha_nacimiento = ?, meta = ? WHERE id = ?`;
        const params = [core.nombre, core.apellido, core.telefono, core.email, core.direccion, core.fecha_nacimiento || null, JSON.stringify(newMeta), currentPaciente.id];
        try {
            await dbRun(sql, params);
            // recargar paciente
            currentPaciente = await loadPaciente(currentPaciente.id);
            alert('Datos guardados correctamente');
        } catch (e) { console.error(e); alert('Error guardando datos: ' + (e && e.message)); }
    });
}

function renderTabAntecedentes(container) {
    container.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow">
      <form id="form-antecedentes-ficha" class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-sm font-medium">Alergias</label>
          <textarea name="alergias" rows="3" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium">Enfermedades Crónicas</label>
          <textarea name="enfermedades" rows="3" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium">Medicamentos</label>
          <textarea name="medicamentos" rows="2" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium">Tipo de sangre</label>
          <input name="tipo_sangre" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium">Observaciones</label>
          <textarea name="observaciones" rows="3" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500"></textarea>
        </div>
        <div class="flex justify-end mt-2">
          <button type="button" id="save-antecedentes-ficha" class="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">Guardar Antecedentes</button>
        </div>
      </form>
    </div>
  `;

    // cargar datos
    dbGet('SELECT * FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]).then(row => {
        if (row) {
            const form = document.getElementById('form-antecedentes-ficha');
            form.alergias.value = row.alergias || '';
            form.enfermedades.value = row.enfermedades || '';
            form.medicamentos.value = row.medicamentos || '';
            form.tipo_sangre.value = row.tipo_sangre || '';
            form.observaciones.value = row.observaciones || '';
        }
    }).catch(err => console.error('Error cargando antecedentes', err));

    document.getElementById('save-antecedentes-ficha').addEventListener('click', async () => {
        const form = document.getElementById('form-antecedentes-ficha');
        const data = {
            alergias: form.alergias.value || '',
            enfermedades: form.enfermedades.value || '',
            medicamentos: form.medicamentos.value || '',
            tipo_sangre: form.tipo_sangre.value || '',
            observaciones: form.observaciones.value || ''
        };
        try {
            const exists = await dbGet('SELECT id FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]);
            if (exists) {
                await dbRun('UPDATE antecedentes_clinicos SET alergias = ?, enfermedades = ?, medicamentos = ?, tipo_sangre = ?, observaciones = ? WHERE paciente_id = ?', [data.alergias, data.enfermedades, data.medicamentos, data.tipo_sangre, data.observaciones, currentPaciente.id]);
            } else {
                await dbRun('INSERT INTO antecedentes_clinicos (paciente_id, alergias, enfermedades, medicamentos, tipo_sangre, observaciones) VALUES (?, ?, ?, ?, ?, ?)', [currentPaciente.id, data.alergias, data.enfermedades, data.medicamentos, data.tipo_sangre, data.observaciones]);
            }
            alert('Antecedentes guardados');
        } catch (e) { console.error(e); alert('Error guardando antecedentes: ' + (e && e.message)); }
    });
}

function renderTabTratamientos(container) {
    container.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow">
      <div id="tratamientos-list" class="mb-4">Cargando tratamientos...</div>

      <form id="form-tratamiento" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium">Procedimiento</label>
          <input name="procedimiento" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium">Diente</label>
          <input name="diente" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium">Costo</label>
          <input name="costo" type="number" step="0.01" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div>
          <label class="block text-sm font-medium">Notas</label>
          <input name="notas" class="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500" />
        </div>
        <div class="md:col-span-2 flex justify-end gap-3">
          <button type="button" id="add-tratamiento" class="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">Agregar Tratamiento</button>
        </div>
      </form>
    </div>
  `;

    const listEl = document.getElementById('tratamientos-list');
    async function loadTratamientosList() {
        listEl.innerHTML = '<div class="text-sm text-gray-500">Cargando...</div>';
        try {
            const rows = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? ORDER BY fecha DESC', [currentPaciente.id]);
            if (!rows || rows.length === 0) { listEl.innerHTML = '<div class="text-sm text-gray-500">No hay tratamientos registrados.</div>'; return; }
            listEl.innerHTML = `
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th class="py-2 text-left pl-2">Fecha</th><th class="py-2 text-left">Procedimiento</th><th class="py-2 text-left">Diente</th><th class="py-2 text-left">Costo</th><th class="py-2 text-left">Notas</th></tr></thead>
          <tbody class="bg-white divide-y divide-gray-100">
            ${rows.map(r => `<tr><td class="py-2 pl-2">${new Date(r.fecha).toLocaleString()}</td><td class="py-2">${r.procedimiento}</td><td class="py-2">${r.diente || '-'}</td><td class="py-2">${r.costo != null ? '$' + r.costo : '-'}</td><td class="py-2">${r.notas || ''}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
        } catch (e) { console.error('Error cargando tratamientos', e); listEl.innerHTML = '<div class="text-sm text-red-500">Error cargando tratamientos</div>'; }
    }

    document.getElementById('add-tratamiento').addEventListener('click', async () => {
        const form = document.getElementById('form-tratamiento');
        const procedimiento = form.procedimiento.value || '';
        const diente = form.diente.value || '';
        const costo = form.costo.value || 0;
        const notas = form.notas.value || '';
        if (!procedimiento) return alert('El procedimiento es obligatorio');
        try {
            await dbRun('INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas) VALUES (?, ?, ?, ?, ?)', [currentPaciente.id, diente, procedimiento, costo || null, notas]);
            form.reset();
            await loadTratamientosList();
            alert('Tratamiento agregado');
        } catch (e) { console.error(e); alert('Error agregando tratamiento: ' + (e && e.message)); }
    });

    loadTratamientosList();
}

window.addEventListener('DOMContentLoaded', init);
