// antecedentes.js
// Lógica de la pestaña de antecedentes clínicos cargada en un iframe.

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db || !db.get) return resolve(null);
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
      if (db.all && db.all.length >= 3) {
        db.all(sql, params, (err, rows) => { if (err) return reject(err); resolve(rows || []); });
      } else if (db.all) {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      } else {
        dbGet(sql, params).then(row => resolve(row ? [row] : [])).catch(reject);
      }
    } catch (e) { reject(e); }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db || !db.run) return reject(new Error('DB no disponible'));
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
    try {
      const parentParams = new URLSearchParams(window.parent.location.search);
      const parentValue = parentParams.get(name);
      if (parentValue !== null && parentValue !== '') return parentValue;
    } catch (e) {
      // Parent frame is not accessible.
    }
  }
  return null;
}

let currentPaciente = null;
let selectedPadecimientos = [];

function getPacienteId() {
  return getQueryParam('id') || getQueryParam('paciente_id');
}

function normalizePadecimientos(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  value.forEach(item => {
    const nombre = String(item || '').trim();
    if (!nombre || seen.has(nombre)) return;
    seen.add(nombre);
    result.push(nombre);
  });
  return result;
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

async function init() {
  const id = getPacienteId();
  if (!id) return;
  currentPaciente = await loadPaciente(id);
  if (!currentPaciente) return;
  await setupAntecedentes();
}

async function setupAntecedentes() {
  // Cargar datos existentes
  const form = document.getElementById('form-antecedentes-ficha');
  try {
    const row = await dbGet('SELECT * FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]);
    if (row) {
      if (form) {
        form.alergias.value = row.alergias || '';
        form.enfermedades.value = row.enfermedades || '';
        form.medicamentos.value = row.medicamentos || '';
        form.cirugias.value = row.cirugias || '';
        form.antecedentes_familiares.value = row.antecedentes_familiares || '';
        form.tipo_sangre.value = row.tipo_sangre || '';
        form.observaciones.value = row.observaciones || '';
      }
      try {
        const parsed = row.padecimientos ? JSON.parse(row.padecimientos) : [];
        selectedPadecimientos = normalizePadecimientos(parsed);
      } catch (e) {
        selectedPadecimientos = [];
      }
    } else {
      selectedPadecimientos = [];
    }
    await loadPadecimientosList();
    await loadTimeline();
    await loadTratamientosHistorial();
  } catch (err) {
    console.error('Error cargando antecedentes', err);
  }
  const refreshHistorial = document.getElementById('refresh-tratamientos-historial');
  if (refreshHistorial && refreshHistorial.dataset.bound !== 'true') {
    refreshHistorial.dataset.bound = 'true';
    refreshHistorial.addEventListener('click', () => loadTratamientosHistorial());
  }
  // Guardar antecedentes
  const saveBtn = document.getElementById('save-antecedentes-ficha');
  if (saveBtn && form && saveBtn.dataset.bound !== 'true') {
    saveBtn.dataset.bound = 'true';
    saveBtn.addEventListener('click', async () => {
      const formEl = document.getElementById('form-antecedentes-ficha');
      if (!formEl) return;
      const data = {
        alergias: formEl.alergias.value || '',
        enfermedades: formEl.enfermedades.value || '',
        medicamentos: formEl.medicamentos.value || '',
        cirugias: formEl.cirugias.value || '',
        antecedentes_familiares: formEl.antecedentes_familiares.value || '',
        tipo_sangre: formEl.tipo_sangre.value || '',
        observaciones: formEl.observaciones.value || '',
        padecimientos: JSON.stringify(selectedPadecimientos)
      };
      try {
        const exists = await dbGet('SELECT id FROM antecedentes_clinicos WHERE paciente_id = ?', [currentPaciente.id]);
        if (exists) {
          await dbRun('UPDATE antecedentes_clinicos SET alergias = ?, enfermedades = ?, medicamentos = ?, cirugias = ?, antecedentes_familiares = ?, tipo_sangre = ?, observaciones = ?, padecimientos = ? WHERE paciente_id = ?',
            [data.alergias, data.enfermedades, data.medicamentos, data.cirugias, data.antecedentes_familiares, data.tipo_sangre, data.observaciones, data.padecimientos, currentPaciente.id]);
        } else {
          await dbRun('INSERT INTO antecedentes_clinicos (paciente_id, alergias, enfermedades, medicamentos, cirugias, antecedentes_familiares, tipo_sangre, observaciones, padecimientos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [currentPaciente.id, data.alergias, data.enfermedades, data.medicamentos, data.cirugias, data.antecedentes_familiares, data.tipo_sangre, data.observaciones, data.padecimientos]);
        }
        alert('Antecedentes guardados');
        await loadTimeline();
      } catch (e) {
        console.error(e);
        alert('Error guardando antecedentes: ' + (e && e.message));
      }
    });
  }
  // Añadir padecimiento
  const addBtn = document.getElementById('btn-add-padecimiento');
  if (addBtn && addBtn.dataset.bound !== 'true') {
    addBtn.dataset.bound = 'true';
    addBtn.addEventListener('click', async () => {
      const input = document.getElementById('new-padecimiento');
      if (!input) return;
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
}

async function loadPadecimientosList() {
  const listContainer = document.getElementById('lista-padecimientos');
  if (!listContainer) return;
  try {
    const defaults = await dbAll('SELECT * FROM padecimientos_default ORDER BY nombre ASC');
    listContainer.innerHTML = '';
    if (defaults.length === 0) {
      listContainer.innerHTML = '<p class="text-xs text-gray-400">No hay padecimientos registrados.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    defaults.forEach(p => {
      const nombre = String(p && p.nombre ? p.nombre : '').trim();
      const isChecked = nombre ? selectedPadecimientos.includes(nombre) : false;
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between group';

      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 cursor-pointer flex-1';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = nombre;
      checkbox.checked = isChecked;
      checkbox.className = 'text-[#4EABBE] focus:ring-[#4EABBE] rounded border-gray-300 dark:border-gray-500 dark:bg-gray-600';

      const span = document.createElement('span');
      span.className = 'text-sm text-gray-700 dark:text-gray-200';
      span.textContent = nombre;

      label.appendChild(checkbox);
      label.appendChild(span);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1';
      deleteBtn.title = 'Eliminar de la lista';
      deleteBtn.textContent = '\u00d7';

      checkbox.addEventListener('change', (e) => {
        if (!nombre) return;
        if (e.target.checked) {
          if (!selectedPadecimientos.includes(nombre)) selectedPadecimientos.push(nombre);
        } else {
          selectedPadecimientos = selectedPadecimientos.filter(x => x !== nombre);
        }
      });
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar "${nombre}" de la lista de opciones?`)) return;
        try {
          await dbRun('DELETE FROM padecimientos_default WHERE id = ?', [p.id]);
          selectedPadecimientos = selectedPadecimientos.filter(x => x !== nombre);
          await loadPadecimientosList();
        } catch (e) {
          console.error(e);
          alert('Error al eliminar');
        }
      });

      div.appendChild(label);
      div.appendChild(deleteBtn);
      fragment.appendChild(div);
    });
    listContainer.appendChild(fragment);
  } catch (e) {
    console.error('Error loading padecimientos defaults', e);
    listContainer.innerHTML = '<p class="text-xs text-red-400">Error al cargar lista.</p>';
  }
}

async function loadTratamientosHistorial() {
  const tbody = document.getElementById('tratamientos-historial-list');
  if (!tbody) return;
  try {
    const rows = await dbAll(`
      SELECT
        h.fecha_ejecucion as fecha,
        h.especialista_ejecuto,
        h.costo_total,
        COALESCE(NULLIF(h.descripcion_procedimiento, ''), t.nombre, 'Tratamiento') as procedimiento
      FROM planes_tratamiento_historial h
      LEFT JOIN tratamientos_catalogo t ON h.catalogo_id = t.id
      WHERE h.paciente_id = ?
      ORDER BY h.fecha_ejecucion DESC
      LIMIT 20
    `, [currentPaciente.id]);
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-3 text-center text-[#1D5D69] dark:text-slate-400">No hay tratamientos completados registrados</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row => {
      const fecha = row.fecha ? new Date(row.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
      const costo = row.costo_total !== null && row.costo_total !== undefined ? `$${Number(row.costo_total).toFixed(2)}` : '-';
      const especialista = row.especialista_ejecuto || '-';
      return `
        <tr class="border-b border-[#8BCFDD]/20 dark:border-slate-700 hover:bg-[#8BCFDD]/10">
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300">${fecha}</td>
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300 font-medium">${row.procedimiento}</td>
          <td class="py-2 px-3 text-sm text-[#0F2532] dark:text-slate-300">${especialista}</td>
          <td class="py-2 px-3 text-sm font-mono text-[#4EABBE] dark:text-[#8BCFDD]">${costo}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('Error cargando historial de tratamientos', e);
    tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-3 text-center text-[#1D5D69] dark:text-slate-400">Error al cargar historial</td></tr>';
  }
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

function summarizeRecetaNotas(notas) {
  if (!notas) return '';
  const raw = String(notas).trim();
  if (!raw.startsWith('{')) return raw;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return raw;
    if (Array.isArray(data.medicamentos)) {
      const count = data.medicamentos.length;
      const suffix = count === 1 ? '' : 's';
      return `Receta médica guardada (${count} medicamento${suffix})`;
    }
    if (data.perTooth && typeof data.perTooth === 'object') {
      return summarizePeriodontograma(data.perTooth);
    }
    return raw;
  } catch (e) {
    return raw;
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
      const proc = t.procedimiento || '';
      const isReceta = proc.startsWith('Receta:') || proc.startsWith('Receta M');
      t.notas = summarizeRecetaNotas(t.notas || '');
      const pieza = t.diente ? `Pieza ${t.diente}` : '';
      const descBase = t.notas || (isReceta ? 'Receta médica generada' : 'Tratamiento realizado');
      const desc = pieza ? (descBase ? `${pieza} · ${descBase}` : pieza) : descBase;
      events.push({
        date: new Date(t.fecha),
        title: proc || 'Tratamiento',
        desc,
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
