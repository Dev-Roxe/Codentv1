// recetas.js
// Gestión de recetas del paciente.

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
  setupRecetas();
  await loadRecetasList();
}
function setupRecetas() {
  const btnNuevaReceta = document.getElementById('btn-nueva-receta');
  const modal = document.getElementById('modal-receta');
  const closeBtn = document.getElementById('closeRecetaModal');
  const cancelBtn = document.getElementById('cancelReceta');
  const saveBtn = document.getElementById('saveReceta');
  const select = document.getElementById('select-medicamento-receta');
  const btnAdd = document.getElementById('btn-add-med-receta');
  const textarea = document.getElementById('receta-contenido');
  if (!btnNuevaReceta || !modal || !closeBtn || !cancelBtn || !saveBtn || !select || !btnAdd || !textarea) {
    console.warn('Elementos de recetas no encontrados en el DOM.');
    return;
  }
  btnNuevaReceta.addEventListener('click', openRecetaModal);
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
        [currentPacienteId, null, 'Receta: General', 0, contenido]);
      alert('Receta guardada');
      closeModal();
      await loadRecetasList();
    } catch (e) {
      console.error(e);
      alert('Error guardando receta');
    }
  });
  async function openRecetaModal() {
    // Cargar inventario
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
async function loadRecetasList() {
  const list = document.getElementById('lista-recetas');
  if (!list) return;
  try {
    const recetas = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND procedimiento LIKE "Receta:%" ORDER BY fecha DESC', [currentPacienteId]);
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
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p class="text-red-500">Error cargando recetas</p>';
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}