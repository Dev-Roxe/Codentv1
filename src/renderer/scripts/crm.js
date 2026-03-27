// CRM logic
let db = (window.api && window.api.db) ? window.api.db : null;
if (!db && window.parent && window.parent !== window && window.parent.api && window.parent.api.db) {
  db = window.parent.api.db;
}

const STATUS_ICONS = {
  success: '<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
  error: '<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>'
};

const State = {
  templates: [],
  campaigns: [],
  surveyHistory: [],
  surveyTemplates: [],
  allPatients: [],
  recipientTargets: {
    email: { currentPatients: [], selectedIds: new Set() },
    survey: { currentPatients: [], selectedIds: new Set() },
  },
  modalRecipientIds: new Set(),
  activeRecipientTarget: 'email',
  editingTemplateId: null,
  editingTemplateImage: null,
  currentTemplateImage: null,
  templateType: 'email',
  editingCampaignId: null,
  editingSurveyTemplateId: null,
  gmailConnected: false,
  activeSendTarget: null,
  activeEmailFieldId: 'emailMessage',
  templateView: 'active',
  templateSearch: '',
};

// Toast Notification System
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    error: '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info: '<svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}


function $(id) {
  return document.getElementById(id);
}

function setInlineStatus(el, iconSvg, message) {
  if (!el) return;
  el.innerHTML = '';
  const wrap = document.createElement('span');
  wrap.className = 'inline-flex items-center gap-2';
  const icon = document.createElement('span');
  icon.className = 'inline-flex';
  icon.innerHTML = iconSvg;
  const text = document.createElement('span');
  text.textContent = message;
  wrap.appendChild(icon);
  wrap.appendChild(text);
  el.appendChild(wrap);
}

function showModal(modal, show) {
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceTemplateVars(text, data) {
  const map = {
    '{nombre}': data?.nombre || '',
    '{apellido}': data?.apellido || '',
    '{telefono}': data?.telefono || '',
    '{email}': data?.email || '',
    '{fecha_cita}': data?.fecha_cita || '',
    '{doctor}': data?.doctor || '',
  };
  return Object.keys(map).reduce((acc, key) => acc.split(key).join(map[key]), String(text || ''));
}

function prepareTemplateImageAttachment(imageDataUrl) {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') return [];

  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return [];

  const mimeType = match[1];
  const dataBase64 = match[2];

  const ext = mimeType.split('/')[1] || 'png';
  const filename = `template-image.${ext}`;

  return [{
    filename,
    mimeType,
    dataBase64
  }];
}

function formatDateTime(value) {
  if (!value) return '';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateShort(value) {
  if (!value) return '';
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeDateTimeInput(value) {
  if (!value) return null;
  if (value.includes('T')) {
    return value.replace('T', ' ') + (value.length === 16 ? ':00' : '');
  }
  return value;
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (!match) return '';
  return `${match[1]}T${match[2]}`;
}

function insertAtCursor(field, text) {
  if (!field) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  const current = field.value || '';
  field.value = current.substring(0, start) + text + current.substring(end);
  const cursor = start + text.length;
  field.setSelectionRange(cursor, cursor);
  field.focus();
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
        resolve([]);
      }
    } catch (e) { reject(e); }
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) return reject(new Error('DB no disponible'));
      if (db.run && db.run.length >= 3) {
        db.run(sql, params, function (err) { if (err) return reject(err); resolve(this); });
      } else if (db.run) {
        db.run(sql, params).then(res => resolve(res)).catch(reject);
      } else {
        reject(new Error('DB methods not available'));
      }
    } catch (e) { reject(e); }
  });
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.classList.remove('active', 'border-[#4EABBE]', 'text-[#4EABBE]', 'font-semibold', 'border-b-2');
        b.classList.add('text-gray-500', 'hover:text-gray-700', 'font-medium');
      });

      btn.classList.add('active', 'border-[#4EABBE]', 'text-[#4EABBE]', 'font-semibold', 'border-b-2');
      btn.classList.remove('text-gray-500', 'hover:text-gray-700', 'font-medium');

      tabContents.forEach(content => content.classList.add('hidden'));
      const el = document.getElementById(`${targetTab}-tab`);
      if (el) el.classList.remove('hidden');
    });
  });
}

function initSmsCounter() {
  const smsText = document.getElementById('smsText');
  const charCount = document.getElementById('char-count');
  const smsPreview = document.getElementById('smsPreview');

  if (smsText) {
    smsText.addEventListener('input', (e) => {
      const count = e.target.value.length;
      if (charCount) charCount.textContent = count;
      if (smsPreview) smsPreview.textContent = e.target.value || 'Escribe tu mensaje para ver la vista previa...';
    });
  }
}



function mapRecipientRow(row) {
  const nombre = String(row?.nombre || '').trim();
  const apellido = String(row?.apellido || '').trim();
  const fullName = [nombre, apellido].filter(Boolean).join(' ').trim();

  return {
    id: row?.id,
    nombre: fullName || nombre,
    apellido,
    email: row?.email || '',
    telefono: row?.telefono || '',
    fecha_cita: formatDateTime(row?.proxima_cita || ''),
    doctor: row?.doctor || ''
  };
}

function buildPatientsSql(group) {
  let sql = `
    SELECT p.id, p.nombre, p.apellido, p.email, p.telefono,
      MAX(c.fecha_hora) as ultima_cita,
      MIN(CASE WHEN c.fecha_hora >= datetime('now','localtime') THEN c.fecha_hora END) as proxima_cita,
      (
        SELECT u.nombre || ' ' || COALESCE(u.apellido, '')
        FROM citas c2
        LEFT JOIN usuarios u ON u.id = c2.dentista_id
        WHERE c2.paciente_id = p.id AND c2.fecha_hora >= datetime('now','localtime')
        ORDER BY c2.fecha_hora ASC
        LIMIT 1
      ) as doctor
    FROM pacientes p
    LEFT JOIN citas c ON c.paciente_id = p.id
    WHERE p.email IS NOT NULL AND p.email != ''
    GROUP BY p.id
  `;

  if (group === 'active') {
    sql += ` HAVING ultima_cita >= datetime('now','localtime','-6 months')`;
  } else if (group === 'inactive') {
    sql += ` HAVING ultima_cita IS NULL OR ultima_cita < datetime('now','localtime','-6 months')`;
  } else if (group === 'upcoming') {
    sql += ` HAVING proxima_cita IS NOT NULL AND proxima_cita <= datetime('now','localtime','+7 days')`;
  }

  return sql;
}

async function fetchPatients(group, limit) {
  let sql = buildPatientsSql(group);
  sql += ' ORDER BY p.nombre ASC';
  if (Number.isFinite(limit)) {
    sql += ` LIMIT ${limit}`;
  }

  try {
    const rows = await dbAll(sql);
    return rows.map(mapRecipientRow);
  } catch (e) {
    console.error('fetchPatients error', e);
    return [];
  }
}

async function loadAllPatients() {
  State.allPatients = await fetchPatients('all', 1000);
}

function getRecipientState(target) {
  return State.recipientTargets[target] || State.recipientTargets.email;
}

function getRecipientElements(target) {
  if (target === 'survey') {
    return {
      countEl: $('surveyRecipientCount'),
      selectedContainer: $('surveySelectedPatientsContainer'),
      selectEl: $('surveyRecipients'),
    };
  }
  return {
    countEl: $('recipientCount'),
    selectedContainer: $('selectedPatientsContainer'),
    selectEl: $('emailRecipients'),
  };
}

async function loadPatients(group, target = 'email') {
  const recipientState = getRecipientState(target);

  if (group === 'custom') {
    if (!State.allPatients.length) await loadAllPatients();
    recipientState.currentPatients = State.allPatients.filter(p => recipientState.selectedIds.has(p.id));
    updateRecipientSummary(target);
    return;
  }

  recipientState.currentPatients = await fetchPatients(group, 500);
  recipientState.selectedIds = new Set(recipientState.currentPatients.map(p => p.id));
  updateRecipientSummary(target);
}

function updateRecipientSummary(target = 'email') {
  const { countEl, selectedContainer, selectEl } = getRecipientElements(target);
  const recipients = getRecipientState(target).currentPatients;
  const count = recipients.length;

  if (countEl) {
    if (count > 0) {
      countEl.textContent = ` ${count} pacientes seleccionados`;
    } else {
      countEl.textContent = ' Selecciona un grupo';
    }
  }

  if (selectedContainer) {
    selectedContainer.innerHTML = '';
    if (selectEl?.value === 'custom' && count > 0) {
      const fragment = document.createDocumentFragment();
      recipients.slice(0, 8).forEach(p => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center px-2 py-1 bg-[#8BCFDD]/20 text-[#1D5D69] rounded-full text-xs mr-2 mt-2';
        chip.textContent = p.nombre || p.email;
        fragment.appendChild(chip);
      });
      selectedContainer.appendChild(fragment);
    }
  }

  if (target === 'email') {
    updateComposerButtons();
    renderEmailPreview();
    updateEmailEstimate();
  } else if (target === 'survey') {
    updateSurveyButtons();
  }
}


