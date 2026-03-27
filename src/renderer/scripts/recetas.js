// recetas.js
// Gestión de recetas del paciente.

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
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
  const value = params.get(name);
  if (value !== null && value !== '') return value;
  if (window.parent && window.parent !== window) {
    const parentParams = new URLSearchParams(window.parent.location.search);
    const parentValue = parentParams.get(name);
    if (parentValue !== null && parentValue !== '') return parentValue;
  }
  return null;
}

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('sesionActual')) || {};
  } catch (e) {
    return {};
  }
}

function getCurrentUserId() {
  const session = getSessionUser();
  return session.id || null;
}

async function getCajaAbiertaId() {
  const userId = getCurrentUserId();
  if (!userId) return null;
  const rows = await dbAll(
    "SELECT id FROM cajas WHERE usuario_id = ? AND estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1",
    [userId]
  );
  return rows[0]?.id || null;
}

let currentPacienteId = null;
let selectedMedicamentos = [];
let recetaPopup = null;

async function computeRecetaCosto() {
  if (!selectedMedicamentos.length) return 0;
  const counts = new Map();
  selectedMedicamentos.forEach(med => {
    const id = Number(med.medicamento_id);
    if (!Number.isFinite(id)) return;
    const qty = Number(med.cantidad || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    counts.set(id, (counts.get(id) || 0) + qty);
  });
  const ids = [...counts.keys()];
  if (!ids.length) return 0;
  try {
    const placeholders = ids.map(() => '?').join(',');
    const rows = await dbAll(`SELECT id, precio FROM medicamentos WHERE id IN (${placeholders})`, ids);
    const priceById = new Map(rows.map(r => [Number(r.id), Number(r.precio || 0)]));
    let total = 0;
    counts.forEach((qty, id) => {
      const price = priceById.get(id) || 0;
      total += price * qty;
    });
    return total;
  } catch (e) {
    console.error('Error calculando costo de receta:', e);
    return 0;
  }
}

async function init() {
  currentPacienteId = getQueryParam('id');
  if (!currentPacienteId) return;
  setupRecetas();
  await loadRecetasList();
}

function setupRecetas() {
  const btnNuevaReceta = document.getElementById('btn-nueva-receta');
  const btnListaRecetas = document.getElementById('btn-lista-recetas');
  const modal = document.getElementById('modal-receta');
  const closeBtn = document.getElementById('closeRecetaModal');
  const cancelBtn = document.getElementById('cancelReceta');
  const saveBtn = document.getElementById('saveReceta');
  const select = document.getElementById('select-medicamento-receta');
  const btnAdd = document.getElementById('btn-add-med-receta');
  const textarea = document.getElementById('receta-contenido');

  if (!btnNuevaReceta) {
    console.warn('Elementos de recetas no encontrados en el DOM.');
    return;
  }

  // Abrir nueva receta médica en ventana nueva
  if (btnNuevaReceta) {
    btnNuevaReceta.addEventListener('click', () => {
      const pacienteId = currentPacienteId;
      if (!pacienteId) {
        alert('No se pudo obtener el ID del paciente');
        return;
      }
      recetaPopup = window.open(`receta_medica.html?paciente_id=${pacienteId}`, '_blank', 'width=1200,height=800');
    });
  }

  // Mostrar/ocultar lista de recetas
  if (btnListaRecetas) {
    btnListaRecetas.addEventListener('click', () => {
      const lista = document.getElementById('lista-recetas');
      if (lista) {
        lista.parentElement.classList.toggle('hidden');
      }
    });
  }

  if (!modal || !closeBtn || !cancelBtn || !saveBtn || !select || !btnAdd || !textarea) {
    console.warn('Algunos elementos del modal no fueron encontrados');
    return;
  }

  const closeModal = () => {
    modal.classList.add('hidden');
    textarea.value = '';
    select.value = '';
    selectedMedicamentos = [];
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  btnAdd.addEventListener('click', () => {
    const id = select.value;
    if (!id) {
      alert('Por favor selecciona un medicamento');
      return;
    }
    const selectedOption = select.options[select.selectedIndex];
    const name = selectedOption.dataset.nombre;
    const stock = selectedOption.dataset.stock || 0;
    const descripcion = selectedOption.dataset.descripcion || '';

    // Verificar stock
    if (parseInt(stock) <= 0) {
      alert('Este medicamento no tiene stock disponible');
      return;
    }

    // Agregar al textarea con formato mejorado
    let medText = `• ${name}`;
    if (descripcion) {
      medText += ` (${descripcion})`;
    }
    medText += '\n  Indicaciones: \n  Dosis: \n\n';

    textarea.value += medText;
    select.value = '';
    textarea.focus();
    selectedMedicamentos.push({ medicamento_id: Number(id) });
  });

  saveBtn.addEventListener('click', async () => {
    const contenido = textarea.value.trim();
    if (!contenido) {
      alert('La receta no puede estar vacía');
      return;
    }
    try {
      const cajaId = await getCajaAbiertaId();
      if (!cajaId) {
        alert('Debe abrir una caja para guardar la receta');
        return;
      }
      const costoReceta = await computeRecetaCosto();
      await dbRun('INSERT INTO tratamientos (paciente_id, diente, procedimiento, costo, notas) VALUES (?, ?, ?, ?, ?)',
        [currentPacienteId, null, 'Receta: General', costoReceta, contenido]);
      if (costoReceta > 0) {
        const usuarioId = getCurrentUserId();
        await dbRun(
          'INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)',
          [cajaId, 'ingreso', costoReceta, 'Receta rapida', usuarioId]
        );
      }
      alert('Receta guardada exitosamente');
      closeModal();
      await loadRecetasList();
    } catch (e) {
      console.error('Error guardando receta:', e);
      alert('Error guardando receta: ' + e.message);
    }
  });

  // Función para abrir el modal de receta rápida
  async function openRecetaModal() {
    selectedMedicamentos = [];
    // Cargar inventario
    select.innerHTML = '<option value="">Seleccionar medicamento...</option>';
    try {
      const meds = await dbAll('SELECT * FROM medicamentos ORDER BY nombre ASC');
      console.log('Medicamentos cargados:', meds.length);

      if (meds.length === 0) {
        select.innerHTML = '<option value="">No hay medicamentos en inventario</option>';
        modal.classList.remove('hidden');
        return;
      }

      meds.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        const stock = m.stock || 0;
        const stockStatus = stock > 0 ? `Stock: ${stock}` : 'Sin stock';
        const stockColor = stock > 0 ? '' : ' ⚠️';
        opt.textContent = `${m.nombre} - ${stockStatus}${stockColor}`;
        opt.dataset.nombre = m.nombre;
        opt.dataset.stock = stock;
        opt.dataset.precio = m.precio || 0;
        opt.dataset.descripcion = m.descripcion || '';

        // Deshabilitar si no hay stock
        if (stock <= 0) {
          opt.disabled = true;
          opt.style.color = '#999';
        }

        select.appendChild(opt);
      });

      console.log('Opciones agregadas al select:', select.options.length);
    } catch (e) {
      console.error('Error cargando medicamentos:', e);
      select.innerHTML = '<option value="">Error cargando medicamentos</option>';
    }
    modal.classList.remove('hidden');
  }
}

