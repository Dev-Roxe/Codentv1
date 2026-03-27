// rx.js
// Gestion de radiografias e imagenes clinicas del paciente.

let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}
const clinicalApi = window.api?.clinical || window.parent?.api?.clinical || null;

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db || !db.get) return resolve(null);
      if (db.get.length >= 3) {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        });
      } else {
        db.get(sql, params).then(row => resolve(row || null)).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db || !db.all) return resolve([]);
      if (db.all.length >= 3) {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        db.all(sql, params).then(rows => resolve(rows || [])).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db || !db.run) return reject(new Error('DB no disponible'));
      if (db.run.length >= 3) {
        db.run(sql, params, function onRun(err) {
          if (err) return reject(err);
          resolve(this);
        });
      } else {
        db.run(sql, params).then(resolve).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
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
      // No-op
    }
  }
  return null;
}

function getPacienteId() {
  return getQueryParam('id') || getQueryParam('paciente_id');
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return 'N/D';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function slugifyFileName(value) {
  const base = String(value || 'rx')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return base || 'rx';
}

function inferExtension(record) {
  const fileName = String(record?.nombre_archivo || '').trim();
  const fromName = fileName.includes('.') ? fileName.split('.').pop() : '';
  if (fromName) return fromName.toLowerCase();
  const mime = String(record?.mime_type || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

function buildDownloadName(record) {
  const title = slugifyFileName(record?.titulo || 'rx');
  return `${title}.${inferExtension(record)}`;
}

function notifyRxSync(extra = {}) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'clinical-data-updated',
      section: 'rx',
      pacienteId: state.currentPacienteId,
      ...extra,
    }, '*');
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const state = {
  currentPacienteId: null,
  records: [],
  editingId: null,
  currentImageData: '',
  currentFileName: '',
  currentMimeType: '',
  currentFileBytes: 0,
  previewRecordId: null,
};

const refs = {};

function cacheDom() {
  refs.btnAddRx = document.getElementById('btnAddRx');
  refs.rxGrid = document.getElementById('rxGrid');
  refs.rxEmptyState = document.getElementById('rxEmptyState');
  refs.rxTotal = document.getElementById('rxTotal');
  refs.rxLastUpdated = document.getElementById('rxLastUpdated');

  refs.rxFormModal = document.getElementById('rxFormModal');
  refs.closeRxForm = document.getElementById('closeRxForm');
  refs.cancelRxForm = document.getElementById('cancelRxForm');
  refs.rxForm = document.getElementById('rxForm');
  refs.rxFormTitle = document.getElementById('rxFormTitle');
  refs.rxTitulo = document.getElementById('rxTitulo');
  refs.rxTipo = document.getElementById('rxTipo');
  refs.rxFecha = document.getElementById('rxFecha');
  refs.rxNotas = document.getElementById('rxNotas');
  refs.rxImagen = document.getElementById('rxImagen');
  refs.rxSelectedFile = document.getElementById('rxSelectedFile');
  refs.rxPreviewImage = document.getElementById('rxPreviewImage');
  refs.rxPreviewPlaceholder = document.getElementById('rxPreviewPlaceholder');
  refs.rxPreviewMeta = document.getElementById('rxPreviewMeta');

  refs.rxPreviewModal = document.getElementById('rxPreviewModal');
  refs.rxPreviewTypeTag = document.getElementById('rxPreviewTypeTag');
  refs.rxPreviewTitle = document.getElementById('rxPreviewTitle');
  refs.rxPreviewDate = document.getElementById('rxPreviewDate');
  refs.rxPreviewLargeImage = document.getElementById('rxPreviewLargeImage');
  refs.rxPreviewFileName = document.getElementById('rxPreviewFileName');
  refs.rxPreviewFileSize = document.getElementById('rxPreviewFileSize');
  refs.rxPreviewNotes = document.getElementById('rxPreviewNotes');
  refs.rxDownloadPreview = document.getElementById('rxDownloadPreview');
  refs.closeRxPreview = document.getElementById('closeRxPreview');
}

function showElement(el, visible) {
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function resetFormState() {
  state.editingId = null;
  state.currentImageData = '';
  state.currentFileName = '';
  state.currentMimeType = '';
  state.currentFileBytes = 0;
  if (refs.rxForm) refs.rxForm.reset();
  if (refs.rxTipo) refs.rxTipo.value = 'Periapical';
  if (refs.rxSelectedFile) refs.rxSelectedFile.textContent = 'Sin archivo seleccionado';
  if (refs.rxPreviewMeta) refs.rxPreviewMeta.textContent = 'Pendiente';
  if (refs.rxPreviewImage) {
    refs.rxPreviewImage.src = '';
    refs.rxPreviewImage.classList.add('hidden');
  }
  showElement(refs.rxPreviewPlaceholder, true);
  if (refs.rxImagen) refs.rxImagen.value = '';
}

function syncFormPreview() {
  if (state.currentImageData && refs.rxPreviewImage) {
    refs.rxPreviewImage.src = state.currentImageData;
    refs.rxPreviewImage.classList.remove('hidden');
    showElement(refs.rxPreviewPlaceholder, false);
  } else {
    if (refs.rxPreviewImage) {
      refs.rxPreviewImage.src = '';
      refs.rxPreviewImage.classList.add('hidden');
    }
    showElement(refs.rxPreviewPlaceholder, true);
  }

  if (refs.rxSelectedFile) {
    refs.rxSelectedFile.textContent = state.currentFileName || 'Sin archivo seleccionado';
  }

  if (refs.rxPreviewMeta) {
    refs.rxPreviewMeta.textContent = state.currentFileBytes
      ? `${formatFileSize(state.currentFileBytes)}${state.currentMimeType ? ` · ${state.currentMimeType}` : ''}`
      : 'Pendiente';
  }
}

function openFormModal(record = null) {
  resetFormState();

  if (record) {
    state.editingId = Number(record.id);
    state.currentImageData = record.imagen_data || '';
    state.currentFileName = record.nombre_archivo || buildDownloadName(record);
    state.currentMimeType = record.mime_type || '';
    state.currentFileBytes = Number(record.tamano_bytes || 0);

    if (refs.rxFormTitle) refs.rxFormTitle.textContent = 'Editar RX';
    if (refs.rxTitulo) refs.rxTitulo.value = record.titulo || '';
    if (refs.rxTipo) refs.rxTipo.value = record.tipo_estudio || 'Periapical';
    if (refs.rxFecha) refs.rxFecha.value = record.fecha_estudio || '';
    if (refs.rxNotas) refs.rxNotas.value = record.notas || '';
  } else if (refs.rxFormTitle) {
    refs.rxFormTitle.textContent = 'Nueva RX';
  }

  syncFormPreview();
  openModal(refs.rxFormModal);
  refs.rxTitulo?.focus();
}

function closeFormModal() {
  closeModal(refs.rxFormModal);
  resetFormState();
}

function updateStats(records) {
  if (refs.rxTotal) refs.rxTotal.textContent = String(records.length);
  if (refs.rxLastUpdated) {
    refs.rxLastUpdated.textContent = records.length
      ? formatDateTime(records[0].fecha_actualizacion || records[0].fecha_creacion)
      : 'Sin registros';
  }
}

function createBadge(text) {
  const badge = document.createElement('span');
  badge.className = 'inline-flex items-center rounded-full bg-[#8BCFDD]/18 px-3 py-1 text-[11px] font-semibold text-[#1D5D69] dark:bg-[#4EABBE]/15 dark:text-[#8BCFDD]';
  badge.textContent = text || 'Sin tipo';
  return badge;
}

function createActionButton(label, action, id, classes) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = String(id);
  button.className = classes;
  button.textContent = label;
  return button;
}

function renderRxList(records) {
  state.records = records;
  updateStats(records);

  if (!refs.rxGrid || !refs.rxEmptyState) return;
  refs.rxGrid.innerHTML = '';
  refs.rxEmptyState.classList.toggle('hidden', records.length > 0);

  if (!records.length) return;

  const fragment = document.createDocumentFragment();

  records.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'overflow-hidden rounded-3xl border border-[#8BCFDD]/60 bg-white shadow-lg shadow-[#8BCFDD]/10 transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800 dark:bg-[#0E1A25]';

    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.dataset.action = 'preview';
    previewButton.dataset.id = String(record.id);
    previewButton.className = 'flex h-52 w-full items-center justify-center overflow-hidden bg-[#F8F7F7] p-4 dark:bg-slate-900/40';

    const image = document.createElement('img');
    image.src = record.imagen_data || '';
    image.alt = record.titulo || 'RX';
    image.className = 'max-h-full max-w-full rounded-2xl bg-white/70 p-2 object-contain transition duration-300 hover:scale-[1.02] dark:bg-[#0F2532]/70';
    previewButton.appendChild(image);

    const body = document.createElement('div');
    body.className = 'space-y-4 p-5';

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between gap-3';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'space-y-2';

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-[#1D5D69] dark:text-white';
    title.textContent = record.titulo || 'Sin título';

    const meta = document.createElement('p');
    meta.className = 'text-xs text-[#0F2532]/65 dark:text-slate-400';
    meta.textContent = `Estudio: ${formatDate(record.fecha_estudio)} · Carga: ${formatDateTime(record.fecha_creacion)}`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);
    header.appendChild(titleWrap);
    header.appendChild(createBadge(record.tipo_estudio || 'Sin tipo'));

    const notes = document.createElement('p');
    notes.className = 'min-h-[3.5rem] whitespace-pre-line text-sm text-[#0F2532]/80 dark:text-slate-300';
    notes.textContent = record.notas || 'Sin notas clínicas registradas.';

    const footer = document.createElement('div');
    footer.className = 'flex flex-wrap items-center justify-between gap-3 border-t border-[#8BCFDD]/35 pt-4 dark:border-slate-800';

    const fileMeta = document.createElement('div');
    fileMeta.className = 'space-y-1';

    const fileName = document.createElement('p');
    fileName.className = 'max-w-[14rem] truncate text-xs font-medium text-[#0F2532]/70 dark:text-slate-400';
    fileName.textContent = record.nombre_archivo || buildDownloadName(record);

    const fileSize = document.createElement('p');
    fileSize.className = 'text-xs text-[#0F2532]/55 dark:text-slate-500';
    fileSize.textContent = formatFileSize(record.tamano_bytes);

    fileMeta.appendChild(fileName);
    fileMeta.appendChild(fileSize);

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap gap-2';
    actions.appendChild(createActionButton(
      'Ver',
      'preview',
      record.id,
      'rounded-xl border border-[#4EABBE] px-3 py-2 text-xs font-semibold text-[#1D5D69] transition hover:bg-[#4EABBE]/10 dark:text-[#8BCFDD]'
    ));
    actions.appendChild(createActionButton(
      'Editar',
      'edit',
      record.id,
      'rounded-xl border border-[#8BCFDD] px-3 py-2 text-xs font-semibold text-[#0F2532] transition hover:border-[#4EABBE] hover:text-[#1D5D69] dark:border-slate-700 dark:text-slate-200 dark:hover:text-white'
    ));
    actions.appendChild(createActionButton(
      'Descargar',
      'download',
      record.id,
      'rounded-xl border border-[#8BCFDD] px-3 py-2 text-xs font-semibold text-[#0F2532] transition hover:border-[#4EABBE] hover:text-[#1D5D69] dark:border-slate-700 dark:text-slate-200 dark:hover:text-white'
    ));
    actions.appendChild(createActionButton(
      'Eliminar',
      'delete',
      record.id,
      'rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30'
    ));

    footer.appendChild(fileMeta);
    footer.appendChild(actions);

    body.appendChild(header);
    body.appendChild(notes);
    body.appendChild(footer);

    card.appendChild(previewButton);
    card.appendChild(body);
    fragment.appendChild(card);
  });

  refs.rxGrid.appendChild(fragment);
}

