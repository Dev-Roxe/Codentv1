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
  reminderTemplates: [],
  campaigns: [],
  currentPatients: [],
  allPatients: [],
  selectedRecipientIds: new Set(),
  modalRecipientIds: new Set(),
  editingTemplateId: null,
  editingTemplateImage: null,
  templateType: 'email',
  editingCampaignId: null,
  gmailConnected: false,
  activeSendTarget: null,
};

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

function getReminderMinutes() {
  try {
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    const minutes = Number(settings.reminderTime || 15);
    return Number.isFinite(minutes) ? minutes : 15;
  } catch (e) {
    return 15;
  }
}

function updateReminderWindowInfo() {
  const info = $('reminderWindowInfo');
  if (!info) return;
  const minutes = getReminderMinutes();
  info.textContent = `Se enviaran recordatorios ${minutes} minutos antes de la cita.`;
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

async function loadPatients(group) {
  if (group === 'custom') {
    if (!State.allPatients.length) await loadAllPatients();
    State.currentPatients = State.allPatients.filter(p => State.selectedRecipientIds.has(p.id));
    updateRecipientSummary();
    return;
  }

  State.currentPatients = await fetchPatients(group, 500);
  updateRecipientSummary();
}

function updateRecipientSummary() {
  const recipientCount = $('recipientCount');
  const sendBulkEmailBtn = $('sendBulkEmailBtn');
  const selectedContainer = $('selectedPatientsContainer');
  const emailRecipients = $('emailRecipients');
  const count = State.currentPatients.length;

  if (recipientCount) {
    if (count > 0) {
      recipientCount.textContent = ` ${count} pacientes seleccionados`;
    } else {
      recipientCount.textContent = ' Selecciona un grupo';
    }
  }

  if (selectedContainer) {
    selectedContainer.innerHTML = '';
    if (emailRecipients?.value === 'custom' && count > 0) {
      const fragment = document.createDocumentFragment();
      State.currentPatients.slice(0, 8).forEach(p => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center px-2 py-1 bg-[#8BCFDD]/20 text-[#1D5D69] rounded-full text-xs mr-2 mt-2';
        chip.textContent = p.nombre || p.email;
        fragment.appendChild(chip);
      });
      selectedContainer.appendChild(fragment);
    }
  }

  if (sendBulkEmailBtn) {
    updateComposerButtons();
  }

  renderEmailPreview();
}

function updateComposerButtons() {
  const sendBulkEmailBtn = $('sendBulkEmailBtn');
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');

  if (!sendBulkEmailBtn) return;

  const hasRecipients = State.currentPatients.length > 0;
  const hasSubject = (emailSubject?.value || '').trim().length > 0;
  const hasBody = (emailMessage?.value || '').trim().length > 0;
  const canSend = State.gmailConnected && hasRecipients && hasSubject && hasBody;

  sendBulkEmailBtn.disabled = !canSend;
  sendBulkEmailBtn.classList.toggle('opacity-60', !canSend);
  sendBulkEmailBtn.classList.toggle('cursor-not-allowed', !canSend);
}

function renderEmailPreview() {
  const previewSubject = $('previewSubject');
  const previewBody = $('previewBody');
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  const charCount = $('charCount');

  if (!previewSubject || !previewBody || !emailSubject || !emailMessage) return;

  const sample = State.currentPatients[0] || {};
  const subject = replaceTemplateVars(emailSubject.value, sample).trim();
  const body = replaceTemplateVars(emailMessage.value, sample).trim();

  previewSubject.textContent = subject || 'Sin asunto';
  const safeBody = escapeHtml(body || 'El contenido aparecera aqui...').replace(/\n/g, '<br>');
  previewBody.innerHTML = safeBody;

  if (charCount) {
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

  const sample = State.currentPatients[0] || {};
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

async function loadTemplates() {
  try {
    State.templates = await dbAll(`SELECT * FROM crm_templates WHERE tipo = 'email' ORDER BY fecha_creacion DESC`);
    State.reminderTemplates = await dbAll(`SELECT * FROM crm_templates WHERE tipo = 'reminder' ORDER BY fecha_creacion DESC`);
  } catch (e) {
    console.error('loadTemplates error', e);
    State.templates = [];
    State.reminderTemplates = [];
  }
  renderTemplates();
  renderReminderTemplates();
  populateTemplateSelects();
}

function renderTemplates() {
  const grid = $('templateGrid');
  if (!grid) return;

  if (State.templates.length === 0) {
    grid.innerHTML = '<div class="col-span-2 text-center text-sm text-[#0F2532]/50 dark:text-gray-400">No hay plantillas creadas.</div>';
    return;
  }

  grid.innerHTML = State.templates.map(t => {
    const snippet = escapeHtml((t.contenido || '').slice(0, 120));
    const image = t.imagen ? `<img src="${t.imagen}" alt="${escapeHtml(t.nombre)}" class="w-full h-24 object-cover rounded-lg" />` :
      '<div class="w-full h-24 rounded-lg bg-[#F8F7F7] dark:bg-gray-700 flex items-center justify-center text-xs text-[#0F2532]/40">Sin imagen</div>';

    return `
      <div class="border border-[#E6E6E6] dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800 shadow-sm">
        ${image}
        <h3 class="mt-3 font-semibold text-[#0F2532] dark:text-white">${escapeHtml(t.nombre)}</h3>
        <p class="text-xs text-[#0F2532]/60 dark:text-gray-400 mt-1 min-h-[36px]">${snippet || 'Sin contenido'}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button class="template-action px-3 py-1 bg-[#4EABBE] text-white rounded-lg text-xs" data-action="use" data-id="${t.id}">Usar</button>
          <button class="template-action px-3 py-1 bg-[#F8F7F7] dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg text-xs border border-[#E6E6E6] dark:border-gray-600" data-action="edit" data-id="${t.id}">Editar</button>
          <button class="template-action px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs border border-red-200" data-action="delete" data-id="${t.id}">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderReminderTemplates() {
  const list = $('reminderTemplatesList');
  if (!list) return;

  if (State.reminderTemplates.length === 0) {
    list.innerHTML = '<div class="text-sm text-[#0F2532]/50 dark:text-gray-400">No hay plantillas de recordatorio.</div>';
    return;
  }

  list.innerHTML = State.reminderTemplates.map(t => {
    const snippet = escapeHtml((t.contenido || '').slice(0, 120));
    const badge = t.es_predeterminada ? '<span class="ml-2 text-xs text-emerald-600">Predeterminada</span>' : '';
    return `
      <div class="border border-[#E6E6E6] dark:border-gray-700 rounded-lg p-3 flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-[#0F2532] dark:text-white">${escapeHtml(t.nombre)}${badge}</p>
          <p class="text-xs text-[#0F2532]/50 dark:text-gray-400">${escapeHtml(t.asunto || 'Sin asunto')}</p>
          <p class="text-xs text-[#0F2532]/60 dark:text-gray-400 mt-1">${snippet || 'Sin contenido'}</p>
        </div>
        <div class="flex flex-col gap-2">
          <button class="reminder-template-action px-3 py-1 bg-[#4EABBE] text-white rounded-lg text-xs" data-action="select" data-id="${t.id}">Seleccionar</button>
          <button class="reminder-template-action px-3 py-1 bg-[#F8F7F7] dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg text-xs border border-[#E6E6E6] dark:border-gray-600" data-action="edit" data-id="${t.id}">Editar</button>
          <button class="reminder-template-action px-3 py-1 bg-[#F8F7F7] dark:bg-gray-700 text-[#0F2532] dark:text-white rounded-lg text-xs border border-[#E6E6E6] dark:border-gray-600" data-action="default" data-id="${t.id}">Predet.</button>
          <button class="reminder-template-action px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs border border-red-200" data-action="delete" data-id="${t.id}">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

function populateTemplateSelects() {
  const campaignTemplateSelect = $('campaignTemplateSelect');
  const reminderTemplateSelect = $('reminderTemplateSelect');

  if (campaignTemplateSelect) {
    const options = ['<option value="">-- Sin plantilla --</option>'];
    State.templates.forEach(t => {
      options.push(`<option value="${t.id}">${escapeHtml(t.nombre)}</option>`);
    });
    campaignTemplateSelect.innerHTML = options.join('');
  }

  if (reminderTemplateSelect) {
    const options = ['<option value="">-- Selecciona una plantilla --</option>'];
    State.reminderTemplates.forEach(t => {
      options.push(`<option value="${t.id}">${escapeHtml(t.nombre)}</option>`);
    });
    reminderTemplateSelect.innerHTML = options.join('');

    const defaultTemplate = State.reminderTemplates.find(t => t.es_predeterminada);
    if (defaultTemplate) {
      reminderTemplateSelect.value = String(defaultTemplate.id);
      updateReminderPreview(defaultTemplate.id);
    } else if (State.reminderTemplates.length > 0) {
      reminderTemplateSelect.value = String(State.reminderTemplates[0].id);
      updateReminderPreview(State.reminderTemplates[0].id);
    }
  }
}

function updateReminderPreview(templateId) {
  const reminderPreview = $('reminderPreview');
  if (!reminderPreview) return;

  const template = State.reminderTemplates.find(t => String(t.id) === String(templateId));
  if (!template) {
    reminderPreview.textContent = 'Selecciona una plantilla para ver el contenido.';
    return;
  }

  reminderPreview.textContent = template.contenido || 'Sin contenido';
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
    alert('Completa el nombre y el contenido.');
    return;
  }

  try {
    if (State.editingTemplateId) {
      await dbRun(
        `UPDATE crm_templates SET nombre = ?, asunto = ?, contenido = ?, imagen = ?, tipo = ?, fecha_actualizacion = datetime('now') WHERE id = ?`,
        [nombre, asunto, contenido, State.editingTemplateImage, State.templateType, State.editingTemplateId]
      );
    } else {
      await dbRun(
        `INSERT INTO crm_templates (nombre, asunto, contenido, imagen, tipo, fecha_actualizacion) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [nombre, asunto, contenido, State.editingTemplateImage, State.templateType]
      );
    }

    showModal($('templateEditorModal'), false);
    await loadTemplates();
  } catch (e) {
    console.error('saveTemplate error', e);
    alert(`Error guardando plantilla: ${e.message || 'sin detalle'}`);
  }
}

async function deleteTemplate(id) {
  if (!confirm('Eliminar esta plantilla?')) return;
  try {
    await dbRun('DELETE FROM crm_templates WHERE id = ?', [id]);
    await loadTemplates();
  } catch (e) {
    console.error('deleteTemplate error', e);
    alert('Error eliminando plantilla');
  }
}

async function setDefaultReminderTemplate(id) {
  try {
    await dbRun(`UPDATE crm_templates SET es_predeterminada = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE tipo = 'reminder'`, [id]);
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
    alert('El nombre de la campaña es obligatorio.');
    return;
  }

  try {
    if (State.editingCampaignId) {
      await dbRun(
        `UPDATE crm_campaigns SET nombre = ?, descripcion = ?, tipo = ?, estado = ?, audiencia = ?, audiencia_ids = ?, template_id = ?, asunto = ?, contenido = ?, programada_para = ?, fecha_actualizacion = datetime('now') WHERE id = ?`,
        [
          nombre,
          descripcion,
          tipo,
          estado,
          audiencia,
          null,
          templateId || null,
          asunto || null,
          contenido || null,
          programadaPara,
          State.editingCampaignId
        ]
      );
    } else {
      await dbRun(
        `INSERT INTO crm_campaigns (nombre, descripcion, tipo, estado, audiencia, audiencia_ids, template_id, asunto, contenido, programada_para, fecha_actualizacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          nombre,
          descripcion,
          tipo,
          estado,
          audiencia,
          null,
          templateId || null,
          asunto || null,
          contenido || null,
          programadaPara
        ]
      );
    }

    showModal($('campaignEditorModal'), false);
    await loadCampaigns();
  } catch (e) {
    console.error('saveCampaign error', e);
    alert(`Error guardando campaña: ${e.message || 'sin detalle'}`);
  }
}

async function deleteCampaign(id) {
  if (!confirm('Eliminar esta campaña?')) return;
  try {
    await dbRun('DELETE FROM crm_campaigns WHERE id = ?', [id]);
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
    gmailStatus.textContent = State.gmailConnected ? 'Gmail conectado ✓' : 'Gmail no conectado';
  }
  if (connectGmailBtn) {
    connectGmailBtn.textContent = State.gmailConnected ? 'Conectado' : 'Conectar Gmail';
    connectGmailBtn.disabled = State.gmailConnected;
    connectGmailBtn.classList.toggle('opacity-60', State.gmailConnected);
  }

  // Los campos siempre están habilitados para permitir escritura
  updateComposerButtons();
}

async function connectGmail() {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.invoke('gmail-get-auth-url');
  if (!result?.success) {
    alert(result?.error || 'No se pudo generar el link de autorizacion');
    return;
  }
  await window.electronAPI.invoke('open-external', result.url);
  showModal($('gmailAuthModal'), true);
}

async function saveGmailToken() {
  if (!window.electronAPI) return;
  const input = $('gmailAuthCodeInput');
  const code = (input?.value || '').trim();
  if (!code) {
    alert('Ingresa el codigo de autorizacion');
    return;
  }
  const result = await window.electronAPI.invoke('gmail-save-token', code);
  if (!result?.success) {
    alert(result?.error || 'Error guardando token');
    return;
  }
  if (input) input.value = '';
  showModal($('gmailAuthModal'), false);
  await checkGmailStatus();
}

function setupEmailComposer() {
  const emailSubject = $('emailSubject');
  const emailMessage = $('emailMessage');
  const previewEmailBtn = $('previewEmailBtn');

  if (emailSubject) {
    emailSubject.addEventListener('input', renderEmailPreview);
  }

  if (emailMessage) {
    emailMessage.addEventListener('input', renderEmailPreview);
  }

  if (previewEmailBtn) {
    previewEmailBtn.addEventListener('click', () => {
      renderFullPreview();
    });
  }
}

async function sendBulkEmail() {
  if (!State.gmailConnected) {
    alert('Conecta Gmail para enviar emails');
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

  if (State.currentPatients.length === 0) {
    alert('Selecciona un grupo de pacientes');
    return;
  }

  const confirmSend = confirm(`Enviar email a ${State.currentPatients.length} pacientes?`);
  if (!confirmSend) return;

  try {
    State.activeSendTarget = 'email';
    if (emailStatus) emailStatus.classList.remove('hidden');
    if (emailStatusText) emailStatusText.textContent = 'Iniciando envio...';
    if (emailProgress) emailProgress.style.width = '0%';
    if (sendBulkEmailBtn) sendBulkEmailBtn.disabled = true;

    const recipients = State.currentPatients.map(p => ({
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
    });

    if (result?.success) {
      if (emailStatusText) setInlineStatus(emailStatusText, STATUS_ICONS.success, `Enviado: ${result.sent}/${State.currentPatients.length}`);
      if (emailProgress) emailProgress.style.width = '100%';
      alert(`Envio completado. Enviados: ${result.sent}. Errores: ${result.failed}`);
      if (emailSubject) emailSubject.value = '';
      if (emailMessage) emailMessage.value = '';
      renderEmailPreview();
    } else {
      if (emailStatusText) setInlineStatus(emailStatusText, STATUS_ICONS.error, `Error: ${result?.error || 'Envio fallido'}`);
      alert(`Error al enviar: ${result?.error || 'Envio fallido'}`);
    }
  } catch (e) {
    console.error('sendBulkEmail error', e);
    if (emailStatusText) setInlineStatus(emailStatusText, STATUS_ICONS.error, `Error: ${e.message}`);
    alert(`Error: ${e.message}`);
  } finally {
    State.activeSendTarget = null;
    updateComposerButtons();
  }
}

async function sendReminderEmails() {
  if (!State.gmailConnected) {
    alert('Conecta Gmail para enviar recordatorios');
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

    for (const r of recipients) {
      const failed = errorMap.has(r.email);
      await dbRun(
        `INSERT INTO crm_recordatorios (paciente_id, cita_id, template_id, canal, estado, enviado_en, error) VALUES (?, ?, ?, 'email', ?, datetime('now'), ?)`,
        [r.paciente_id, r.cita_id, template.id, failed ? 'failed' : 'sent', failed ? errorMap.get(r.email) : null]
      );
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
  const openBtn = $('selectRecipientsBtn');
  const cancelBtn = $('cancelRecipientsBtn');
  const applyBtn = $('applyRecipientsBtn');
  const selectAllBtn = $('selectAllRecipients');
  const list = $('recipientsList');
  const search = $('recipientSearch');
  const modalRecipientCount = $('modalRecipientCount');

  function updateModalCount() {
    if (modalRecipientCount) {
      modalRecipientCount.textContent = `${State.modalRecipientIds.size} seleccionados`;
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

  async function openModal() {
    if (!State.allPatients.length) await loadAllPatients();
    State.modalRecipientIds = new Set(State.selectedRecipientIds);
    renderList(search?.value || '');
    showModal(modal, true);
  }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (cancelBtn) cancelBtn.addEventListener('click', () => showModal(modal, false));
  if (applyBtn) applyBtn.addEventListener('click', async () => {
    State.selectedRecipientIds = new Set(State.modalRecipientIds);
    const emailRecipients = $('emailRecipients');
    if (emailRecipients) emailRecipients.value = 'custom';
    await loadPatients('custom');
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
    templateImageDropzone.addEventListener('click', () => {
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
        const emailSubject = $('emailSubject');
        const emailMessage = $('emailMessage');
        if (emailSubject && template.asunto) emailSubject.value = template.asunto;
        if (emailMessage) emailMessage.value = template.contenido || '';
        renderEmailPreview();
      }

      if (action === 'edit') openTemplateModal('email', template);
      if (action === 'delete') deleteTemplate(template.id);
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

      if (action === 'select') {
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
    if (!group) {
      State.currentPatients = [];
      updateRecipientSummary();
      return;
    }
    await loadPatients(group);
  });
}

function setupGmailAuth() {
  const connectGmailBtn = $('connectGmailBtn');
  const cancelGmailAuthBtn = $('cancelGmailAuthBtn');
  const saveGmailAuthBtn = $('saveGmailAuthBtn');

  if (connectGmailBtn) connectGmailBtn.addEventListener('click', connectGmail);
  if (cancelGmailAuthBtn) cancelGmailAuthBtn.addEventListener('click', () => showModal($('gmailAuthModal'), false));
  if (saveGmailAuthBtn) saveGmailAuthBtn.addEventListener('click', saveGmailToken);
}

function setupReminderActions() {
  const sendReminderEmailsBtn = $('sendReminderEmailsBtn');
  if (sendReminderEmailsBtn) sendReminderEmailsBtn.addEventListener('click', sendReminderEmails);
}

function setupBulkEmailActions() {
  const sendBulkEmailBtn = $('sendBulkEmailBtn');
  if (sendBulkEmailBtn) sendBulkEmailBtn.addEventListener('click', sendBulkEmail);
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
  });
}

async function init() {
  initTabs();
  initSmsCounter();
  updateReminderWindowInfo();
  setupEmailComposer();
  setupEmailRecipients();
  setupRecipientsModal();
  setupTemplateActions();
  setupCampaignActions();
  setupGmailAuth();
  setupReminderActions();
  setupBulkEmailActions();
  setupProgressListener();

  await checkGmailStatus();
  await loadTemplates();
  await loadCampaigns();

  const reminderSelect = $('reminderTemplateSelect');
  if (reminderSelect) updateReminderPreview(reminderSelect.value);

  window.addEventListener('configurationChanged', updateReminderWindowInfo);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { };
