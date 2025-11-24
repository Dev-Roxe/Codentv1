// crm.js - CRM Sonalía Mejorado

/* ============================================================================
   GLOBAL STATE
============================================================================ */
const CRMState = {
    gmailConnected: false,
    templates: [],
    selectedPatients: [],
    allPatients: [],
    isSending: false,
    currentEditingTemplate: null
};

/* ============================================================================
   UTILITY FUNCTIONS
============================================================================ */
function toggleEmailFormFields(enabled) {
    const fields = ["emailSubject", "emailMessage", "insertNameVar", "insertDateVar", "insertDoctorVar", "previewEmailBtn"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });
}

function showToast(message, type = "info") {
    const existing = document.querySelector('.crm-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `crm-toast fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-slide-up ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-[#1D5D69] text-white'
    }`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `<span class="text-lg">${icons[type]}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function replaceVariables(text, patient) {
    return text
        .replace(/{nombre}/g, patient.nombre || 'Paciente')
        .replace(/{fecha_cita}/g, patient.fecha_cita || 'Por confirmar')
        .replace(/{doctor}/g, patient.doctor || 'Dr. Sonalía')
        .replace(/{email}/g, patient.email || '')
        .replace(/{telefono}/g, patient.telefono || '');
}

/* ============================================================================
   INITIALIZATION
============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    setupTabs();
    checkGmailStatus();
    setupGmailConnection();
    loadTemplates();
    setupTemplateManager();
    setupRecipientSelector();
    setupEmailComposer();
    setupSurveyEmails();
    setupReminderEmails();
});

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .template-card:hover .template-actions { opacity: 1; }
        .template-actions { opacity: 0; transition: opacity 0.2s; }
        .patient-chip { transition: all 0.2s; }
        .patient-chip:hover { transform: scale(1.02); }
        .variable-btn:hover { transform: translateY(-1px); }
        .crm-toast { transition: all 0.3s ease; }
    `;
    document.head.appendChild(style);
}

/* ============================================================================
   TABS
============================================================================ */
function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;
            if (!target) return;

            tabBtns.forEach(b => {
                b.classList.remove("active", "border-b-4", "border-[#4EABBE]", "text-[#1D5D69]", "font-semibold");
                b.classList.add("text-[#0F2532]/60", "font-medium");
            });

            btn.classList.add("active", "border-b-4", "border-[#4EABBE]", "text-[#1D5D69]", "font-semibold");
            btn.classList.remove("text-[#0F2532]/60");

            tabContents.forEach(c => c.classList.add("hidden"));
            document.getElementById(`${target}-tab`)?.classList.remove("hidden");
        });
    });
}

/* ============================================================================
   GMAIL CONNECTION
============================================================================ */
function checkGmailStatus() {
    CRMState.gmailConnected = localStorage.getItem("gmailConnected") === "true";
    updateGmailUI();
    toggleEmailFormFields(CRMState.gmailConnected);
}

function updateGmailUI() {
    const btn = document.getElementById("connectGmailBtn");
    const status = document.getElementById("gmailStatus");
    
    if (!btn || !status) return;
    
    if (CRMState.gmailConnected) {
        status.innerHTML = '<span class="flex items-center gap-2"><span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>Gmail conectado</span>';
        status.className = "text-sm text-green-700 font-medium";
        btn.textContent = "Desconectar";
        btn.className = "px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm";
    } else {
        status.innerHTML = '<span class="flex items-center gap-2"><span class="w-2 h-2 bg-gray-400 rounded-full"></span>Gmail no conectado</span>';
        status.className = "text-sm text-[#0F2532]/60";
        btn.textContent = "Conectar Gmail";
        btn.className = "px-3 py-2 bg-[#4EABBE] text-white rounded-lg hover:bg-[#1D5D69] text-sm";
    }
}