async function loadRxList() {
  if (!state.currentPacienteId) return;
  try {
    const rows = clinicalApi?.listRadiographs
      ? await clinicalApi.listRadiographs(state.currentPacienteId)
      : await dbAll(
        `SELECT id, paciente_id, titulo, tipo_estudio, fecha_estudio, notas, imagen_data, mime_type, nombre_archivo, tamano_bytes,
                fecha_creacion, fecha_actualizacion
         FROM radiografias_paciente
         WHERE paciente_id = ?
         ORDER BY datetime(COALESCE(NULLIF(fecha_estudio, ''), fecha_actualizacion, fecha_creacion)) DESC, id DESC`,
        [state.currentPacienteId]
      );
    renderRxList(rows);
  } catch (e) {
    console.error('Error cargando RX:', e);
    alert(`No se pudieron cargar las radiografías: ${e.message || e}`);
  }
}

async function handleImageSelection(file) {
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    alert('Selecciona un archivo de imagen válido.');
    if (refs.rxImagen) refs.rxImagen.value = '';
    return;
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    alert('La imagen es demasiado grande. Usa un archivo menor a 8 MB.');
    if (refs.rxImagen) refs.rxImagen.value = '';
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    state.currentImageData = dataUrl;
    state.currentFileName = file.name || 'rx';
    state.currentMimeType = file.type || '';
    state.currentFileBytes = Number(file.size || 0);

    if (refs.rxTitulo && !refs.rxTitulo.value.trim()) {
      refs.rxTitulo.value = file.name.replace(/\.[^.]+$/, '');
    }

    syncFormPreview();
  } catch (e) {
    console.error('Error leyendo imagen RX:', e);
    alert(e.message || 'No se pudo cargar la imagen seleccionada');
  }
}