function updateComposerButtons() {
  const sendBulkEmailBtn = $('sendBulkEmailBtn');
  const gmailReady = State.gmailConnected;
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  const sendTestEmailBtn = $('sendTestEmailBtn');
  const testEmailStatus = $('testEmailStatus');

  if (!sendBulkEmailBtn) return;

  const recipientCount = State.recipientTargets.email.currentPatients.length;
  const hasRecipients = recipientCount > 0;
  const hasSubject = (emailSubject?.value || '').trim().length > 0;
  const hasBody = (emailMessage?.value || '').trim().length > 0;
  const isBusy = Boolean(State.activeSendTarget);
  const canSend = hasRecipients && hasSubject && hasBody && gmailReady && !isBusy;

  // Cambiar texto del botón según cantidad de destinatarios
  if (recipientCount === 1) {
    sendBulkEmailBtn.innerHTML = '📧 Enviar email';
  } else if (recipientCount > 1) {
    sendBulkEmailBtn.innerHTML = `📧 Enviar a ${recipientCount} pacientes`;
  } else {
    sendBulkEmailBtn.innerHTML = '📧 Enviar a todos';
  }

  sendBulkEmailBtn.disabled = !canSend;
  sendBulkEmailBtn.classList.toggle('opacity-60', !canSend);
  sendBulkEmailBtn.classList.toggle('cursor-not-allowed', !canSend);

  if (sendTestEmailBtn) {
    const canTest = hasSubject && hasBody && gmailReady && !isBusy;
    sendTestEmailBtn.disabled = !canTest;
    sendTestEmailBtn.classList.toggle('opacity-60', !canTest);
    sendTestEmailBtn.classList.toggle('cursor-not-allowed', !canTest);
    if (!canTest && testEmailStatus) {
      testEmailStatus.textContent = gmailReady
        ? 'Completa asunto y mensaje para enviar una prueba.'
        : 'Conecta Gmail para enviar una prueba.';
      testEmailStatus.dataset.state = 'hint';
    } else if (canTest && testEmailStatus?.dataset.state === 'hint') {
      testEmailStatus.textContent = '';
      testEmailStatus.dataset.state = '';
    }
  }
}


function updateSurveyButtons() {
  const sendSurveyEmailsBtn = $('sendSurveyEmailsBtn');
  const gmailReady = State.gmailConnected;
  const surveyTitleInput = $('surveyTitleInput');
  const surveyLinkInput = $('surveyLinkInput');

  if (!sendSurveyEmailsBtn) return;

  const hasRecipients = State.recipientTargets.survey.currentPatients.length > 0;
  const hasTitle = (surveyTitleInput?.value || '').trim().length > 0;
  const hasLink = (surveyLinkInput?.value || '').trim().length > 0;
  const isBusy = Boolean(State.activeSendTarget);
  const canSend = hasRecipients && hasTitle && hasLink && gmailReady && !isBusy;

  sendSurveyEmailsBtn.disabled = !canSend;
  sendSurveyEmailsBtn.classList.toggle('opacity-60', !canSend);
  sendSurveyEmailsBtn.classList.toggle('cursor-not-allowed', !canSend);
}


function renderEmailPreview() {
  const emailMessage = $('emailMessage');
  const charCount = $('charCount');

  if (charCount && emailMessage) {
    charCount.textContent = `${emailMessage.value.length} caracteres`;
  }

  updateComposerButtons();
}


function renderFullPreview() {
  const previewModal = $('emailPreviewModal');
  const fullPreviewContent = $('fullPreviewContent');
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');

  if (!previewModal || !fullPreviewContent || !emailSubject || !emailMessage) return;

  const sample = State.recipientTargets.email.currentPatients[0] || {};
  const subject = replaceTemplateVars(emailSubject.value, sample).trim() || 'Sin asunto';
  const body = replaceTemplateVars(emailMessage.value, sample).trim() || '';
  const htmlBody = escapeHtml(body).replace(/\n/g, '<br>');

  fullPreviewContent.innerHTML = `
    <div class="space-y-3">
      <div>
        <p class="text-xs text-[#0F2532]/50">Asunto</p>
        <p class="text-base font-semibold text-[#0F2532] dark:text-white">${escapeHtml(subject)}</p>
      </div>
      <div>
        <p class="text-xs text-[#0F2532]/50">Mensaje</p>
        <div class="text-sm text-[#0F2532]/70 dark:text-gray-300">${htmlBody || '<span class="text-gray-400">Sin contenido</span>'}</div>
      </div>
    </div>
  `;

  showModal(previewModal, true);
}

function applyTemplateToComposer(template) {
  if (!template) return;
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  if (emailSubject && template.asunto) emailSubject.value = template.asunto;
  if (emailMessage) emailMessage.value = template.contenido || '';
  State.currentTemplateImage = template.imagen || null;
  renderEmailPreview();
}