function formatRecetaNotas(notas) {
  if (!notas) return '';
  const raw = String(notas).trim();
  if (!raw.startsWith('{')) return notas;
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.medicamentos)) return notas;
    if (data.medicamentos.length === 0) return 'Receta sin medicamentos';
    return data.medicamentos.map((m) => {
      const nombre = (m && m.nombre) ? m.nombre : 'Medicamento';
      const presentacion = (m && m.presentacion) ? ` (${m.presentacion})` : '';
      const indicaciones = (m && m.indicaciones) ? `: ${m.indicaciones}` : '';
      return `- ${nombre}${presentacion}${indicaciones}`;
    }).join('\n');
  } catch (e) {
    return notas;
  }
}

async function loadRecetasList() {
  const list = document.getElementById('lista-recetas');
  if (!list) return;
  try {
    const recetas = await dbAll('SELECT * FROM tratamientos WHERE paciente_id = ? AND (procedimiento LIKE "Receta:%" OR procedimiento LIKE "Receta M%") ORDER BY fecha DESC', [currentPacienteId]);
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
          <p class="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-line">${formatRecetaNotas(r.notas || '')}</p>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error cargando recetas:', e);
    list.innerHTML = '<p class="text-red-500">Error cargando recetas</p>';
  }
}

window.addEventListener('message', async (event) => {
  const trustedOrigin = !event?.origin || event.origin === 'null' || event.origin === 'file://' || event.origin === window.location.origin;
  if (!trustedOrigin) return;
  if (event.source !== recetaPopup) return;
  const data = event && event.data;
  if (!data) return;

  // Manejar peticiones de base de datos desde la receta médica
  if (data.type === 'db-all' || data.type === 'db-get' || data.type === 'db-run') {
    try {
      let result;
      if (data.type === 'db-all') {
        result = await dbAll(data.sql, data.params);
      } else if (data.type === 'db-get') {
        const rows = await dbAll(data.sql, data.params);
        result = rows[0] || null;
      } else if (data.type === 'db-run') {
        result = await dbRun(data.sql, data.params);
      }

      event.source.postMessage({
        type: `${data.type}-response`,
        requestId: data.requestId,
        result: result
      }, '*');
    } catch (err) {
      console.error(`Error procesando ${data.type} para la receta:`, err);
      event.source.postMessage({
        type: `${data.type}-response`,
        requestId: data.requestId,
        error: err.message
      }, '*');
    }
    return;
  }

  // Manejar evento de receta guardada
  if (data.type === 'receta-guardada') {
    if (!currentPacienteId) {
      currentPacienteId = getQueryParam('id');
    }
    if (data.pacienteId && currentPacienteId && String(data.pacienteId) !== String(currentPacienteId)) return;
    loadRecetasList();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