async function saveRx(event) {
  event.preventDefault();

  if (!state.currentPacienteId) {
    alert('No se identificó al paciente de esta ficha.');
    return;
  }

  const titulo = refs.rxTitulo?.value?.trim() || '';
  const tipoEstudio = refs.rxTipo?.value?.trim() || 'Periapical';
  const fechaEstudio = refs.rxFecha?.value || null;
  const notas = refs.rxNotas?.value?.trim() || '';

  if (!titulo) {
    alert('Agrega un título para identificar el estudio.');
    refs.rxTitulo?.focus();
    return;
  }

  if (!state.currentImageData) {
    alert('Selecciona una imagen para guardar el estudio.');
    return;
  }

  try {
    if (!clinicalApi?.saveRadiograph) {
      throw new Error('Clinical API no disponible');
    }

    const saved = await clinicalApi.saveRadiograph({
      id: state.editingId || null,
      paciente_id: state.currentPacienteId,
      titulo,
      tipo_estudio: tipoEstudio,
      fecha_estudio: fechaEstudio,
      notas,
      imagen_data: state.currentImageData,
      mime_type: state.currentMimeType || null,
      nombre_archivo: state.currentFileName || null,
      tamano_bytes: Number(state.currentFileBytes || 0),
    });
    notifyRxSync({ action: state.editingId ? 'updated' : 'created', rxId: saved?.id || state.editingId || null });

    closeFormModal();
    await loadRxList();
  } catch (e) {
    console.error('Error guardando RX:', e);
    alert(`No se pudo guardar el estudio: ${e.message || e}`);
  }
}