function toHtmlBody(text) {
  const escaped = escapeHtml(text || '').replace(/\r?\n/g, '<br>');
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${escaped}</div>`;
}

function getEmailThrottleMs() {
  const value = Number($('emailThrottle')?.value || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  if (minutes === 0) return `${remaining}s`;
  if (remaining === 0) return `${minutes}m`;
  return `${minutes}m ${remaining}s`;
}

function updateEmailEstimate() {
  const estimate = $('emailEstimate');
  if (!estimate) return;
  const count = State.recipientTargets.email.currentPatients.length;
  const delayMs = getEmailThrottleMs();

  if (!count) {
    estimate.textContent = 'Selecciona destinatarios para ver la espera.';
    return;
  }

  if (!delayMs) {
    estimate.textContent = 'Sin espera adicional.';
    return;
  }

  const totalSeconds = (delayMs * Math.max(0, count - 1)) / 1000;
  estimate.textContent = `Espera total estimada: ${formatDuration(totalSeconds)}.`;
}

function isTemplateActive(template) {
  return Number(template?.activo ?? 1) !== 0;
}

function getTemplateCounts() {
  return State.templates.reduce((acc, template) => {
    if (isTemplateActive(template)) acc.active += 1;
    else acc.archived += 1;
    return acc;
  }, { active: 0, archived: 0 });
}

function getVisibleTemplates() {
  const search = String(State.templateSearch || '').trim().toLowerCase();
  const wantActive = State.templateView !== 'archived';

  return State.templates
    .filter(template => isTemplateActive(template) === wantActive)
    .filter(template => {
      if (!search) return true;
      const haystack = [
        template?.nombre,
        template?.asunto,
        template?.contenido
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => {
      const predefinedDiff = Number(b?.es_predeterminada || 0) - Number(a?.es_predeterminada || 0);
      if (predefinedDiff !== 0) return predefinedDiff;

      const aDate = Date.parse(a?.fecha_actualizacion || a?.fecha_creacion || 0) || 0;
      const bDate = Date.parse(b?.fecha_actualizacion || b?.fecha_creacion || 0) || 0;
      return bDate - aDate;
    });
}

function updateTemplateFilterUi(visibleCount) {
  const { active, archived } = getTemplateCounts();
  const activeBtn = $('templateViewActiveBtn');
  const archivedBtn = $('templateViewArchivedBtn');
  const activeCount = $('activeTemplateCount');
  const archivedCount = $('archivedTemplateCount');
  const summary = $('templateViewSummary');

  if (activeCount) activeCount.textContent = String(active);
  if (archivedCount) archivedCount.textContent = String(archived);

  if (activeBtn) {
    const isSelected = State.templateView === 'active';
    activeBtn.className = isSelected
      ? 'px-3 py-2 rounded-lg border border-[#4EABBE] bg-[#4EABBE]/10 text-[#1D5D69] dark:text-white text-sm font-semibold'
      : 'px-3 py-2 rounded-lg border border-[#D9D9D9] dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0F2532]/70 dark:text-gray-200 text-sm font-medium';
  }

  if (archivedBtn) {
    const isSelected = State.templateView === 'archived';
    archivedBtn.className = isSelected
      ? 'px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm font-semibold'
      : 'px-3 py-2 rounded-lg border border-[#D9D9D9] dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0F2532]/70 dark:text-gray-200 text-sm font-medium';
  }

  if (!summary) return;

  if (State.templateView === 'archived') {
    summary.textContent = archived
      ? `Mostrando ${visibleCount} plantilla(s) archivada(s). Puedes restaurarlas cuando quieras.`
      : 'No hay plantillas archivadas.';
    return;
  }

  if (!active) {
    summary.textContent = 'No hay plantillas activas. Crear nuevas no elimina las existentes.';
    return;
  }

  if (State.templateSearch.trim()) {
    summary.textContent = `Mostrando ${visibleCount} de ${active} plantilla(s) activas. Archivar no elimina tus datos.`;
    return;
  }

  summary.textContent = `Tienes ${active} plantilla(s) activas. Al eliminar ahora se archivan para no perder informacion.`;
}

async function loadTemplates() {
  try {
    State.templates = await dbAll(`
      SELECT *
      FROM crm_templates
      WHERE tipo = 'email'
      ORDER BY COALESCE(fecha_actualizacion, fecha_creacion) DESC
    `);
  } catch (e) {
    console.error('loadTemplates error', e);
    State.templates = [];
  }
  renderTemplates();
  populateTemplateSelects();
}

function renderTemplates() {
  const grid = $('templateGrid');
  if (!grid) return;

  if (State.templates.length === 0) {
    updateTemplateFilterUi(0);
    grid.innerHTML = '<div class="col-span-2 text-center text-sm text-[#0F2532]/50 dark:text-gray-400">No hay plantillas creadas.</div>';
    return;
  }

  const visibleTemplates = getVisibleTemplates();
  updateTemplateFilterUi(visibleTemplates.length);

  if (!visibleTemplates.length) {
    grid.innerHTML = `
      <div class="col-span-2 text-center text-sm text-[#0F2532]/50 dark:text-gray-400 py-10">
        ${State.templateView === 'archived'
          ? 'No hay plantillas archivadas que coincidan con la busqueda.'
          : 'No hay plantillas activas que coincidan con la busqueda.'}
      </div>
    `;
    return;
  }

  grid.innerHTML = visibleTemplates.map(t => {
    const snippet = escapeHtml((t.contenido || '').slice(0, 120));
    const image = t.imagen ? `<img src="${t.imagen}" alt="${escapeHtml(t.nombre)}" class="w-full h-24 object-cover rounded-lg" />` :
      '<div class="w-full h-24 rounded-lg bg-[#F8F7F7] dark:bg-gray-700 flex items-center justify-center text-xs text-[#0F2532]/40">Sin imagen</div>';

    const isPredefined = t.es_predeterminada === 1;
    const isArchived = !isTemplateActive(t);
    const badges = [];

    if (isPredefined) {
      badges.push('<span class="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-full font-medium">Predeterminada</span>');
    }

    if (isArchived) {
      badges.push('<span class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-medium">Archivada</span>');
    }

    const archiveButton = isArchived
      ? `<button class="template-action px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg text-xs border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition" data-action="restore" data-id="${t.id}">Restaurar</button>`
      : (isPredefined
        ? ''
        : `<button class="template-action px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition" data-action="archive" data-id="${t.id}">Archivar</button>`);

    return `
      <div class="border border-[#E6E6E6] dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm ${isPredefined ? 'ring-2 ring-emerald-200 dark:ring-emerald-800' : ''} ${isArchived ? 'opacity-80' : ''}">
        <div class="${isArchived ? 'grayscale-[0.2]' : ''}">
          ${image}
        </div>
        <div class="mt-3 flex items-start justify-between gap-2">
          <h3 class="font-semibold text-[#0F2532] dark:text-white flex-1">${escapeHtml(t.nombre)}</h3>
          <div class="flex flex-wrap justify-end gap-1">${badges.join('')}</div>
        </div>
        <p class="text-xs text-[#0F2532]/60 dark:text-gray-400 mt-1 min-h-[36px]">${snippet || 'Sin contenido'}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          ${isArchived ? '' : `<button class="template-action px-3 py-1 bg-[#4EABBE] text-white rounded-lg text-xs hover:bg-[#1D5D69] transition" data-action="use" data-id="${t.id}">Usar</button>`}
          <button class="template-action px-3 py-1 bg-[#F8F7F7] dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg text-xs border border-[#E6E6E6] dark:border-gray-600 hover:bg-[#E8ECEE] dark:hover:bg-gray-600 transition" data-action="edit" data-id="${t.id}">Editar</button>
          <button class="template-action px-3 py-1 bg-[#F8F7F7] dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg text-xs border border-[#E6E6E6] dark:border-gray-600 hover:bg-[#E8ECEE] dark:hover:bg-gray-600 transition" data-action="duplicate" data-id="${t.id}">Duplicar</button>
          ${archiveButton}
        </div>
      </div>
    `;
  }).join('');
}



async function loadSurveyHistory() {
  try {
    State.surveyHistory = await dbAll(
      `SELECT titulo, link, destinatarios, enviado_en
       FROM crm_encuestas
       ORDER BY enviado_en DESC
       LIMIT 6`
    );
  } catch (e) {
    console.error('loadSurveyHistory error', e);
    State.surveyHistory = [];
  }
  renderSurveyHistory();
}

function renderSurveyHistory() {
  const list = $('surveyHistoryList');
  if (!list) return;

  if (!State.surveyHistory.length) {
    list.innerHTML = '<div class="text-center py-8 text-[#0F2532]/50 dark:text-gray-400">Sin encuestas enviadas aún</div>';
    return;
  }

  list.innerHTML = State.surveyHistory.map(item => {
    const dateLabel = formatDateShort(item.enviado_en) || '---';
    const count = Number(item.destinatarios || 0);
    return `
      <div class="border border-[#E6E6E6] dark:border-gray-700 rounded-lg p-3 bg-white/60 dark:bg-gray-900/40">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-semibold text-[#0F2532] dark:text-white">${escapeHtml(item.titulo)}</p>
          <span class="text-xs text-[#0F2532]/50 dark:text-gray-400">${escapeHtml(dateLabel)}</span>
        </div>
        <p class="text-xs text-[#0F2532]/60 dark:text-gray-400 mt-1">${count} destinatarios</p>
        <p class="text-xs text-[#4EABBE] mt-1 break-all">${escapeHtml(item.link)}</p>
      </div>
    `;
  }).join('');
}

function populateTemplateSelects() {
  const campaignTemplateSelect = $('campaignTemplateSelect');

  if (campaignTemplateSelect) {
    const options = ['<option value="">-- Sin plantilla --</option>'];
    State.templates.filter(isTemplateActive).forEach(t => {
      options.push(`<option value="${t.id}">${escapeHtml(t.nombre)}</option>`);
    });
    campaignTemplateSelect.innerHTML = options.join('');
  }
}

function openTemplateModal(type, template) {
  const modal = $('templateEditorModal');
  const title = $('templateModalTitle');
  const subtitle = $('templateModalSubtitle');
  const nameInput = $('templateNameInput');
  const subjectInput = $('templateSubjectInput');
  const textInput = $('templateTextInput');
  const imageInput = $('templateImageInput');
  const imagePreview = $('templateImagePreview');

  State.templateType = type;
  State.editingTemplateId = template ? template.id : null;
  State.editingTemplateImage = template ? template.imagen : null;

  if (title) title.textContent = template ? 'Editar plantilla' : 'Nueva plantilla';
  if (subtitle) {
    subtitle.textContent = type === 'reminder'
      ? 'Crea una plantilla personalizada para recordatorios'
      : 'Crea una plantilla personalizada para tus emails';
  }

  if (nameInput) nameInput.value = template?.nombre || '';
  if (subjectInput) subjectInput.value = template?.asunto || '';
  if (textInput) textInput.value = template?.contenido || '';
  if (imageInput) imageInput.value = '';
  if (imagePreview) {
    if (template?.imagen) {
      imagePreview.src = template.imagen;
      imagePreview.classList.remove('hidden');
    } else {
      imagePreview.src = '';
      imagePreview.classList.add('hidden');
    }
  }

  showModal(modal, true);
}

async function saveTemplate() {
  const nameInput = $('templateNameInput');
  const subjectInput = $('templateSubjectInput');
  const textInput = $('templateTextInput');

  const nombre = (nameInput?.value || '').trim();
  const asunto = (subjectInput?.value || '').trim();
  const contenido = (textInput?.value || '').trim();

  if (!nombre || !contenido) {
    showToast('Por favor completa el nombre y el contenido de la plantilla', 'warning', 'Campos requeridos');
    return;
  }

  try {
    const payload = {
      id: State.editingTemplateId,
      nombre,
      asunto,
      contenido,
      imagen: State.editingTemplateImage,
      tipo: State.templateType
    };

    await window.api.crm.saveTemplate(payload);

    if (State.editingTemplateId) {
      showToast('Plantilla actualizada correctamente', 'success', '✓ Guardado');
    } else {
      showToast('Nueva plantilla creada exitosamente', 'success', '✓ Creada');
    }

    showModal($('templateEditorModal'), false);
    await loadTemplates();
  } catch (e) {
    console.error('saveTemplate error', e);
    showToast(e.message || 'Error desconocido al guardar', 'error', 'Error al guardar');
  }
}

async function deleteTemplate(id) {
  return archiveTemplate(id);
}

async function archiveTemplate(id) {
  const template = State.templates.find(t => String(t.id) === String(id));
  if (!template) return;
  if (template.es_predeterminada === 1) {
    showToast('Las plantillas predeterminadas no se pueden eliminar. Puedes editarlas o duplicarlas.', 'warning', 'Acción no permitida');
    return;
  }

  if (!confirm(`Archivar la plantilla "${template.nombre}"? Podras restaurarla despues.`)) return;
  try {
    await window.api.crm.archiveTemplate(id);
    await loadTemplates();
    showToast('Plantilla archivada correctamente', 'success', '✅ Archivada');
  } catch (e) {
    console.error('archiveTemplate error', e);
    showToast('No se pudo archivar la plantilla', 'error', 'Error');
  }
}

async function restoreTemplate(id) {
  const template = State.templates.find(t => String(t.id) === String(id));
  if (!template) return;

  try {
    await window.api.crm.restoreTemplate(id);
    State.templateView = 'active';
    await loadTemplates();
    showToast('Plantilla restaurada correctamente', 'success', '✅ Restaurada');
  } catch (e) {
    console.error('restoreTemplate error', e);
    showToast('No se pudo restaurar la plantilla', 'error', 'Error');
  }
}

async function duplicateTemplate(id) {
  try {
    const template = State.templates.find(t => String(t.id) === String(id));
    if (!template) {
      showToast('Plantilla no encontrada', 'error', 'Error');
      return;
    }

    await window.api.crm.duplicateTemplate(id);
    await loadTemplates();
    showToast('Plantilla duplicada exitosamente', 'success', '✓ Duplicada');
  } catch (e) {
    console.error('duplicateTemplate error', e);
    showToast('No se pudo duplicar la plantilla', 'error', 'Error');
  }
}

async function setDefaultReminderTemplate(id) {
  try {
    await window.api.crm.setDefaultReminderTemplate(id);
    await loadTemplates();
  } catch (e) {
    console.error('setDefaultReminderTemplate error', e);
  }
}

async function loadCampaigns() {
  try {
    const rows = await dbAll(`
      SELECT c.*, t.nombre as template_nombre
      FROM crm_campaigns c
      LEFT JOIN crm_templates t ON c.template_id = t.id
      ORDER BY c.fecha_creacion DESC
    `);
    State.campaigns = rows || [];
  } catch (e) {
    console.error('loadCampaigns error', e);
    State.campaigns = [];
  }
  renderCampaigns();
}

function renderCampaigns() {
  const tbody = $('campaignsTableBody');
  if (!tbody) return;

  const statusFilter = $('campaignStatusFilter')?.value || 'all';
  const search = ($('campaignSearchInput')?.value || '').toLowerCase();

  const filtered = State.campaigns.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.estado === statusFilter;
    const matchesSearch = !search ||
      String(c.nombre || '').toLowerCase().includes(search) ||
      String(c.descripcion || '').toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-10 text-center text-sm text-[#0F2532]/50 dark:text-gray-400">
          No hay campañas registradas
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const sent = Number(c.enviados || 0);
    const opens = Number(c.aperturas || 0);
    const clicks = Number(c.clicks || 0);
    const openRate = sent ? Math.round((opens / sent) * 100) : 0;
    const clickRate = sent ? Math.round((clicks / sent) * 100) : 0;
    const dateLabel = formatDateShort(c.programada_para || c.enviada_en || c.fecha_creacion);

    const statusStyles = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300',
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    };

    const statusLabels = {
      draft: 'Borrador',
      scheduled: 'Programada',
      active: 'Activa',
      completed: 'Completada'
    };

    const statusClass = statusStyles[c.estado] || statusStyles.draft;
    const statusLabel = statusLabels[c.estado] || 'Borrador';

    return `
      <tr class="hover:bg-[#F8F7F7]/60 dark:hover:bg-gray-700/60 transition">
        <td class="px-6 py-4">
          <div class="font-semibold text-[#0F2532] dark:text-white">${escapeHtml(c.nombre)}</div>
          <div class="text-sm text-[#0F2532]/60 dark:text-gray-400">${escapeHtml(c.descripcion || '')}</div>
        </td>
        <td class="px-6 py-4"><span class="px-3 py-1 bg-[#8BCFDD]/30 dark:bg-[#8BCFDD]/20 text-[#1D5D69] dark:text-[#8BCFDD] rounded-full text-xs font-medium">${c.tipo === 'sms' ? 'SMS' : 'Email'}</span></td>
        <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">${statusLabel}</span></td>
        <td class="px-6 py-4 text-sm font-medium text-[#0F2532] dark:text-gray-200">${sent}</td>
        <td class="px-6 py-4 text-sm font-medium text-[#0F2532] dark:text-gray-200">${opens}${sent ? ` (${openRate}%)` : ''}</td>
        <td class="px-6 py-4 text-sm font-medium text-[#0F2532] dark:text-gray-200">${clicks}${sent ? ` (${clickRate}%)` : ''}</td>
        <td class="px-6 py-4 text-sm text-[#0F2532]/60 dark:text-gray-400">${dateLabel || '-'}</td>
        <td class="px-6 py-4 text-right">
          <button class="campaign-action text-xs text-[#4EABBE] hover:underline" data-action="edit" data-id="${c.id}">Editar</button>
          <button class="campaign-action text-xs text-red-500 hover:underline ml-3" data-action="delete" data-id="${c.id}">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openCampaignModal(campaign) {
  const modal = $('campaignEditorModal');
  const title = $('campaignModalTitle');
  const subtitle = $('campaignModalSubtitle');

  State.editingCampaignId = campaign ? campaign.id : null;

  if (title) title.textContent = campaign ? 'Editar campaña' : 'Nueva campaña';
  if (subtitle) subtitle.textContent = campaign ? 'Actualiza los datos de la campaña' : 'Define el alcance y contenido de la campaña';

  $('campaignNameInput').value = campaign?.nombre || '';
  $('campaignDescInput').value = campaign?.descripcion || '';
  $('campaignTypeSelect').value = campaign?.tipo || 'email';
  $('campaignStatusSelect').value = campaign?.estado || 'draft';
  $('campaignAudienceSelect').value = campaign?.audiencia || 'all';
  $('campaignScheduleInput').value = toDateTimeLocal(campaign?.programada_para);
  $('campaignSubjectInput').value = campaign?.asunto || '';
  $('campaignBodyInput').value = campaign?.contenido || '';

  populateTemplateSelects();
  const templateSelect = $('campaignTemplateSelect');
  if (templateSelect) {
    templateSelect.value = campaign?.template_id ? String(campaign.template_id) : '';
  }

  toggleCampaignTemplateState();
  showModal(modal, true);
}

function toggleCampaignTemplateState() {
  const typeSelect = $('campaignTypeSelect');
  const templateSelect = $('campaignTemplateSelect');
  if (!typeSelect || !templateSelect) return;
  const isEmail = typeSelect.value === 'email';
  templateSelect.disabled = !isEmail;
  if (!isEmail) {
    templateSelect.value = '';
  }
}

async function saveCampaign() {
  const nombre = ($('campaignNameInput')?.value || '').trim();
  const descripcion = ($('campaignDescInput')?.value || '').trim();
  const tipo = $('campaignTypeSelect')?.value || 'email';
  const estado = $('campaignStatusSelect')?.value || 'draft';
  const audiencia = $('campaignAudienceSelect')?.value || 'all';
  const rawTemplateId = $('campaignTemplateSelect')?.value || null;
  const templateId = tipo === 'email' ? rawTemplateId : null;
  const asunto = ($('campaignSubjectInput')?.value || '').trim();
  const contenido = ($('campaignBodyInput')?.value || '').trim();
  const programadaPara = normalizeDateTimeInput($('campaignScheduleInput')?.value || '');

  if (!nombre) {
    showToast('Por favor ingresa un nombre para la campaña', 'warning', 'Campo requerido');
    return;
  }

  try {
    const payload = {
      id: State.editingCampaignId,
      nombre,
      descripcion,
      tipo,
      estado,
      audiencia,
      template_id: templateId || null,
      asunto: asunto || null,
      contenido: contenido || null,
      programada_para: programadaPara
    };

    await window.api.crm.saveCampaign(payload);

    if (State.editingCampaignId) {
      showToast('Campaña actualizada correctamente', 'success', '✓ Guardado');
    } else {
      showToast('Nueva campaña creada exitosamente', 'success', '✓ Creada');
    }

    showModal($('campaignEditorModal'), false);
    await loadCampaigns();
  } catch (e) {
    console.error('saveCampaign error', e);
    showToast(e.message || 'Error desconocido al guardar', 'error', 'Error al guardar');
  }
}

async function deleteCampaign(id) {
  if (!confirm('Eliminar esta campaña?')) return;
  try {
    await window.api.crm.deleteCampaign(id);
    await loadCampaigns();
  } catch (e) {
    console.error('deleteCampaign error', e);
    alert('Error eliminando campaña');
  }
}

async function checkGmailStatus() {
  if (!window.electronAPI) return;
  const gmailStatus = $('gmailStatus');
  const connectGmailBtn = $('connectGmailBtn');

  try {
    const result = await window.electronAPI.invoke('gmail-has-token');
    State.gmailConnected = result?.connected || false;
  } catch (e) {
    State.gmailConnected = false;
  }

  if (gmailStatus) {
    gmailStatus.textContent = State.gmailConnected ? 'Gmail conectado' : 'Gmail sin conectar';
    gmailStatus.className = State.gmailConnected
      ? 'inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800'
      : 'inline-flex items-center px-2.5 py-1 rounded-full bg-white/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 text-xs font-medium border border-blue-200/70 dark:border-blue-800';
  }
  if (connectGmailBtn) {
    connectGmailBtn.textContent = State.gmailConnected ? 'Cuenta remitente conectada' : 'Conectar cuenta remitente';
    connectGmailBtn.disabled = State.gmailConnected;
    connectGmailBtn.classList.toggle('opacity-60', State.gmailConnected);
    connectGmailBtn.classList.toggle('cursor-not-allowed', State.gmailConnected);
  }

  // Los campos siempre están habilitados para permitir escritura
  updateComposerButtons();
  updateSurveyButtons();
}

async function connectGmail() {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.invoke('gmail-connect-fixed-account');
  if (!result?.success) {
    showToast(result?.error || 'No se pudo generar el link de autorización', 'error', 'Error');
    return;
  }
  showToast(result?.email ? `Cuenta conectada: ${result.email}` : 'Gmail conectado exitosamente', 'success', 'Conectado');
  await checkGmailStatus();
}

async function saveGmailToken() {
  if (!window.electronAPI) return;
  const input = $('gmailAuthCodeInput');
  const code = (input?.value || '').trim();
  if (!code) {
    showToast('Ingresa el código de autorización', 'warning', 'Campo requerido');
    return;
  }
  const result = await window.electronAPI.invoke('gmail-save-token', code);
  if (!result?.success) {
    showToast(result?.error || 'Error guardando token', 'error', 'Error');
    return;
  }
  if (input) input.value = '';
  showModal($('gmailAuthModal'), false);
  showToast('Gmail conectado exitosamente', 'success', '✓ Conectado');
  await checkGmailStatus();
}

function setupEmailComposer() {
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  const previewEmailBtn = $('previewEmailBtn');

  if (emailSubject) {
    emailSubject.addEventListener('input', renderEmailPreview);
    emailSubject.addEventListener('focus', () => {
      State.activeEmailFieldId = 'emailSubject';
    });
  }

  if (emailMessage) {
    emailMessage.addEventListener('input', renderEmailPreview);
    emailMessage.addEventListener('focus', () => {
      State.activeEmailFieldId = 'emailMessage';
    });
  }

  if (previewEmailBtn) {
    previewEmailBtn.addEventListener('click', () => {
      renderFullPreview();
    });
  }
}

function setupVariableTokens() {
  const tokenWrap = $('emailVarTokens');
  if (!tokenWrap) return;
  tokenWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-token]');
    if (!btn) return;
    const token = btn.dataset.token;
    const field = $(State.activeEmailFieldId || 'emailMessage');
    insertAtCursor(field, token);
    renderEmailPreview();
  });
}

