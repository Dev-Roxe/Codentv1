// tratamientos.js
// Manejo de tratamientos para el paciente en la pestaña correspondiente.

let db = (window.api && window.api.db) ? window.api.db : null;
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
let currentPacienteId = null;
async function init() {
  currentPacienteId = getQueryParam('id');
  if (!currentPacienteId) return;
  setupTratamientos();
  await loadTratamientosList();
}
function setupTratamientos() {
  document.getElementById('add-tratamiento-btn').addEventListener('click', openTratamientoModal);
  const modal = document.getElementById('modal-tratamiento');
  const form = document.getElementById('form-tratamiento');
  const closeBtn = document.getElementById('close-modal-tratamiento');
  const cancelBtn = document.getElementById('cancel-tratamiento');
  const closeModal = () => {
    modal.classList.add('hidden');
    form.reset();
    recetaTemp = [];
    document.getElementById('lista-receta-tratamiento').innerHTML = '';
  };
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  // Lógica de inventario en el modal
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
    list.innerHTML = recetaTemp.map((r,i) => `
      <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded">
        <span>${r.name} <span class="text-xs text-gray-500">(${r.indicaciones})</span></span>
        <button type="button" class="text-red-500 hover:text-red-700" data-index="${i}">×</button>
      </div>
    `).join('');
    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index);
        recetaTemp.splice(i,1);
        renderRecetaTemp();
      });
    });
  }
  // Guardar tratamiento
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const procedimiento = form.procedimiento.value;
    const diente = form.diente.value || null;
    const costo = form.costo.value || 0;
    let notas = form.notas.value || '';
    if (recetaTemp.length > 0) {
      notas += '\n\n[RECETA]\n' + recetaTemp.map(r => `- ${r.name}: ${r.indicaciones}`).join('\n');
    }
    try {
      await dbRun('INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas) VALUES (?, ?, ?, ?, ?)', [currentPacienteId, diente, procedimiento, costo || null, notas]);
      // Actualizar inventario
      for (const item of recetaTemp) {
        await dbRun('UPDATE medicamentos SET stock = stock - 1 WHERE id = ?', [item.id]);
      }
      closeModal();
      await loadTratamientosList();
      alert('Tratamiento guardado exitosamente');
    } catch (e) {
      console.error(e);
      alert('Error agregando tratamiento: ' + (e && e.message));
    }
  });
  // Función para abrir el modal y cargar inventario
  async function openTratamientoModal() {
    recetaTemp = [];
    renderRecetaTemp();
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
}
async function loadTratamientosList() {
  const list = document.getElementById('tratamientos-list');
  if (!list) return;
  try {
    const rows = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND procedimiento NOT LIKE "Receta:%" ORDER BY fecha DESC', [currentPacienteId]);
    if (rows.length === 0) {
      list.innerHTML = '<div class="p-8 text-center text-gray-500 dark:text-gray-400">No hay tratamientos registrados.</div>';
      return;
    }
    list.innerHTML = `
      <table class="w-full text-left border-collapse text-sm">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
            <th class="p-2 font-semibold">Fecha</th>
            <th class="p-2 font-semibold">Procedimiento</th>
            <th class="p-2 font-semibold">Diente</th>
            <th class="p-2 font-semibold">Costo</th>
            <th class="p-2 font-semibold">Notas</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          ${rows.map(r => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td class="p-2 text-gray-600 dark:text-gray-300">${new Date(r.fecha).toLocaleDateString()}</td>
              <td class="p-2 font-medium text-gray-800 dark:text-gray-200">${r.procedimiento}</td>
              <td class="p-2 text-gray-500 dark:text-gray-400">${r.diente || '-'}</td>
              <td class="p-2 font-mono text-gray-600 dark:text-gray-300">$${Number(r.costo).toFixed(2)}</td>
              <td class="p-2 text-gray-500 dark:text-gray-400 max-w-xs truncate" title="${r.notas || ''}">${r.notas || '-'}</td>
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}