function getRecordById(id) {
  return state.records.find(record => Number(record.id) === Number(id)) || null;
}

function downloadRecord(record) {
  if (!record?.imagen_data) return;
  const link = document.createElement('a');
  link.href = record.imagen_data;
  link.download = buildDownloadName(record);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openPreviewModal(record) {
  if (!record || !refs.rxPreviewLargeImage) return;
  state.previewRecordId = Number(record.id);

  refs.rxPreviewTypeTag.textContent = record.tipo_estudio || 'Estudio';
  refs.rxPreviewTitle.textContent = record.titulo || 'Vista previa';
  refs.rxPreviewDate.textContent = `Estudio: ${formatDate(record.fecha_estudio)} · Actualizado: ${formatDateTime(record.fecha_actualizacion || record.fecha_creacion)}`;
  refs.rxPreviewLargeImage.src = record.imagen_data || '';
  refs.rxPreviewFileName.textContent = record.nombre_archivo || buildDownloadName(record);
  refs.rxPreviewFileSize.textContent = formatFileSize(record.tamano_bytes);
  refs.rxPreviewNotes.textContent = record.notas || 'Sin notas clínicas registradas.';

  openModal(refs.rxPreviewModal);
}

function closePreviewModal() {
  state.previewRecordId = null;
  if (refs.rxPreviewLargeImage) refs.rxPreviewLargeImage.src = '';
  closeModal(refs.rxPreviewModal);
}

async function deleteRecord(record) {
  if (!record) return;
  const ok = confirm(`¿Eliminar el estudio "${record.titulo || 'sin título'}"?`);
  if (!ok) return;

  try {
    if (!clinicalApi?.removeRadiograph) {
      throw new Error('Clinical API no disponible');
    }
    await clinicalApi.removeRadiograph({ id: record.id, paciente_id: state.currentPacienteId });
    notifyRxSync({ action: 'deleted', rxId: record.id });
    if (state.previewRecordId === Number(record.id)) {
      closePreviewModal();
    }
    await loadRxList();
  } catch (e) {
    console.error('Error eliminando RX:', e);
    alert(`No se pudo eliminar el estudio: ${e.message || e}`);
  }
}

async function handleGridClick(event) {
  const button = event.target.closest('[data-action][data-id]');
  if (!button) return;

  const record = getRecordById(button.dataset.id);
  if (!record) return;

  switch (button.dataset.action) {
    case 'preview':
      openPreviewModal(record);
      break;
    case 'edit':
      openFormModal(record);
      break;
    case 'download':
      downloadRecord(record);
      break;
    case 'delete':
      await deleteRecord(record);
      break;
    default:
      break;
  }
}

function bindEvents() {
  refs.btnAddRx?.addEventListener('click', () => openFormModal());
  refs.closeRxForm?.addEventListener('click', closeFormModal);
  refs.cancelRxForm?.addEventListener('click', closeFormModal);
  refs.rxForm?.addEventListener('submit', saveRx);
  refs.rxGrid?.addEventListener('click', handleGridClick);
  refs.rxImagen?.addEventListener('change', (event) => handleImageSelection(event.target.files?.[0]));

  refs.rxFormModal?.addEventListener('click', (event) => {
    if (event.target === refs.rxFormModal) closeFormModal();
  });

  refs.closeRxPreview?.addEventListener('click', closePreviewModal);
  refs.rxPreviewModal?.addEventListener('click', (event) => {
    if (event.target === refs.rxPreviewModal) closePreviewModal();
  });
  refs.rxDownloadPreview?.addEventListener('click', () => {
    const record = getRecordById(state.previewRecordId);
    if (record) downloadRecord(record);
  });
}

async function ensureTableAvailable() {
  const row = await dbGet(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'radiografias_paciente'"
  );
  if (!row) {
    throw new Error('La tabla radiografias_paciente no está disponible todavía.');
  }
}

async function init() {
  cacheDom();
  state.currentPacienteId = getPacienteId();
  if (!state.currentPacienteId) {
    alert('No se pudo determinar el paciente de esta ficha.');
    return;
  }

  try {
    bindEvents();
    await loadRxList();
  } catch (e) {
    console.error('No se pudo inicializar la pestaña RX:', e);
    alert(e.message || 'No se pudo inicializar la pestaña RX');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