async function sendTestEmail() {
  if (!State.gmailConnected) {
    alert('Conecta Gmail para enviar una prueba');
    return;
  }

  if (State.activeSendTarget) {
    alert('Hay un envío en curso. Espera a que termine.');
    return;
  }

  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  const testAddressInput = $('emailTestAddress');
  const testEmailStatus = $('testEmailStatus');
  const sendTestEmailBtn = $('sendTestEmailBtn');

  const subjectRaw = (emailSubject?.value || '').trim();
  const bodyRaw = (emailMessage?.value || '').trim();
  const testAddress = (testAddressInput?.value || '').trim();

  if (!subjectRaw || !bodyRaw) {
    alert('Completa el asunto y el mensaje');
    return;
  }

  if (!testAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testAddress)) {
    alert('Ingresa un correo de prueba válido');
    return;
  }

  const sample = State.recipientTargets.email.currentPatients[0] || {
    nombre: 'Paciente',
    apellido: '',
    email: testAddress,
    telefono: '',
    fecha_cita: '',
    doctor: ''
  };

  const subject = replaceTemplateVars(subjectRaw, sample).trim();
  const body = replaceTemplateVars(bodyRaw, sample).trim();

  try {
    if (sendTestEmailBtn) sendTestEmailBtn.disabled = true;
    if (testEmailStatus) testEmailStatus.textContent = 'Enviando prueba...';

    const result = await window.electronAPI.invoke('gmail-send', {
      to: testAddress,
      subject,
      html: toHtmlBody(body),
      attachments: prepareTemplateImageAttachment(State.currentTemplateImage)
    });

    if (result?.success) {
      if (testEmailStatus) setInlineStatus(testEmailStatus, STATUS_ICONS.success, 'Prueba enviada');
    } else {
      if (testEmailStatus) setInlineStatus(testEmailStatus, STATUS_ICONS.error, result?.error || 'Envio fallido');
    }
  } catch (e) {
    console.error('sendTestEmail error', e);
    if (testEmailStatus) setInlineStatus(testEmailStatus, STATUS_ICONS.error, e.message);
  } finally {
    updateComposerButtons();
  }
}