function setupGmailConnection() {
    const btn = document.getElementById("connectGmailBtn");
    const modal = document.getElementById("gmailAuthModal");
    const codeInput = document.getElementById("gmailAuthCodeInput");
    const saveBtn = document.getElementById("saveGmailAuthBtn");
    const cancelBtn = document.getElementById("cancelGmailAuthBtn");

    if (!btn) return;

    btn.addEventListener("click", async () => {
        if (CRMState.gmailConnected) {
            if (confirm("¿Desconectar Gmail?")) {
                localStorage.removeItem("gmailConnected");
                CRMState.gmailConnected = false;
                updateGmailUI();
                toggleEmailFormFields(false);
                showToast("Gmail desconectado", "info");
            }
            return;
        }

        const res = await window.electronAPI?.invoke("gmail-get-auth-url");
        if (!res?.success) {
            showToast("Error generando URL OAuth", "error");
            return;
        }

        await window.electronAPI.invoke("open-external", res.url);
        modal?.classList.remove("hidden");
        modal?.classList.add("flex");
        codeInput?.focus();
    });

    saveBtn?.addEventListener("click", async () => {
        const code = codeInput?.value.trim();
        if (!code) {
            showToast("Pega el código de Google", "warning");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="animate-spin">⏳</span> Guardando...';

        const saved = await window.electronAPI?.invoke("gmail-save-token", code);

        if (saved?.success) {
            localStorage.setItem("gmailConnected", "true");
            CRMState.gmailConnected = true;
            updateGmailUI();
            toggleEmailFormFields(true);
            modal?.classList.add("hidden");
            codeInput.value = "";
            showToast("Gmail conectado correctamente", "success");
        } else {
            showToast("Error: " + (saved?.error || "Desconocido"), "error");
        }

        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar Token";
    });

    cancelBtn?.addEventListener("click", () => {
        modal?.classList.add("hidden");
        codeInput.value = "";
    });
}

/* ============================================================================
   TEMPLATE MANAGER - CRUD COMPLETO
============================================================================ */
function loadTemplates() {
    const defaultTemplates = [
        {
            id: 'tpl_1',
            name: 'Recordatorio de cita',
            description: 'Confirma tu próxima cita',
            icon: 'calendar',
            text: 'Hola {nombre},\n\nTe recordamos tu cita:\n📅 Fecha: {fecha_cita}\n👨‍⚕️ Doctor: {doctor}\n\nPor favor confirma tu asistencia.\n\nSaludos,\nClínica Sonalía',
            isDefault: true
        },
        {
            id: 'tpl_2',
            name: 'Feliz cumpleaños',
            description: 'Felicitación con descuento',
            icon: 'gift',
            text: '🎂 ¡Feliz cumpleaños {nombre}!\n\nEn tu día especial te obsequiamos 20% de descuento.\n\nCódigo: CUMPLE2025\n\n¡Te esperamos!\nClínica Sonalía',
            isDefault: true
        },
        {
            id: 'tpl_3',
            name: 'Promoción especial',
            description: 'Ofertas y descuentos',
            icon: 'tag',
            text: '✨ ¡Oferta especial para ti {nombre}!\n\nBlanqueamiento dental con 30% OFF\n\n👨‍⚕️ Con {doctor}\n📅 Válido hasta fin de mes\n\n¡Agenda tu cita!\nClínica Sonalía',
            isDefault: true
        }
    ];

    try {
        const stored = JSON.parse(localStorage.getItem('emailTemplates') || '[]');
        CRMState.templates = [...defaultTemplates, ...stored.filter(t => !t.isDefault)];
    } catch {
        CRMState.templates = defaultTemplates;
    }
}

function saveTemplates() {
    const custom = CRMState.templates.filter(t => !t.isDefault);
    localStorage.setItem('emailTemplates', JSON.stringify(custom));
}

function setupTemplateManager() {
    renderTemplates();
    setupTemplateModal();
}

function renderTemplates() {
    const container = document.getElementById('templateGrid');
    if (!container) return;

    const icons = {
        calendar: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
        gift: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
        tag: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>',
        mail: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>'
    };

    container.innerHTML = CRMState.templates.map(tpl => `
        <div class="template-card border border-[#D9D9D9] rounded-xl p-4 hover:border-[#4EABBE] hover:shadow-md transition cursor-pointer group relative" data-id="${tpl.id}">
            ${!tpl.isDefault ? `
            <div class="template-actions absolute top-2 right-2 flex gap-1">
                <button class="edit-tpl p-1.5 bg-white rounded-lg shadow hover:bg-[#F8F7F7]" title="Editar">
                    <svg class="w-4 h-4 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                </button>
                <button class="delete-tpl p-1.5 bg-white rounded-lg shadow hover:bg-red-50" title="Eliminar">
                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
            ` : '<span class="absolute top-2 right-2 px-2 py-0.5 bg-[#8BCFDD]/30 text-[#1D5D69] text-xs rounded-full">Predeterminada</span>'}
            
            <div class="bg-gradient-to-br from-[#8BCFDD]/20 to-[#4EABBE]/10 h-28 rounded-lg mb-3 flex items-center justify-center">
                ${tpl.image ? `<img src="${tpl.image}" class="w-full h-full object-cover rounded-lg" alt="${tpl.name}"/>` : 
                `<svg class="w-12 h-12 text-[#4EABBE]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[tpl.icon] || icons.mail}</svg>`}
            </div>
            <h3 class="font-semibold text-[#0F2532] group-hover:text-[#1D5D69] truncate">${tpl.name}</h3>
            <p class="text-sm text-[#0F2532]/60 mt-1 truncate">${tpl.description || ''}</p>
            <button class="use-tpl mt-3 w-full py-2 bg-[#F8F7F7] border border-[#D9D9D9] rounded-lg hover:bg-[#4EABBE] hover:text-white hover:border-[#4EABBE] font-medium text-sm transition">
                Usar plantilla
            </button>
        </div>
    `).join('') + `
        <div id="addTemplateCard" class="border-2 border-dashed border-[#D9D9D9] rounded-xl p-4 flex flex-col items-center justify-center h-64 hover:border-[#4EABBE] hover:bg-[#F8F7F7]/50 transition cursor-pointer group">
            <div class="w-14 h-14 rounded-full bg-[#8BCFDD]/20 flex items-center justify-center mb-3 group-hover:bg-[#4EABBE]/20 transition">
                <svg class="w-7 h-7 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
            </div>
            <p class="font-medium text-[#0F2532]/70">Nueva plantilla</p>
            <p class="text-xs text-[#0F2532]/40 mt-1">Crear personalizada</p>
        </div>
    `;

    // Event listeners
    container.querySelectorAll('.use-tpl').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.template-card').dataset.id;
            useTemplate(id);
        });
    });

    container.querySelectorAll('.edit-tpl').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.template-card').dataset.id;
            editTemplate(id);
        });
    });

    container.querySelectorAll('.delete-tpl').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.template-card').dataset.id;
            deleteTemplate(id);
        });
    });

    document.getElementById('addTemplateCard')?.addEventListener('click', () => openTemplateModal());
}

function useTemplate(id) {
    const tpl = CRMState.templates.find(t => t.id === id);
    if (!tpl) return;

    const subjectInput = document.getElementById('emailSubject');
    const messageInput = document.getElementById('emailMessage');

    if (subjectInput) subjectInput.value = tpl.name;
    if (messageInput) messageInput.value = tpl.text;

    showToast(`Plantilla "${tpl.name}" aplicada`, "success");
    updatePreview();
}

function editTemplate(id) {
    const tpl = CRMState.templates.find(t => t.id === id);
    if (!tpl || tpl.isDefault) return;

    CRMState.currentEditingTemplate = tpl;
    openTemplateModal(tpl);
}

function deleteTemplate(id) {
    const tpl = CRMState.templates.find(t => t.id === id);
    if (!tpl || tpl.isDefault) return;

    if (!confirm(`¿Eliminar plantilla "${tpl.name}"?`)) return;

    CRMState.templates = CRMState.templates.filter(t => t.id !== id);
    saveTemplates();
    renderTemplates();
    showToast("Plantilla eliminada", "info");
}

function setupTemplateModal() {
    const modal = document.getElementById('templateEditorModal');
    const cancelBtn = document.getElementById('cancelTemplateBtn');
    const saveBtn = document.getElementById('saveTemplateBtn');

    cancelBtn?.addEventListener('click', () => {
        modal?.classList.add('hidden');
        CRMState.currentEditingTemplate = null;
    });

    saveBtn?.addEventListener('click', saveTemplate);
}

function openTemplateModal(template = null) {
    const modal = document.getElementById('templateEditorModal');
    const title = modal?.querySelector('h3');
    const nameInput = document.getElementById('templateNameInput');
    const textInput = document.getElementById('templateTextInput');
    const imageInput = document.getElementById('templateImageInput');

    if (title) title.textContent = template ? 'Editar plantilla' : 'Nueva plantilla';
    if (nameInput) nameInput.value = template?.name || '';
    if (textInput) textInput.value = template?.text || '';
    if (imageInput) imageInput.value = '';

    CRMState.currentEditingTemplate = template;
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
}

function saveTemplate() {
    const nameInput = document.getElementById('templateNameInput');
    const textInput = document.getElementById('templateTextInput');
    const imageInput = document.getElementById('templateImageInput');

    const name = nameInput?.value.trim();
    const text = textInput?.value.trim();

    if (!name || !text) {
        showToast("Completa nombre y texto", "warning");
        return;
    }

    const processTemplate = (imageData = null) => {
        if (CRMState.currentEditingTemplate) {
            // Editar existente
            const tpl = CRMState.templates.find(t => t.id === CRMState.currentEditingTemplate.id);
            if (tpl) {
                tpl.name = name;
                tpl.text = text;
                if (imageData) tpl.image = imageData;
            }
        } else {
            // Crear nueva
            CRMState.templates.push({
                id: 'tpl_' + Date.now(),
                name,
                text,
                description: text.substring(0, 50) + '...',
                icon: 'mail',
                image: imageData,
                isDefault: false
            });
        }

        saveTemplates();
        renderTemplates();
        document.getElementById('templateEditorModal')?.classList.add('hidden');
        CRMState.currentEditingTemplate = null;
        showToast(CRMState.currentEditingTemplate ? "Plantilla actualizada" : "Plantilla creada", "success");
    };

    const file = imageInput?.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => processTemplate(e.target.result);
        reader.readAsDataURL(file);
    } else {
        processTemplate();
    }
}

/* ============================================================================
   RECIPIENT SELECTOR - MEJORADO
============================================================================ */
async function fetchPatientsByGroup(group) {
    try {
        const patients = await window.electronAPI?.invoke("get-patients", { group });
        return Array.isArray(patients) ? patients.filter(p => p.email?.trim()) : [];
    } catch {
        return getMockPatients().filter(p => p.email?.trim());
    }
}

function getMockPatients() {
    return [
        { id: 1, nombre: 'María García', email: 'maria@example.com', telefono: '555-0001', fecha_cita: '25/11/2025', doctor: 'Dr. López', status: 'active' },
        { id: 2, nombre: 'Juan Pérez', email: 'juan@example.com', telefono: '555-0002', fecha_cita: '26/11/2025', doctor: 'Dra. Martínez', status: 'active' },
        { id: 3, nombre: 'Ana Rodríguez', email: 'ana@example.com', telefono: '555-0003', fecha_cita: '27/11/2025', doctor: 'Dr. López', status: 'inactive' },
        { id: 4, nombre: 'Carlos Hernández', email: 'carlos@example.com', telefono: '555-0004', fecha_cita: '28/11/2025', doctor: 'Dra. Martínez', status: 'active' },
        { id: 5, nombre: 'Laura Sánchez', email: 'laura@example.com', telefono: '555-0005', fecha_cita: '29/11/2025', doctor: 'Dr. López', status: 'inactive' }
    ];
}

function setupRecipientSelector() {
    const groupSelect = document.getElementById('emailRecipients');
    const selectBtn = document.getElementById('selectRecipientsBtn');
    const selectedContainer = document.getElementById('selectedPatientsContainer');

    groupSelect?.addEventListener('change', async (e) => {
        const group = e.target.value;
        if (!group) {
            CRMState.selectedPatients = [];
            updateRecipientDisplay();
            return;
        }

        if (!CRMState.gmailConnected) {
            showToast("Conecta Gmail primero", "warning");
            e.target.value = '';
            return;
        }

        CRMState.allPatients = await fetchPatientsByGroup(group);
        CRMState.selectedPatients = [...CRMState.allPatients];
        updateRecipientDisplay();
    });

    selectBtn?.addEventListener('click', openRecipientModal);
    setupRecipientModal();
}

function updateRecipientDisplay() {
    const countEl = document.getElementById('recipientCount');
    const container = document.getElementById('selectedPatientsContainer');
    const sendBtn = document.getElementById('sendBulkEmailBtn');

    const count = CRMState.selectedPatients.length;

    if (countEl) {
        countEl.innerHTML = count > 0 
            ? `<span class="flex items-center gap-2">
                <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                <strong>${count}</strong> paciente${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}
               </span>`
            : '<span class="text-[#0F2532]/50">Selecciona destinatarios</span>';
    }

    if (container && count > 0 && count <= 10) {
        container.innerHTML = `
            <div class="flex flex-wrap gap-1.5 mt-2">
                ${CRMState.selectedPatients.slice(0, 5).map(p => `
                    <span class="patient-chip inline-flex items-center gap-1 px-2 py-1 bg-[#8BCFDD]/20 text-[#1D5D69] rounded-full text-xs">
                        ${p.nombre?.split(' ')[0] || p.email}
                        <button class="remove-patient hover:text-red-500" data-email="${p.email}">×</button>
                    </span>
                `).join('')}
                ${count > 5 ? `<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">+${count - 5} más</span>` : ''}
            </div>
        `;

        container.querySelectorAll('.remove-patient').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const email = btn.dataset.email;
                CRMState.selectedPatients = CRMState.selectedPatients.filter(p => p.email !== email);
                updateRecipientDisplay();
            });
        });
    } else if (container) {
        container.innerHTML = '';
    }

    if (sendBtn) {
        const enabled = count > 0 && CRMState.gmailConnected && !CRMState.isSending;
        sendBtn.disabled = !enabled;
        sendBtn.classList.toggle('opacity-60', !enabled);
        sendBtn.classList.toggle('cursor-not-allowed', !enabled);
    }
}

function setupRecipientModal() {
    const modal = document.getElementById('recipientsModal');
    const list = document.getElementById('recipientsList');
    const searchInput = document.getElementById('recipientSearch');
    const selectAllBtn = document.getElementById('selectAllRecipients');
    const cancelBtn = document.getElementById('cancelRecipientsBtn');
    const applyBtn = document.getElementById('applyRecipientsBtn');

    searchInput?.addEventListener('input', (e) => filterRecipientList(e.target.value));
    selectAllBtn?.addEventListener('click', toggleSelectAll);
    cancelBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
    applyBtn?.addEventListener('click', applyRecipientSelection);
}

async function openRecipientModal() {
    const modal = document.getElementById('recipientsModal');
    const list = document.getElementById('recipientsList');

    if (!CRMState.allPatients.length) {
        CRMState.allPatients = await fetchPatientsByGroup('all');
    }

    renderRecipientList(CRMState.allPatients);
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
}

function renderRecipientList(patients) {
    const list = document.getElementById('recipientsList');
    if (!list) return;

    if (!patients.length) {
        list.innerHTML = '<p class="text-center text-[#0F2532]/50 py-8">No hay pacientes disponibles</p>';
        return;
    }

    list.innerHTML = patients.map(p => `
        <label class="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F8F7F7] cursor-pointer transition border border-transparent hover:border-[#D9D9D9]">
            <input type="checkbox" class="recipient-check w-5 h-5 rounded border-[#D9D9D9] text-[#4EABBE] focus:ring-[#4EABBE]"
                data-email="${p.email}" data-name="${p.nombre}" ${CRMState.selectedPatients.find(s => s.email === p.email) ? 'checked' : ''}/>
            <div class="flex-1 min-w-0">
                <p class="font-medium text-[#0F2532] truncate">${p.nombre}</p>
                <p class="text-xs text-[#0F2532]/50 truncate">${p.email}</p>
            </div>
            <span class="px-2 py-0.5 text-xs rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                ${p.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
        </label>
    `).join('');

    updateSelectAllState();
}

function filterRecipientList(query) {
    const q = query.toLowerCase().trim();
    const filtered = CRMState.allPatients.filter(p =>
        p.nombre?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
    );
    renderRecipientList(filtered);
}

function toggleSelectAll() {
    const checks = document.querySelectorAll('.recipient-check');
    const allChecked = Array.from(checks).every(c => c.checked);

    checks.forEach(c => c.checked = !allChecked);
    updateSelectAllState();
}

function updateSelectAllState() {
    const btn = document.getElementById('selectAllRecipients');
    const checks = document.querySelectorAll('.recipient-check');
    const checkedCount = Array.from(checks).filter(c => c.checked).length;

    if (btn) {
        btn.textContent = checkedCount === checks.length ? 'Deseleccionar todo' : 'Seleccionar todo';
    }

    const countDisplay = document.getElementById('modalRecipientCount');
    if (countDisplay) {
        countDisplay.textContent = `${checkedCount} de ${checks.length} seleccionados`;
    }
}

function applyRecipientSelection() {
    const checks = document.querySelectorAll('.recipient-check:checked');
    CRMState.selectedPatients = Array.from(checks).map(c => ({
        email: c.dataset.email,
        nombre: c.dataset.name
    }));

    updateRecipientDisplay();
    document.getElementById('recipientsModal')?.classList.add('hidden');

    if (CRMState.selectedPatients.length) {
        showToast(`${CRMState.selectedPatients.length} pacientes seleccionados`, 'success');
    }
}

/* ============================================================================
   EMAIL COMPOSER - MEJORADO
============================================================================ */
function setupEmailComposer() {
    const subjectInput = document.getElementById('emailSubject');
    const messageInput = document.getElementById('emailMessage');
    const previewBtn = document.getElementById('previewEmailBtn');
    const sendBtn = document.getElementById('sendBulkEmailBtn');

    // Variables insertion
    document.querySelectorAll('.variable-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const variable = btn.dataset.var;
            insertAtCursor(messageInput, variable);
            updatePreview();
        });
    });

    // Quick subject variables
    document.querySelectorAll('.subject-var-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const variable = btn.dataset.var;
            insertAtCursor(subjectInput, variable);
        });
    });

    // Live preview
    subjectInput?.addEventListener('input', updatePreview);
    messageInput?.addEventListener('input', updatePreview);

    // Preview button
    previewBtn?.addEventListener('click', showFullPreview);

    // Send button
    sendBtn?.addEventListener('click', sendBulkEmails);

    // Character counter
    messageInput?.addEventListener('input', updateCharCount);
}

function insertAtCursor(input, text) {
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;
    input.value = value.substring(0, start) + text + value.substring(end);
    input.selectionStart = input.selectionEnd = start + text.length;
    input.focus();
}

function updateCharCount() {
    const messageInput = document.getElementById('emailMessage');
    const counter = document.getElementById('charCount');
    if (messageInput && counter) {
        const len = messageInput.value.length;
        counter.textContent = `${len} caracteres`;
        counter.className = len > 2000 ? 'text-xs text-red-500' : 'text-xs text-[#0F2532]/40';
    }
}

function updatePreview() {
    const subjectInput = document.getElementById('emailSubject');
    const messageInput = document.getElementById('emailMessage');
    const previewSubject = document.getElementById('previewSubject');
    const previewBody = document.getElementById('previewBody');

    const samplePatient = CRMState.selectedPatients[0] || {
        nombre: 'Juan Pérez',
        fecha_cita: '25/11/2025',
        doctor: 'Dr. López',
        email: 'juan@example.com'
    };

    if (previewSubject) {
        previewSubject.textContent = replaceVariables(subjectInput?.value || 'Sin asunto', samplePatient);
    }

    if (previewBody) {
        const html = replaceVariables(messageInput?.value || '', samplePatient)
            .replace(/\n/g, '<br>');
        previewBody.innerHTML = html || '<span class="text-[#0F2532]/40">El contenido aparecerá aquí...</span>';
    }
}

function showFullPreview() {
    const subjectInput = document.getElementById('emailSubject');
    const messageInput = document.getElementById('emailMessage');

    const samplePatient = CRMState.selectedPatients[0] || {
        nombre: 'Juan Pérez',
        fecha_cita: '25/11/2025',
        doctor: 'Dr. López'
    };

    const subject = replaceVariables(subjectInput?.value || '', samplePatient);
    const body = replaceVariables(messageInput?.value || '', samplePatient);

    const previewModal = document.getElementById('emailPreviewModal');
    const previewContent = document.getElementById('fullPreviewContent');

    if (previewContent) {
        previewContent.innerHTML = `
            <div class="border-b border-[#E6E6E6] pb-4 mb-4">
                <p class="text-sm text-[#0F2532]/60">Para: <strong>${samplePatient.email || 'paciente@example.com'}</strong></p>
                <p class="text-sm text-[#0F2532]/60 mt-1">Asunto: <strong>${subject || 'Sin asunto'}</strong></p>
            </div>
            <div class="prose prose-sm max-w-none">
                ${body.replace(/\n/g, '<br>') || '<span class="text-[#0F2532]/40">Sin contenido</span>'}
            </div>
        `;
    }

    previewModal?.classList.remove('hidden');
    previewModal?.classList.add('flex');
}

async function sendBulkEmails() {
    if (CRMState.isSending) {
        showToast("Envío en proceso...", "warning");
        return;
    }

    const subject = document.getElementById('emailSubject')?.value.trim();
    const body = document.getElementById('emailMessage')?.value.trim();

    if (!subject) {
        showToast("Escribe un asunto", "warning");
        return;
    }
    if (!body) {
        showToast("Escribe el mensaje", "warning");
        return;
    }
    if (!CRMState.selectedPatients.length) {
        showToast("Selecciona destinatarios", "warning");
        return;
    }

    if (!confirm(`¿Enviar email a ${CRMState.selectedPatients.length} pacientes?`)) return;

    CRMState.isSending = true;
    const sendBtn = document.getElementById('sendBulkEmailBtn');
    const statusEl = document.getElementById('emailStatus');
    const progressBar = document.getElementById('emailProgress');
    const statusText = document.getElementById('emailStatusText');

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="animate-pulse">Enviando...</span>';
    statusEl?.classList.remove('hidden');

    let sent = 0, failed = 0;
    const total = CRMState.selectedPatients.length;

    for (let i = 0; i < total; i++) {
        const patient = CRMState.selectedPatients[i];
        const personalizedSubject = replaceVariables(subject, patient);
        const personalizedBody = replaceVariables(body, patient);

        try {
            const res = await window.electronAPI?.invoke("gmail-send", {
                to: patient.email,
                subject: personalizedSubject,
                html: personalizedBody.replace(/\n/g, '<br>')
            });

            if (res?.success) sent++;
            else failed++;
        } catch {
            failed++;
        }

        const progress = ((i + 1) / total) * 100;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (statusText) statusText.textContent = `Enviando ${i + 1} de ${total}...`;
    }

    CRMState.isSending = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Enviar masivo';

    if (statusText) {
        statusText.innerHTML = `<span class="text-green-600">✓ Completado: ${sent} enviados</span>${failed ? ` <span class="text-red-500">• ${failed} fallidos</span>` : ''}`;
    }

    showToast(`Enviados: ${sent} | Fallidos: ${failed}`, sent > failed ? 'success' : 'warning');

    // Reset form
    setTimeout(() => {
        document.getElementById('emailSubject').value = '';
        document.getElementById('emailMessage').value = '';
        document.getElementById('emailRecipients').value = '';
        CRMState.selectedPatients = [];
        updateRecipientDisplay();
        updatePreview();
        statusEl?.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
    }, 3000);
}

/* ============================================================================
   SURVEYS & REMINDERS
============================================================================ */
function setupSurveyEmails() {
    const btn = document.getElementById("sendSurveyEmailsBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const title = document.getElementById("surveyTitleInput")?.value.trim();
        const link = document.getElementById("surveyLinkInput")?.value.trim();
        const group = document.getElementById("surveyRecipients")?.value;

        if (!title || !link) {
            showToast("Completa título y link", "warning");
            return;
        }
        if (!group) {
            showToast("Selecciona destinatarios", "warning");
            return;
        }

        const patients = await fetchPatientsByGroup(group);
        if (!patients.length) {
            showToast("No hay pacientes", "warning");
            return;
        }

        if (!confirm(`¿Enviar encuesta a ${patients.length} pacientes?`)) return;

        btn.disabled = true;
        btn.textContent = 'Enviando...';

        let sent = 0;
        for (const p of patients) {
            const html = `
                <p>Hola ${p.nombre},</p>
                <p>Nos gustaría conocer tu opinión sobre tu experiencia.</p>
                <p><a href="${link}" style="color: #4EABBE; font-weight: bold;">Responder encuesta →</a></p>
                <p>Gracias,<br>Clínica Sonalía</p>
            `;

            const res = await window.electronAPI?.invoke("gmail-send", {
                to: p.email,
                subject: title,
                html
            });

            if (res?.success) sent++;
        }

        btn.disabled = false;
        btn.textContent = 'Enviar encuesta por Gmail';
        showToast(`Encuestas enviadas: ${sent}`, 'success');
    });
}

function setupReminderEmails() {
    const btn = document.getElementById("sendReminderEmailsBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        if (!confirm("¿Enviar recordatorios a pacientes activos?")) return;

        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const patients = await fetchPatientsByGroup("active");
        let sent = 0;

        for (const p of patients) {
            const html = `
                <p>Hola ${p.nombre},</p>
                <p>Te recordamos tu próxima cita en Clínica Sonalía.</p>
                <p>📅 Fecha: ${p.fecha_cita || 'Por confirmar'}<br>
                👨‍⚕️ Doctor: ${p.doctor || 'Tu dentista'}</p>
                <p>¡Te esperamos!</p>
            `;

            const res = await window.electronAPI?.invoke("gmail-send", {
                to: p.email,
                subject: "Recordatorio de tu cita - Clínica Sonalía",
                html
            });

            if (res?.success) sent++;
        }

        btn.disabled = false;
        btn.textContent = 'Enviar recordatorios ahora por Gmail';
        showToast(`Recordatorios enviados: ${sent}`, 'success');
    });
}

export {};