function setupSurveyComposer() {
  const surveyTitleInput = $('surveyTitleInput');
  const surveyLinkInput = $('surveyLinkInput');

  if (surveyTitleInput) {
    surveyTitleInput.addEventListener('input', updateSurveyButtons);
  }

  if (surveyLinkInput) {
    surveyLinkInput.addEventListener('input', updateSurveyButtons);
  }
}

function setupEmailSendOptions() {
  const throttle = $('emailThrottle');
  const testAddress = $('emailTestAddress');
  const testEmailStatus = $('testEmailStatus');
  const sendTestEmailBtn = $('sendTestEmailBtn');

  if (throttle) {
    throttle.addEventListener('change', updateEmailEstimate);
  }

  if (testAddress) {
    const saved = localStorage.getItem('crm_test_email');
    if (saved && !testAddress.value) testAddress.value = saved;
    testAddress.addEventListener('input', () => {
      localStorage.setItem('crm_test_email', testAddress.value.trim());
      if (testEmailStatus) testEmailStatus.textContent = '';
    });
  }

  if (sendTestEmailBtn) {
    sendTestEmailBtn.addEventListener('click', sendTestEmail);
  }
}

async function sendBulkEmail() {
  if (!State.gmailConnected) {
    showToast('Conecta Gmail antes de enviar correos masivos.', 'warning', 'Gmail requerido');
    return;
  }
  if (State.activeSendTarget) {
    alert('Hay un envío en curso. Espera a que termine.');
    return;
  }


  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  const sendBulkEmailBtn = $('sendBulkEmailBtn');
  const emailStatus = $('emailStatus');
  const emailStatusText = $('emailStatusText');
  const emailProgress = $('emailProgress');

  const subject = (emailSubject?.value || '').trim();
  const body = (emailMessage?.value || '').trim();

  if (!subject || !body) {
    alert('Completa el asunto y el mensaje');
    return;
  }

  if (State.recipientTargets.email.currentPatients.length === 0) {
    alert('Selecciona un grupo de pacientes');
    return;
  }

  const confirmSend = confirm(`Enviar email a ${State.recipientTargets.email.currentPatients.length} pacientes?`);
  if (!confirmSend) return;

  try {
    State.activeSendTarget = 'email';
    updateComposerButtons();
    if (emailStatus) emailStatus.classList.remove('hidden');
    if (emailStatusText) emailStatusText.textContent = 'Iniciando envio...';
    if (emailProgress) emailProgress.style.width = '0%';
    if (sendBulkEmailBtn) sendBulkEmailBtn.disabled = true;

    const recipients = State.recipientTargets.email.currentPatients.map(p => ({
      email: p.email,
      nombre: p.nombre,
      apellido: p.apellido,
      telefono: p.telefono,
      fecha_cita: p.fecha_cita,
      doctor: p.doctor
    }));

    const result = await window.electronAPI.invoke('send-bulk-email', {
      recipients,
      subject,
      body,
      throttleMs: getEmailThrottleMs(),
      attachments: prepareTemplateImageAttachment(State.currentTemplateImage)
    });

    if (result?.success) {
      if (emailStatusText) setInlineStatus(emailStatusText, STATUS_ICONS.success, `Enviado: ${result.sent}/${State.recipientTargets.email.currentPatients.length}`);
      if (emailProgress) emailProgress.style.width = '100%';
      showToast(`Envío completado exitosamente. ${result.sent} correos enviados.`, 'success', '✓ Envío completado');
      if (emailSubject) emailSubject.value = '';
      if (emailMessage) emailMessage.value = '';
      renderEmailPreview();
    } else {
      // Mostrar errores detallados
      let errorMessage = `Error al enviar correos.\n\nEnviados: ${result.sent || 0}\nFallidos: ${result.failed || 0}\n`;

      if (result.errors && result.errors.length > 0) {
        errorMessage += '\nDetalles de errores:\n';
        result.errors.slice(0, 5).forEach((err, index) => {
          errorMessage += `\n${index + 1}. ${err.email || 'Email desconocido'}\n   Error: ${err.error || 'Error desconocido'}`;
        });

        if (result.errors.length > 5) {
          errorMessage += `\n\n... y ${result.errors.length - 5} errores más.`;
        }
      } else {
        errorMessage += `\nError general: ${result?.error || 'Error desconocido'}`;
      }

      // Agregar sugerencias comunes
      errorMessage += '\n\n💡 Posibles soluciones:\n';
      errorMessage += '1. Verifica que Gmail esté conectado\n';
      errorMessage += '2. Revisa que los emails sean válidos\n';
      errorMessage += '3. Verifica tu conexión a internet\n';
      errorMessage += '4. Revisa la consola para más detalles';

      console.error('Detalles completos del error:', result);
      console.error('Errores individuales:');
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((err, i) => {
          console.error(`  ${i + 1}. Email: ${err.email}, Error: ${err.error}`);
        });
      }


      if (emailStatusText) setInlineStatus(emailStatusText, STATUS_ICONS.error, `Error: ${result.failed} fallidos`);
      showToast('Error al enviar correos. Revisa los detalles.', 'error', 'Error de envío');
      alert(errorMessage);
    }
  } catch (e) {
    console.error('sendBulkEmail error', e);
    if (emailStatusText) setInlineStatus(emailStatusText, STATUS_ICONS.error, `Error: ${e.message}`);

    let errorMsg = `Error inesperado al enviar correos:\n\n${e.message}\n\n`;

    // Detectar errores comunes
    if (e.message.includes('NO_TOKEN')) {
      errorMsg += '💡 Solución: Necesitas conectar Gmail primero.\nVe a la sección de configuración y conecta tu cuenta.';
    } else if (e.message.includes('credentials.json')) {
      errorMsg += '💡 Solución: Falta el archivo credentials.json.\nSigue la guía de configuración de Gmail.';
    } else if (e.message.includes('network') || e.message.includes('ENOTFOUND')) {
      errorMsg += '💡 Solución: Verifica tu conexión a internet.';
    } else {
      errorMsg += '💡 Revisa la consola del navegador (F12) para más detalles.';
    }

    showToast(e.message, 'error', 'Error crítico');
    alert(errorMsg);
  } finally {
    State.activeSendTarget = null;
    updateComposerButtons();
  }
}

async function sendSurveyEmails() {
  if (!State.gmailConnected) {
    showToast('Conecta Gmail antes de enviar encuestas.', 'warning', 'Gmail requerido');
    return;
  }
  if (State.activeSendTarget) {
    alert('Hay un envío en curso. Espera a que termine.');
    return;
  }

  const surveyTitleInput = $('surveyTitleInput');
  const surveyLinkInput = $('surveyLinkInput');
  const sendSurveyEmailsBtn = $('sendSurveyEmailsBtn');
  const surveyStatus = $('surveyStatus');
  const surveyStatusText = $('surveyStatusText');
  const surveyProgress = $('surveyProgress');

  const title = (surveyTitleInput?.value || '').trim();
  const link = (surveyLinkInput?.value || '').trim();

  if (!title || !link) {
    alert('Completa el titulo y el link de la encuesta');
    return;
  }

  if (!/^https?:\/\//i.test(link)) {
    const continueSend = confirm('El link no parece valido. Enviar de todos modos?');
    if (!continueSend) return;
  }

  const recipientsSource = State.recipientTargets.survey.currentPatients;
  if (recipientsSource.length === 0) {
    alert('Selecciona un grupo de pacientes');
    return;
  }

  const confirmSend = confirm(`Enviar encuesta a ${recipientsSource.length} pacientes?`);
  if (!confirmSend) return;

  try {
    State.activeSendTarget = 'survey';
    if (surveyStatus) surveyStatus.classList.remove('hidden');
    if (surveyStatusText) surveyStatusText.textContent = 'Iniciando envio...';
    if (surveyProgress) surveyProgress.style.width = '0%';
    if (sendSurveyEmailsBtn) sendSurveyEmailsBtn.disabled = true;

    const recipients = recipientsSource.map(p => ({
      email: p.email,
      nombre: p.nombre,
      apellido: p.apellido,
      telefono: p.telefono,
      fecha_cita: p.fecha_cita,
      doctor: p.doctor
    }));

    const subject = title;
    const body = `Hola {nombre},\n\n${title}\n${link}\n\nGracias por tu tiempo.`;

    const result = await window.electronAPI.invoke('send-bulk-email', {
      recipients,
      subject,
      body,
      attachments: []
    });

    if (result?.success) {
      if (surveyStatusText) setInlineStatus(surveyStatusText, STATUS_ICONS.success, `Enviado: ${result.sent}/${recipientsSource.length}`);
      if (surveyProgress) surveyProgress.style.width = '100%';
      try {
        await window.api.crm.logSurveyDispatch({
          titulo: title,
          link: link,
          destinatarios: recipientsSource.length
        });
        await loadSurveyHistory();
      } catch (e) {
        console.warn('survey log error', e);
      }
      if (surveyTitleInput) surveyTitleInput.value = '';
      if (surveyLinkInput) surveyLinkInput.value = '';
      alert(`Envio completado. Enviados: ${result.sent}. Errores: ${result.failed}`);
    } else {
      if (surveyStatusText) setInlineStatus(surveyStatusText, STATUS_ICONS.error, `Error: ${result?.error || 'Envio fallido'}`);
      alert(`Error al enviar: ${result?.error || 'Envio fallido'}`);
    }
  } catch (e) {
    console.error('sendSurveyEmails error', e);
    if (surveyStatusText) setInlineStatus(surveyStatusText, STATUS_ICONS.error, `Error: ${e.message}`);
    alert(`Error: ${e.message}`);
  } finally {
    State.activeSendTarget = null;
    updateSurveyButtons();
  }
}

async function sendReminderEmails() {
  if (!State.gmailConnected) {
    alert('Conecta Gmail para enviar recordatorios');
    return;
  }

  if (State.activeSendTarget) {
    alert('Hay un envío en curso. Espera a que termine.');
    return;
  }

  const templateId = $('reminderTemplateSelect')?.value || '';
  const template = State.reminderTemplates.find(t => String(t.id) === String(templateId));
  if (!template) {
    alert('Selecciona una plantilla de recordatorio');
    return;
  }

  const minutes = getReminderMinutes();
  const sql = `
    SELECT c.id as cita_id, c.fecha_hora, p.id as paciente_id, p.nombre, p.apellido, p.email, p.telefono,
      u.nombre as doctor_nombre, u.apellido as doctor_apellido
    FROM citas c
    JOIN pacientes p ON p.id = c.paciente_id
    LEFT JOIN usuarios u ON u.id = c.dentista_id
    WHERE p.email IS NOT NULL AND p.email != ''
      AND (c.estado IS NULL OR c.estado != 'cancelada')
      AND c.fecha_hora >= datetime('now','localtime')
      AND c.fecha_hora <= datetime('now','localtime', ?)
    ORDER BY c.fecha_hora ASC
  `;

  let rows = [];
  try {
    rows = await dbAll(sql, [`+${minutes} minutes`]);
  } catch (e) {
    console.error('load reminders error', e);
    alert('Error cargando recordatorios');
    return;
  }
  if (!rows.length) {
    alert('No hay citas para recordar en este rango.');
    return;
  }

  const recipients = rows.map(row => {
    const nombre = [row.nombre, row.apellido].filter(Boolean).join(' ').trim();
    const doctor = [row.doctor_nombre, row.doctor_apellido].filter(Boolean).join(' ').trim();
    return {
      email: row.email,
      nombre: nombre || row.nombre,
      apellido: row.apellido || '',
      telefono: row.telefono || '',
      fecha_cita: formatDateTime(row.fecha_hora),
      doctor,
      paciente_id: row.paciente_id,
      cita_id: row.cita_id
    };
  });

  const confirmSend = confirm(`Enviar recordatorios a ${recipients.length} pacientes?`);
  if (!confirmSend) return;

  const reminderStatus = $('reminderStatus');
  const reminderStatusText = $('reminderStatusText');
  const reminderProgress = $('reminderProgress');

  try {
    State.activeSendTarget = 'reminder';
    if (reminderStatus) reminderStatus.classList.remove('hidden');
    if (reminderStatusText) reminderStatusText.textContent = 'Iniciando envio...';
    if (reminderProgress) reminderProgress.style.width = '0%';

    const result = await window.electronAPI.invoke('send-bulk-email', {
      recipients,
      subject: template.asunto || 'Recordatorio de cita',
      body: template.contenido || ''
    });

    if (result?.success) {
      if (reminderStatusText) setInlineStatus(reminderStatusText, STATUS_ICONS.success, `Enviado: ${result.sent}/${recipients.length}`);
      if (reminderProgress) reminderProgress.style.width = '100%';
    } else {
      if (reminderStatusText) setInlineStatus(reminderStatusText, STATUS_ICONS.error, `Error: ${result?.error || 'Envio fallido'}`);
    }

    const errorMap = new Map();
    (result?.errors || []).forEach(err => {
      errorMap.set(err.email, err.error || 'error');
    });

    const entries = recipients.map(r => {
      const failed = errorMap.has(r.email);
      return {
        paciente_id: r.paciente_id,
        cita_id: r.cita_id,
        template_id: template.id,
        canal: 'email',
        estado: failed ? 'failed' : 'sent',
        error: failed ? errorMap.get(r.email) : null
      };
    });

    try {
      await window.api.crm.recordReminderDeliveries({ entries });
    } catch (e) {
      console.warn('recordReminderDeliveries error', e);
    }
  } catch (e) {
    console.error('sendReminderEmails error', e);
    if (reminderStatusText) setInlineStatus(reminderStatusText, STATUS_ICONS.error, `Error: ${e.message}`);
  } finally {
    State.activeSendTarget = null;
  }
}

function setupRecipientsModal() {
  const modal = $('recipientsModal');
  const openBtns = document.querySelectorAll('[data-recipient-target]');
  const cancelBtn = $('cancelRecipientsBtn');
  const applyBtn = $('applyRecipientsBtn');
  const selectAllBtn = $('selectAllRecipients');
  const list = $('recipientsList');
  const search = $('recipientSearch');
  const modalRecipientCount = $('modalRecipientCount');

  function updateModalCount() {
    if (modalRecipientCount) {
      const label = State.activeRecipientTarget === 'survey' ? 'Encuestas' : 'Correos';
      modalRecipientCount.textContent = `${State.modalRecipientIds.size} seleccionados · ${label}`;
    }
  }

  function renderList(filter = '') {
    if (!list) return;
    const term = filter.toLowerCase();
    const patients = State.allPatients.filter(p => {
      const text = `${p.nombre} ${p.apellido} ${p.email}`.toLowerCase();
      return !term || text.includes(term);
    });

    list.innerHTML = patients.map(p => {
      const checked = State.modalRecipientIds.has(p.id) ? 'checked' : '';
      return `
        <label class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#F8F7F7] dark:hover:bg-gray-700">
          <input type="checkbox" class="recipient-checkbox" data-id="${p.id}" ${checked} />
          <div class="flex flex-col">
            <span class="text-sm text-[#0F2532] dark:text-white">${escapeHtml(p.nombre || p.email)}</span>
            <span class="text-xs text-[#0F2532]/50 dark:text-gray-400">${escapeHtml(p.email || '')}</span>
          </div>
        </label>
      `;
    }).join('');

    updateModalCount();
  }

  async function openModal(target) {
    if (!State.allPatients.length) await loadAllPatients();
    State.activeRecipientTarget = target || 'email';
    const recipientState = getRecipientState(State.activeRecipientTarget);
    State.modalRecipientIds = new Set(recipientState.selectedIds);
    renderList(search?.value || '');
    showModal(modal, true);
  }

  if (openBtns.length) {
    openBtns.forEach(btn => {
      btn.addEventListener('click', () => openModal(btn.dataset.recipientTarget));
    });
  }
  if (cancelBtn) cancelBtn.addEventListener('click', () => showModal(modal, false));
  if (applyBtn) applyBtn.addEventListener('click', async () => {
    const target = State.activeRecipientTarget || 'email';
    const recipientState = getRecipientState(target);
    recipientState.selectedIds = new Set(State.modalRecipientIds);
    const { selectEl } = getRecipientElements(target);
    if (selectEl) selectEl.value = 'custom';
    await loadPatients('custom', target);
    showModal(modal, false);
  });

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const allSelected = State.modalRecipientIds.size === State.allPatients.length;
      State.modalRecipientIds = new Set(allSelected ? [] : State.allPatients.map(p => p.id));
      renderList(search?.value || '');
    });
  }

  if (list) {
    list.addEventListener('change', (e) => {
      const target = e.target;
      if (!target.classList.contains('recipient-checkbox')) return;
      const id = Number(target.dataset.id);
      if (target.checked) State.modalRecipientIds.add(id);
      else State.modalRecipientIds.delete(id);
      updateModalCount();
    });
  }

  if (search) {
    search.addEventListener('input', (e) => renderList(e.target.value || ''));
  }
}

function setupTemplateActions() {
  const grid = $('templateGrid');
  const newTemplateBtn = $('newTemplateBtn');
  const saveTemplateBtn = $('saveTemplateBtn');
  const cancelTemplateBtn = $('cancelTemplateBtn');
  const templateSearchInput = $('templateSearchInput');
  const templateViewBtns = document.querySelectorAll('[data-template-view]');
  const templateImageInput = $('templateImageInput');
  const templateImageDropzone = $('templateImageDropzone');
  const templateImagePreview = $('templateImagePreview');
  const reminderList = $('reminderTemplatesList');
  const newReminderTemplateBtn = $('newReminderTemplateBtn');
  const reminderSelect = $('reminderTemplateSelect');

  if (newTemplateBtn) newTemplateBtn.addEventListener('click', () => openTemplateModal('email', null));
  if (newReminderTemplateBtn) newReminderTemplateBtn.addEventListener('click', () => openTemplateModal('reminder', null));
  if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', saveTemplate);
  if (cancelTemplateBtn) cancelTemplateBtn.addEventListener('click', () => showModal($('templateEditorModal'), false));

  if (templateSearchInput) {
    templateSearchInput.addEventListener('input', (e) => {
      State.templateSearch = e.target.value || '';
      renderTemplates();
    });
  }

  if (templateViewBtns.length) {
    templateViewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        State.templateView = btn.dataset.templateView === 'archived' ? 'archived' : 'active';
        renderTemplates();
      });
    });
  }

  if (templateImageInput) {
    templateImageInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        State.editingTemplateImage = reader.result;
        if (templateImagePreview) {
          templateImagePreview.src = reader.result;
          templateImagePreview.classList.remove('hidden');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (templateImageDropzone && templateImageInput) {
    templateImageDropzone.addEventListener('click', (e) => {
      if (e.target === templateImageInput) return;
      templateImageInput.click();
    });
  }

  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.template-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const template = State.templates.find(t => String(t.id) === String(id));
      if (!template) return;

      if (action === 'use') {
        applyTemplateToComposer(template);
      }

      if (action === 'edit') openTemplateModal('email', template);
      if (action === 'archive') archiveTemplate(template.id);
      if (action === 'restore') restoreTemplate(template.id);
      if (action === 'duplicate') duplicateTemplate(template.id);
    });
  }

  if (reminderList) {
    reminderList.addEventListener('click', (e) => {
      const btn = e.target.closest('.reminder-template-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const template = State.reminderTemplates.find(t => String(t.id) === String(id));
      if (!template) return;

      if (action === 'select' || action === 'use') {
        applyTemplateToComposer(template);
        if (reminderSelect) reminderSelect.value = String(template.id);
        updateReminderPreview(template.id);
      }
      if (action === 'edit') openTemplateModal('reminder', template);
      if (action === 'default') setDefaultReminderTemplate(template.id);
      if (action === 'delete') deleteTemplate(template.id);
    });
  }

  if (reminderSelect) {
    reminderSelect.addEventListener('change', (e) => updateReminderPreview(e.target.value));
  }
}

function setupCampaignActions() {
  const newCampaignBtn = $('newCampaignBtn');
  const saveCampaignBtn = $('saveCampaignBtn');
  const cancelCampaignBtn = $('cancelCampaignBtn');
  const campaignBody = $('campaignsTableBody');
  const statusFilter = $('campaignStatusFilter');
  const searchInput = $('campaignSearchInput');
  const typeSelect = $('campaignTypeSelect');

  if (newCampaignBtn) newCampaignBtn.addEventListener('click', () => openCampaignModal(null));
  if (saveCampaignBtn) saveCampaignBtn.addEventListener('click', saveCampaign);
  if (cancelCampaignBtn) cancelCampaignBtn.addEventListener('click', () => showModal($('campaignEditorModal'), false));

  if (campaignBody) {
    campaignBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.campaign-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const campaign = State.campaigns.find(c => String(c.id) === String(id));
      if (!campaign) return;
      if (action === 'edit') openCampaignModal(campaign);
      if (action === 'delete') deleteCampaign(campaign.id);
    });
  }

  if (statusFilter) statusFilter.addEventListener('change', renderCampaigns);
  if (searchInput) searchInput.addEventListener('input', renderCampaigns);
  if (typeSelect) typeSelect.addEventListener('change', toggleCampaignTemplateState);
}

function setupEmailRecipients() {
  const emailRecipients = $('emailRecipients');
  if (!emailRecipients) return;

  emailRecipients.addEventListener('change', async (e) => {
    const group = e.target.value;
    updateRecipientIcon(group);

    if (!group) {
      State.recipientTargets.email.currentPatients = [];
      updateRecipientSummary('email');
      return;
    }
    await loadPatients(group, 'email');
  });
}

function updateRecipientIcon(group) {
  const icon = $('recipientIcon');
  if (!icon) return;

  const iconPaths = {
    all: 'M17 20h5v-2a3 3 0 00-3-3h-2M9 20H4v-2a3 3 0 013-3h2m4-8a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z',
    active: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    inactive: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
    upcoming: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    custom: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    '': 'M17 20h5v-2a3 3 0 00-3-3h-2M9 20H4v-2a3 3 0 013-3h2m4-8a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z'
  };

  const path = iconPaths[group] || iconPaths[''];
  icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" />`;
}

function setupSurveyRecipients() {
  const surveyRecipients = $('surveyRecipients');
  if (!surveyRecipients) return;

  surveyRecipients.addEventListener('change', async (e) => {
    const group = e.target.value;
    if (!group) {
      State.recipientTargets.survey.currentPatients = [];
      updateRecipientSummary('survey');
      return;
    }
    await loadPatients(group, 'survey');
  });
}

function setupGmailAuth() {
  const connectGmailBtn = $('connectGmailBtn');
  if (connectGmailBtn) {
    connectGmailBtn.addEventListener('click', connectGmail);

    const helperText = connectGmailBtn.parentElement?.nextElementSibling;
    if (helperText) {
      helperText.textContent = 'Se abrira Google en tu navegador. Selecciona la cuenta fija que enviara todas las notificaciones del CRM.';
    }
  }
}

function setupReminderActions() {
  const sendReminderEmailsBtn = $('sendReminderEmailsBtn');
  if (sendReminderEmailsBtn) sendReminderEmailsBtn.addEventListener('click', sendReminderEmails);
}

function setupBulkEmailActions() {
  const sendBulkEmailBtn = $('sendBulkEmailBtn');
  if (sendBulkEmailBtn) sendBulkEmailBtn.addEventListener('click', sendBulkEmail);
}

function setupSurveyActions() {
  const sendSurveyEmailsBtn = $('sendSurveyEmailsBtn');
  if (sendSurveyEmailsBtn) sendSurveyEmailsBtn.addEventListener('click', sendSurveyEmails);
}

// Survey Templates Functions
async function loadSurveyTemplates() {
  try {
    const rows = await dbAll(`SELECT * FROM crm_encuestas_plantillas WHERE activo = 1 ORDER BY fecha_creacion DESC`);
    State.surveyTemplates = rows || [];
    renderSurveyTemplates();
  } catch (e) {
    console.error('loadSurveyTemplates error', e);
    State.surveyTemplates = [];
  }
}

function renderSurveyTemplates() {
  const grid = $('surveyTemplateGrid');
  if (!grid) return;

  if (State.surveyTemplates.length === 0) {
    grid.innerHTML = `
      <div class="col-span-2 text-center py-12 text-[#0F2532]/50 dark:text-gray-400">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="font-medium">No hay plantillas de encuestas</p>
        <p class="text-sm mt-1">Crea tu primera plantilla para comenzar</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = State.surveyTemplates.map(t => `
    <div class="bg-[#F8F7F7] dark:bg-gray-700/50 rounded-lg p-4 border border-[#E6E6E6] dark:border-gray-600 hover:border-[#4EABBE] dark:hover:border-[#4EABBE] transition group">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-[#0F2532] dark:text-white truncate">${escapeHtml(t.nombre)}</h3>
          <p class="text-xs text-[#0F2532]/60 dark:text-gray-400 mt-1 truncate">${escapeHtml(t.titulo)}</p>
        </div>
      </div>
      ${t.descripcion ? `<p class="text-xs text-[#0F2532]/50 dark:text-gray-400 mb-3 line-clamp-2">${escapeHtml(t.descripcion)}</p>` : ''}
      <div class="flex gap-2">
        <button class="survey-template-action flex-1 px-3 py-1.5 bg-[#4EABBE] text-white rounded text-xs font-medium hover:bg-[#1D5D69] transition" data-action="use" data-id="${t.id}">
          Usar
        </button>
        <button class="survey-template-action px-3 py-1.5 bg-white dark:bg-gray-600 text-[#0F2532] dark:text-white rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-500 transition" data-action="edit" data-id="${t.id}" title="Editar">
          ✏️
        </button>
        <button class="survey-template-action px-3 py-1.5 bg-white dark:bg-gray-600 text-[#0F2532] dark:text-white rounded text-xs hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition" data-action="delete" data-id="${t.id}" title="Eliminar">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

function openSurveyTemplateModal(template) {
  const modal = $('surveyTemplateEditorModal');
  const modalTitle = $('surveyTemplateModalTitle');
  const modalSubtitle = $('surveyTemplateModalSubtitle');
  const nameInput = $('surveyTemplateNameInput');
  const titleInput = $('surveyTemplateTitleInput');
  const linkInput = $('surveyTemplateLinkInput');
  const descInput = $('surveyTemplateDescInput');

  if (template) {
    State.editingSurveyTemplateId = template.id;
    if (modalTitle) modalTitle.textContent = 'Editar plantilla de encuesta';
    if (modalSubtitle) modalSubtitle.textContent = 'Modifica los datos de tu plantilla';
    if (nameInput) nameInput.value = template.nombre || '';
    if (titleInput) titleInput.value = template.titulo || '';
    if (linkInput) linkInput.value = template.link || '';
    if (descInput) descInput.value = template.descripcion || '';
  } else {
    State.editingSurveyTemplateId = null;
    if (modalTitle) modalTitle.textContent = 'Nueva plantilla de encuesta';
    if (modalSubtitle) modalSubtitle.textContent = 'Crea una plantilla reutilizable para tus encuestas';
    if (nameInput) nameInput.value = '';
    if (titleInput) titleInput.value = '';
    if (linkInput) linkInput.value = '';
    if (descInput) descInput.value = '';
  }

  showModal(modal, true);
}

async function saveSurveyTemplate() {
  const nameInput = $('surveyTemplateNameInput');
  const titleInput = $('surveyTemplateTitleInput');
  const linkInput = $('surveyTemplateLinkInput');
  const descInput = $('surveyTemplateDescInput');

  const nombre = (nameInput?.value || '').trim();
  const titulo = (titleInput?.value || '').trim();
  const link = (linkInput?.value || '').trim();
  const descripcion = (descInput?.value || '').trim();

  if (!nombre || !titulo || !link) {
    alert('Completa al menos el nombre, título y link de la plantilla');
    return;
  }

  try {
    const payload = {
      id: State.editingSurveyTemplateId,
      nombre,
      titulo,
      link,
      descripcion
    };

    await window.api.crm.saveSurveyTemplate(payload);

    if (State.editingSurveyTemplateId) {
      showToast('Plantilla actualizada correctamente', 'success', '✓ Actualizado');
    } else {
      showToast('Plantilla creada correctamente', 'success', '✓ Creado');
    }

    await loadSurveyTemplates();
    showModal($('surveyTemplateEditorModal'), false);
    State.editingSurveyTemplateId = null;
  } catch (e) {
    console.error('saveSurveyTemplate error', e);
    alert(`Error al guardar plantilla: ${e.message}`);
  }
}

async function deleteSurveyTemplate(id) {
  const template = State.surveyTemplates.find(t => String(t.id) === String(id));
  if (!template) return;

  const confirmDelete = confirm(`¿Eliminar la plantilla "${template.nombre}"?`);
  if (!confirmDelete) return;

  try {
    await window.api.crm.archiveSurveyTemplate(id);
    showToast('Plantilla eliminada', 'success', '✓ Eliminado');
    await loadSurveyTemplates();
  } catch (e) {
    console.error('deleteSurveyTemplate error', e);
    alert(`Error al eliminar: ${e.message}`);
  }
}

function applySurveyTemplateToForm(template) {
  const titleInput = $('surveyTitleInput');
  const linkInput = $('surveyLinkInput');

  if (titleInput) titleInput.value = template.titulo || '';
  if (linkInput) linkInput.value = template.link || '';

  updateSurveyButtons();
  showToast(`Plantilla "${template.nombre}" aplicada`, 'success', '✓ Aplicado');
}

function setupSurveyTemplateActions() {
  const grid = $('surveyTemplateGrid');
  const newBtn = $('newSurveyTemplateBtn');
  const saveBtn = $('saveSurveyTemplateBtn');
  const cancelBtn = $('cancelSurveyTemplateBtn');

  if (newBtn) {
    newBtn.addEventListener('click', () => openSurveyTemplateModal(null));
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', saveSurveyTemplate);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      showModal($('surveyTemplateEditorModal'), false);
      State.editingSurveyTemplateId = null;
    });
  }

  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.survey-template-action');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const template = State.surveyTemplates.find(t => String(t.id) === String(id));
      if (!template) return;

      if (action === 'use') applySurveyTemplateToForm(template);
      if (action === 'edit') openSurveyTemplateModal(template);
      if (action === 'delete') deleteSurveyTemplate(template.id);
    });
  }
}


function setupProgressListener() {
  if (!window.electronAPI) return;
  window.electronAPI.on('email-progress', (data) => {
    const percentage = (data.current / data.total) * 100;
    if (State.activeSendTarget === 'email') {
      const emailProgress = $('emailProgress');
      const emailStatusText = $('emailStatusText');
      if (emailProgress) emailProgress.style.width = `${percentage}%`;
      if (emailStatusText) emailStatusText.textContent = `Enviando: ${data.current}/${data.total}...`;
    }
    if (State.activeSendTarget === 'reminder') {
      const reminderProgress = $('reminderProgress');
      const reminderStatusText = $('reminderStatusText');
      if (reminderProgress) reminderProgress.style.width = `${percentage}%`;
      if (reminderStatusText) reminderStatusText.textContent = `Enviando: ${data.current}/${data.total}...`;
    }
    if (State.activeSendTarget === 'survey') {
      const surveyProgress = $('surveyProgress');
      const surveyStatusText = $('surveyStatusText');
      if (surveyProgress) surveyProgress.style.width = `${percentage}%`;
      if (surveyStatusText) surveyStatusText.textContent = `Enviando: ${data.current}/${data.total}...`;
    }
  });
}

async function init() {
  initTabs();
  initSmsCounter();
  setupGmailAuth();
  setupEmailComposer();
  setupVariableTokens();
  setupEmailRecipients();
  setupEmailSendOptions();
  setupSurveyComposer();
  setupSurveyRecipients();
  setupRecipientsModal();
  setupTemplateActions();
  setupReminderActions();
  setupBulkEmailActions();
  setupSurveyActions();
  setupSurveyTemplateActions();
  setupProgressListener();

  await checkGmailStatus();
  await loadTemplates();
  await loadSurveyTemplates();
  await loadSurveyHistory();
  updateEmailEstimate();
  updateComposerButtons();
  updateSurveyButtons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { };
