// pacientes.js — Mejorado con búsqueda, filtros, paginación y mejor UX

let db;
if (window.api && window.api.db) db = window.api.db;

/* ============================================================================
   STATE & CONFIG
============================================================================ */
const State = {
    patients: [],
    filtered: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    filterStatus: '',
    sortBy: 'recent',
    viewMode: 'list', // 'list' or 'grid'
    fieldConfig: {}
};

const ICONS = {
    user: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke-width="2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" /></svg>',
    mail: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>',
    calendar: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
    location: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11a3 3 0 100-6 3 3 0 000 6z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11c0 5-7 9-7 9s-7-4-7-9a7 7 0 1114 0z" /></svg>',
    phone: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3a2 2 0 012 1.5l1 3a2 2 0 01-.5 2L9 11a11 11 0 005 5l1.5-1.5a2 2 0 012-.5l3 1A2 2 0 0121 17v3a2 2 0 01-2 2h-1C9.82 22 2 14.18 2 4V3a2 2 0 012-2h-1z" /></svg>',
    whatsapp: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.57 2 2.13 6.43 2.13 11.9c0 1.75.46 3.46 1.33 4.96L2 22l5.27-1.38a9.84 9.84 0 004.77 1.22h.01c5.46 0 9.9-4.43 9.9-9.9A9.9 9.9 0 0012.04 2zm0 18.18h-.01a8.18 8.18 0 01-4.17-1.14l-.3-.18-3.13.82.84-3.05-.2-.31a8.18 8.18 0 01-1.25-4.35c0-4.52 3.68-8.19 8.2-8.19a8.19 8.19 0 018.19 8.19c0 4.52-3.67 8.21-8.17 8.21zm4.49-6.14c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.4-.41-.56-.42h-.48c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.14-1.17-.06-.1-.22-.16-.47-.28z"/></svg>'
};

const masterFields = [
    { key: 'nombre', label: 'Nombre', type: 'text', mapTo: 'nombre', icon: ICONS.user },
    { key: 'nombre_social', label: 'Nombre social', type: 'text', mapTo: 'nombre_social' },
    { key: 'apellido', label: 'Apellidos', type: 'text', mapTo: 'apellido' },
    { key: 'curp', label: 'CURP/RFC', type: 'text', mapTo: 'curp' },
    { key: 'email', label: 'Email', type: 'email', mapTo: 'email', icon: ICONS.mail },
    { key: 'convenio', label: 'Convenio', type: 'text', mapTo: 'convenio' },
    { key: 'numero_interno', label: 'Número Interno', type: 'text', mapTo: 'numero_interno' },
    { key: 'sexo', label: 'Sexo', type: 'select', options: ['', 'Masculino', 'Femenino', 'Otro'], mapTo: 'sexo' },
    { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', type: 'date', mapTo: 'fecha_nacimiento', icon: ICONS.calendar },
    { key: 'ciudad', label: 'Ciudad', type: 'text', mapTo: 'ciudad' },
    { key: 'delegacion', label: 'Delegación', type: 'text', mapTo: 'delegacion' },
    { key: 'direccion', label: 'Dirección', type: 'text', mapTo: 'direccion', icon: ICONS.location },
    { key: 'telefono', label: 'Teléfono', type: 'tel', mapTo: 'telefono', icon: ICONS.phone },
    { key: 'actividad', label: 'Actividad', type: 'text', mapTo: 'actividad' },
    { key: 'profesion', label: 'Profesión', type: 'text', mapTo: 'profesion' },
    { key: 'empleador', label: 'Empleador', type: 'text', mapTo: 'empleador' },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', mapTo: 'observaciones' },
    { key: 'apoderado', label: 'Apoderado', type: 'text', mapTo: 'apoderado' }
];

/* ============================================================================
   UTILITIES
============================================================================ */
import toast from './toast.js';
import { generateMedicalFormHTML, attachMedicalFormListeners, extractMedicalFormData } from './medical-form-ui.js';
import { generatePersonalFormHTML } from './personal-form-ui.js';

const isShown = (key) => !!(State.fieldConfig[key]?.show);
const isRequired = (key) => !!(State.fieldConfig[key]?.required);

function showToast(message, type = 'info') {
    toast.show(message, type);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getInitials(nombre, apellido) {
    return ((nombre?.[0] || '') + (apellido?.[0] || '')).toUpperCase() || '?';
}

function getPatientStatus(patient) {
    const created = new Date(patient.created_at || patient.fecha_registro || Date.now());
    const now = new Date();
    const daysSinceCreated = Math.floor((now - created) / (1000 * 60 * 60 * 24));

    if (daysSinceCreated <= 7) return { label: 'Nuevo', class: 'bg-purple-100 text-purple-700' };
    // TODO: Check last appointment date for active/inactive status
    return { label: 'Activo', class: 'bg-green-100 text-green-700' };
}

function getWhatsAppLink(telefono) {
    if (!telefono) return '';
    let number = String(telefono).replace(/\D/g, '');
    if (number.length === 10) number = `52${number}`;
    if (number.length < 11) return '';
    return `https://web.whatsapp.com/send?phone=${number}`;
}

function renderPhoneWithWhatsApp(telefono, fallback = '-') {
    const label = telefono || fallback;
    const href = getWhatsAppLink(telefono);
    const whatsappButton = href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-center justify-center w-7 h-7 rounded-full text-green-600 hover:text-white hover:bg-green-500 dark:text-green-400 dark:hover:text-white dark:hover:bg-green-500 transition" title="Abrir chat en WhatsApp Web" aria-label="Abrir chat en WhatsApp Web">${ICONS.whatsapp}</a>`
        : '';
    return `<span class="truncate">${label}</span>${whatsappButton}`;
}

/* ============================================================================
   CONFIG MANAGEMENT
============================================================================ */
function loadConfig(cb) {
    const applyDefaults = () => {
        masterFields.forEach(f => {
            if (!State.fieldConfig[f.key]) State.fieldConfig[f.key] = { show: false, required: false };
        });
        State.fieldConfig['nombre'] = { show: true, required: true };
        State.fieldConfig['apellido'] = { show: true, required: true };
    };

    if (!db) { applyDefaults(); cb?.(); return; }

    const clave = 'required_fields_paciente';
    try {
        const query = "SELECT valor FROM admin_config WHERE clave = ?";
        if (db.get.length >= 3) {
            db.get(query, [clave], (err, row) => {
                if (!err && row?.valor) {
                    try {
                        const parsed = JSON.parse(row.valor);
                        State.fieldConfig = Array.isArray(parsed)
                            ? parsed.reduce((acc, k) => ({ ...acc, [k]: { show: true, required: true } }), {})
                            : parsed;
                    } catch { }
                }
                applyDefaults(); cb?.();
            });
        } else {
            db.get(query, [clave]).then(row => {
                if (row?.valor) {
                    try {
                        const parsed = JSON.parse(row.valor);
                        State.fieldConfig = Array.isArray(parsed)
                            ? parsed.reduce((acc, k) => ({ ...acc, [k]: { show: true, required: true } }), {})
                            : parsed;
                    } catch { }
                }
                applyDefaults(); cb?.();
            }).catch(() => { applyDefaults(); cb?.(); });
        }
    } catch { applyDefaults(); cb?.(); }
}

function saveFieldConfig(newConfig, cb) {
    const sql = `INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)`;
    const params = ['required_fields_paciente', JSON.stringify(newConfig)];

    if (!db) { State.fieldConfig = newConfig; cb?.(null); return; }

    try {
        if (db.run.length >= 3) {
            db.run(sql, params, (err) => { if (!err) State.fieldConfig = newConfig; cb?.(err); });
        } else {
            db.run(sql, params).then(() => { State.fieldConfig = newConfig; cb?.(null); }).catch(cb);
        }
    } catch (e) { cb?.(e); }
}

/* ============================================================================
   DATA LOADING
============================================================================ */
function loadPatients() {
    if (!db) {
        // Mock data for testing
        State.patients = getMockPatients();
        applyFilters();
        return;
    }

    db.all("SELECT * FROM pacientes ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            console.error(err);
            showToast('Error al cargar pacientes', 'error');
            return;
        }
        State.patients = rows || [];
        applyFilters();
    });
}

function getMockPatients() {
    return [
        { id: 1, nombre: 'María', apellido: 'García López', telefono: '555-0001', email: 'maria@example.com', created_at: new Date().toISOString() },
        { id: 2, nombre: 'Juan', apellido: 'Pérez Hernández', telefono: '555-0002', email: 'juan@example.com', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
        { id: 3, nombre: 'Ana', apellido: 'Rodríguez Martínez', telefono: '555-0003', email: 'ana@example.com', created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
        { id: 4, nombre: 'Carlos', apellido: 'Hernández Silva', telefono: '555-0004', email: 'carlos@example.com', created_at: new Date(Date.now() - 86400000 * 200).toISOString() },
        { id: 5, nombre: 'Laura', apellido: 'Sánchez Ruiz', telefono: '555-0005', email: 'laura@example.com', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
    ];
}

/* ============================================================================
   FILTERING & SORTING
============================================================================ */
function applyFilters() {
    let result = [...State.patients];

    // Search
    if (State.searchQuery) {
        const q = State.searchQuery.toLowerCase();
        result = result.filter(p =>
            p.nombre?.toLowerCase().includes(q) ||
            p.apellido?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            p.telefono?.includes(q)
        );
    }

    // Filter by status
    if (State.filterStatus) {
        const now = new Date();
        result = result.filter(p => {
            const created = new Date(p.created_at || Date.now());
            const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));

            if (State.filterStatus === 'new') return days <= 7;
            if (State.filterStatus === 'inactive') return days > 180;
            if (State.filterStatus === 'active') return days <= 180;
            return true;
        });
    }

    // Sort
    result.sort((a, b) => {
        switch (State.sortBy) {
            case 'oldest': return new Date(a.created_at || 0) - new Date(b.created_at || 0);
            case 'name-asc': return (a.nombre || '').localeCompare(b.nombre || '');
            case 'name-desc': return (b.nombre || '').localeCompare(a.nombre || '');
            default: return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
    });

    State.filtered = result;
    State.currentPage = 1;

    updateStats();
    renderPatients();
    updatePagination();
}

/* ============================================================================
   RENDERING
============================================================================ */
function updateStats() {
    const total = State.patients.length;
    const now = new Date();

    let active = 0, newPatients = 0, pending = 0;
    State.patients.forEach(p => {
        const created = new Date(p.created_at || Date.now());
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));

        if (days <= 7) newPatients++;
        if (days <= 30) active++;
        if (days > 180) pending++;
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statNew').textContent = newPatients;
    document.getElementById('statPending').textContent = pending;
}

function renderPatients() {
    const tableContainer = document.getElementById('patientsTableContainer');
    const gridContainer = document.getElementById('patientsGridContainer');
    const emptyState = document.getElementById('emptyState');
    const tbody = document.getElementById('patients-list-body');
    const resultsInfo = document.getElementById('resultsInfo');

    // Calculate pagination
    const start = (State.currentPage - 1) * State.perPage;
    const end = start + State.perPage;
    const paginated = State.filtered.slice(start, end);

    // Update results info
    if (State.filtered.length === 0) {
        resultsInfo.textContent = State.searchQuery || State.filterStatus
            ? 'No se encontraron resultados'
            : 'No hay pacientes registrados';
    } else {
        resultsInfo.textContent = `Mostrando ${start + 1}-${Math.min(end, State.filtered.length)} de ${State.filtered.length} pacientes`;
    }

    // Show/hide containers based on data
    if (State.patients.length === 0) {
        tableContainer.classList.add('hidden');
        gridContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    if (State.viewMode === 'list') {
        tableContainer.classList.remove('hidden');
        gridContainer.classList.add('hidden');
        renderTableView(tbody, paginated);
    } else {
        tableContainer.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        renderGridView(gridContainer, paginated);
    }
}

function renderTableView(tbody, patients) {
    if (!patients.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-[#0F2532]/50">
                    No se encontraron pacientes con los filtros aplicados
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = patients.map((p, i) => {
        const status = getPatientStatus(p);
        const initials = getInitials(p.nombre, p.apellido);

        return `
            <tr class="patient-row hover:bg-[#F8F7F7] dark:hover:bg-gray-700/50 cursor-pointer transition-all duration-200 border-b border-[#E6E6E6] dark:border-gray-700 last:border-0" data-id="${p.id}" style="animation-delay: ${i * 50}ms">
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            ${initials}
                        </div>
                        <div>
                            <p class="font-semibold text-[#0F2532] dark:text-gray-100">${p.nombre} ${p.apellido}</p>
                            <p class="text-xs text-[#0F2532]/50 dark:text-gray-500">ID: ${p.id}</p>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6">
                    <div class="space-y-1">
                        <p class="text-sm text-[#0F2532] dark:text-gray-300 flex items-center gap-2">
                            <svg class="w-4 h-4 text-[#0F2532]/40 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                            ${p.email || '-'}
                        </p>
                        <p class="text-sm text-[#0F2532]/70 dark:text-gray-400 flex items-center gap-2">
                            <svg class="w-4 h-4 text-[#0F2532]/40 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                            ${renderPhoneWithWhatsApp(p.telefono)}
                        </p>
                    </div>
                </td>
                <td class="py-4 px-6">
                    <p class="text-sm text-[#0F2532] dark:text-gray-300">${formatDate(p.created_at)}</p>
                </td>
                <td class="py-4 px-6">
                    <span class="px-3 py-1 ${status.class} rounded-full text-xs font-semibold border border-transparent dark:border-white/10 shadow-sm">${status.label}</span>
                </td>
                <td class="py-4 px-6">
                    <div class="flex items-center justify-center gap-2">
                        <button class="action-view p-2 hover:bg-[#8BCFDD]/20 dark:hover:bg-[#8BCFDD]/10 rounded-lg transition" title="Ver ficha">
                            <svg class="w-5 h-5 text-[#4EABBE] dark:text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                        <button class="action-edit p-2 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition" title="Editar">
                            <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button class="action-delete p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition" title="Eliminar">
                            <svg class="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Add event listeners
    tbody.querySelectorAll('.patient-row').forEach(row => {
        const id = row.dataset.id;
        row.querySelector('.action-view')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `ficha_clinica.html?id=${id}`;
        });
        row.querySelector('.action-edit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            editPatient(id);
        });
        row.querySelector('.action-delete')?.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePatient(id);
        });
        row.addEventListener('click', () => {
            console.log('Navigating to patient:', id);
            if (id) {
                window.location.assign(`ficha_clinica.html?id=${id}`);
            } else {
                console.error('Patient ID is missing');
                showToast('Error: ID de paciente no válido', 'error');
            }
        });
    });
}

function renderGridView(container, patients) {
    container.innerHTML = patients.map(p => {
        const status = getPatientStatus(p);
        const initials = getInitials(p.nombre, p.apellido);

        return `
            <div class="patient-card bg-white dark:bg-gray-800 rounded-xl border border-[#D9D9D9] dark:border-gray-700 p-5 hover:shadow-lg hover:border-[#4EABBE] dark:hover:border-[#4EABBE] transition-all duration-300 cursor-pointer" data-id="${p.id}">
                <div class="flex items-start justify-between mb-4">
                    <div class="w-14 h-14 bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                        ${initials}
                    </div>
                    <span class="px-2.5 py-1 ${status.class} rounded-full text-xs font-semibold border border-transparent dark:border-white/10">${status.label}</span>
                </div>
                <h3 class="font-semibold text-[#0F2532] dark:text-white text-lg truncate">${p.nombre} ${p.apellido}</h3>
                <div class="mt-3 space-y-2">
                    <p class="text-sm text-[#0F2532]/60 dark:text-gray-400 flex items-center gap-2 truncate">
                        <svg class="w-4 h-4 flex-shrink-0 text-[#0F2532]/40 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"/>
                        </svg>
                        ${p.email || 'Sin email'}
                    </p>
                    <p class="text-sm text-[#0F2532]/60 dark:text-gray-400 flex items-center gap-2">
                        <svg class="w-4 h-4 flex-shrink-0 text-[#0F2532]/40 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        ${renderPhoneWithWhatsApp(p.telefono, 'Sin teléfono')}
                    </p>
                </div>
                <div class="mt-4 pt-4 border-t border-[#E6E6E6] dark:border-gray-700 flex items-center justify-between">
                    <span class="text-xs text-[#0F2532]/40 dark:text-gray-500">${formatDate(p.created_at)}</span>
                    <button class="text-[#4EABBE] dark:text-[#4EABBE] text-sm font-medium hover:underline">Ver ficha →</button>
                </div>
            </div>`;
    }).join('');

    container.querySelectorAll('.patient-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            console.log('Navigating to patient (grid):', id);
            if (id) {
                window.location.assign(`ficha_clinica.html?id=${id}`);
            } else {
                console.error('Patient ID is missing');
                showToast('Error: ID de paciente no válido', 'error');
            }
        });
    });
}

function updatePagination() {
    const totalPages = Math.ceil(State.filtered.length / State.perPage);
    const info = document.getElementById('paginationInfo');
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');

    info.textContent = `Página ${State.currentPage} de ${totalPages || 1}`;
    prev.disabled = State.currentPage <= 1;
    next.disabled = State.currentPage >= totalPages;
}

/* ============================================================================
   EVENT HANDLERS
============================================================================ */
function setupEventListeners() {
    // Search
    document.getElementById('searchInput')?.addEventListener('input', debounce((e) => {
        State.searchQuery = e.target.value.trim();
        applyFilters();
        updateClearFiltersVisibility();
    }, 300));

    // Filter status
    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
        State.filterStatus = e.target.value;
        applyFilters();
        updateClearFiltersVisibility();
    });

    // Sort
    document.getElementById('filterSort')?.addEventListener('change', (e) => {
        State.sortBy = e.target.value;
        applyFilters();
    });

    // Clear filters
    document.getElementById('clearFilters')?.addEventListener('click', () => {
        State.searchQuery = '';
        State.filterStatus = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('filterStatus').value = '';
        applyFilters();
        updateClearFiltersVisibility();
    });

    // View toggle
    document.getElementById('viewList')?.addEventListener('click', () => setViewMode('list'));
    document.getElementById('viewGrid')?.addEventListener('click', () => setViewMode('grid'));

    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (State.currentPage > 1) { State.currentPage--; renderPatients(); updatePagination(); }
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(State.filtered.length / State.perPage);
        if (State.currentPage < totalPages) { State.currentPage++; renderPatients(); updatePagination(); }
    });

    // Buttons
    document.getElementById('newPatientBtn')?.addEventListener('click', showNewPatientModal);
    document.getElementById('configBtn')?.addEventListener('click', showConfigModal);
    document.getElementById('exportBtn')?.addEventListener('click', exportPatients);

    // Import
    document.getElementById('importBtn')?.addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile')?.addEventListener('change', handleImport);
}

function updateClearFiltersVisibility() {
    const btn = document.getElementById('clearFilters');
    if (State.searchQuery || State.filterStatus) {
        btn?.classList.remove('hidden');
    } else {
        btn?.classList.add('hidden');
    }
}

function setViewMode(mode) {
    State.viewMode = mode;

    document.getElementById('viewList').className = `p-2 rounded-lg transition ${mode === 'list' ? 'bg-[#8BCFDD]/20' : 'hover:bg-[#F8F7F7]'}`;
    document.getElementById('viewGrid').className = `p-2 rounded-lg transition ${mode === 'grid' ? 'bg-[#8BCFDD]/20' : 'hover:bg-[#F8F7F7]'}`;

    document.getElementById('viewList').querySelector('svg').className = `w-5 h-5 ${mode === 'list' ? 'text-[#4EABBE]' : 'text-[#0F2532]/40'}`;
    document.getElementById('viewGrid').querySelector('svg').className = `w-5 h-5 ${mode === 'grid' ? 'text-[#4EABBE]' : 'text-[#0F2532]/40'}`;

    renderPatients();
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

/* ============================================================================
   MODALS
============================================================================ */
function showNewPatientModal() {
    loadConfig(() => {
        const visibleFields = masterFields.filter(f =>
            f.key === 'nombre' || f.key === 'apellido' || isShown(f.key)
        );

        const fieldsHtml = visibleFields.map(f => {
            const req = isRequired(f.key);
            const reqAttr = req ? 'required' : '';
            const reqMark = req ? '<span class="text-red-500">*</span>' : '';

            if (f.type === 'textarea') {
                return `
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">${f.label} ${reqMark}</label>
                        <textarea name="${f.key}" ${reqAttr} rows="3" 
                            class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] bg-white dark:bg-[#0F2532] dark:text-white resize-none transition"
                            placeholder="Escribe aquí..."></textarea>
                    </div>`;
            }

            if (f.type === 'select') {
                const opts = (f.options || []).map(o => `<option value="${o}">${o || 'Seleccionar...'}</option>`).join('');
                return `
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">${f.label} ${reqMark}</label>
                        <select name="${f.key}" ${reqAttr} class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] bg-white dark:bg-[#0F2532] dark:text-white transition">
                            ${opts}
                        </select>
                    </div>`;
            }

            return `
                <div>
                    <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">${f.label} ${reqMark}</label>
                    <input type="${f.type}" name="${f.key}" ${reqAttr}
                        class="w-full px-4 py-3 border border-[#D9D9D9] dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#4EABBE] focus:border-[#4EABBE] bg-white dark:bg-[#0F2532] dark:text-white transition"
                        placeholder="${f.label}"/>
                </div>`;
        }).join('');

        const modal = document.createElement('div');
        modal.id = 'new-patient-modal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-white dark:bg-[#0E1A25] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden animate-slide-up flex flex-col">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 flex justify-between items-center shrink-0">
                    <div>
                        <h2 class="text-2xl font-bold">Nuevo Paciente</h2>
                        <p id="modal-subtitle" class="text-white/70 text-sm mt-1">Paso 1: Datos Personales</p>
                    </div>
                    <button type="button" id="closeNewPatient" class="p-2 hover:bg-white/20 rounded-lg transition">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <form id="form-new-patient" class="flex-1 overflow-hidden flex relative w-full h-[90vh] min-h-[850px]">
                    <!-- Step 1: Datos Personales -->
                    <div id="step-1" class="flex flex-col w-full h-full absolute inset-0 transition-all duration-300 transform translate-x-0 opacity-100 z-10">
                        <div class="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                ${generatePersonalFormHTML({}, State.fieldConfig)}
                            </div>
                        </div>
                        <div class="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-[#E6E6E6] dark:border-slate-700">
                            <button type="button" id="cancelNewPatient" class="px-5 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 text-[#0F2532] dark:text-gray-200 font-medium transition">
                                Cancelar
                            </button>
                            <button type="button" id="nextStepBtn" class="px-6 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold transition flex items-center gap-2">
                                Siguiente
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Step 2: Antecedentes Medicos -->
                    <div id="step-2" class="flex flex-col w-full h-full absolute inset-0 transition-all duration-300 transform translate-x-full opacity-0 -z-10">
                        <div class="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            ${generateMedicalFormHTML()}
                        </div>
                        <div class="shrink-0 flex justify-between items-center px-6 py-4 border-t border-[#E6E6E6] dark:border-slate-700">
                            <button type="button" id="prevStepBtn" class="px-5 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 text-[#0F2532] dark:text-gray-200 font-medium transition flex items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                                Anterior
                            </button>
                            <button type="submit" class="px-6 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold transition flex items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                Guardar Paciente
                            </button>
                        </div>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(modal);
        attachMedicalFormListeners(modal);

        const step1 = modal.querySelector('#step-1');
        const step2 = modal.querySelector('#step-2');
        const subtitle = modal.querySelector('#modal-subtitle');
        const formNewPatient = modal.querySelector('#form-new-patient');

        modal.querySelector('#nextStepBtn').addEventListener('click', () => {
            if (!formNewPatient.reportValidity()) return;
            step1.classList.remove('translate-x-0', 'opacity-100', 'z-10');
            step1.classList.add('-translate-x-full', 'opacity-0', '-z-10');
            step2.classList.remove('translate-x-full', 'opacity-0', '-z-10');
            step2.classList.add('translate-x-0', 'opacity-100', 'z-10');
            subtitle.textContent = "Paso 2: Antecedentes Médicos";
        });

        modal.querySelector('#prevStepBtn').addEventListener('click', () => {
            step2.classList.remove('translate-x-0', 'opacity-100', 'z-10');
            step2.classList.add('translate-x-full', 'opacity-0', '-z-10');
            step1.classList.remove('-translate-x-full', 'opacity-0', '-z-10');
            step1.classList.add('translate-x-0', 'opacity-100', 'z-10');
            subtitle.textContent = "Paso 1: Datos Personales";
        });

        const closeModal = () => modal.remove();
        modal.querySelector('#closeNewPatient').addEventListener('click', closeModal);
        modal.querySelector('#cancelNewPatient').addEventListener('click', closeModal);
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onEsc); }
        });

        formNewPatient.addEventListener('submit', (e) => {
            e.preventDefault();
            savePatient(e.target);
        });
    });
}

function showConfigModal() {
    loadConfig(() => {
        const modal = document.createElement('div');
        modal.id = 'config-modal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in';

        const fieldsHtml = masterFields.map(f => {
            const cfg = State.fieldConfig[f.key] || { show: false, required: false };
            const isCore = f.key === 'nombre' || f.key === 'apellido';

            return `
                <div class="field-config-row flex items-center justify-between p-3 rounded-lg border border-[#E6E6E6] dark:border-slate-700 hover:border-[#4EABBE] transition" data-key="${f.key}">
                    <span class="font-medium text-[#0F2532] dark:text-slate-200">${f.label}</span>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" name="show-${f.key}" ${cfg.show ? 'checked' : ''} ${isCore ? 'checked disabled' : ''}
                                class="w-4 h-4 rounded border-[#D9D9D9] text-[#4EABBE] focus:ring-[#4EABBE]"/>
                            <span class="text-[#0F2532]/70 dark:text-slate-400">Mostrar</span>
                        </label>
                        <label class="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" name="req-${f.key}" ${cfg.required ? 'checked' : ''} ${isCore ? 'checked disabled' : ''}
                                class="w-4 h-4 rounded border-[#D9D9D9] text-[#4EABBE] focus:ring-[#4EABBE]"/>
                            <span class="text-[#0F2532]/70 dark:text-slate-400">Requerido</span>
                        </label>
                    </div>
                </div>`;
        }).join('');

        modal.innerHTML = `
            <div class="bg-white dark:bg-[#0E1A25] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-slide-up">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold">Configuración de Campos</h2>
                        <p class="text-white/70 text-sm mt-1">Personaliza qué campos mostrar en el formulario</p>
                    </div>
                    <button id="closeConfig" class="p-2 hover:bg-white/20 rounded-lg transition">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)] scrollbar-thin">
                    <div class="bg-[#8BCFDD]/10 dark:bg-[#0B1721] border border-[#8BCFDD]/30 dark:border-slate-700 rounded-xl p-4 mb-6">
                        <p class="text-sm text-[#1D5D69] dark:text-slate-200">
                            <strong>Nota:</strong> Los campos "Nombre" y "Apellidos" siempre están visibles y son requeridos.
                        </p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="config-fields">
                        ${fieldsHtml}
                    </div>
                </div>
                <div class="p-4 border-t border-[#E6E6E6] dark:border-slate-700 flex justify-end gap-3 bg-[#F8F7F7] dark:bg-[#0B1721]">
                    <button id="cancelConfig" class="px-5 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-white dark:hover:bg-gray-700 text-[#0F2532] dark:text-gray-200 font-medium transition">
                        Cancelar
                    </button>
                    <button id="saveConfig" class="px-6 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold transition">
                        Guardar Configuración
                    </button>
                </div>
            </div>`;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('#closeConfig').addEventListener('click', closeModal);
        modal.querySelector('#cancelConfig').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        modal.querySelector('#saveConfig').addEventListener('click', () => {
            const newConfig = {};
            masterFields.forEach(f => {
                const show = modal.querySelector(`input[name="show-${f.key}"]`)?.checked || false;
                const required = modal.querySelector(`input[name="req-${f.key}"]`)?.checked || false;
                newConfig[f.key] = { show, required };
            });

            saveFieldConfig(newConfig, (err) => {
                if (err) {
                    showToast('Error al guardar configuración', 'error');
                } else {
                    showToast('Configuración guardada', 'success');
                    closeModal();
                }
            });
        });
    });
}

/* ============================================================================
   CRUD OPERATIONS
============================================================================ */
function savePatient(form) {
    if (!db) {
        showToast('Base de datos no conectada', 'error');
        return;
    }

    const core = {
        nombre: null, apellido: null, telefono: null, email: null, direccion: null, fecha_nacimiento: null,
        nombre_social: null, curp: null, convenio: null, numero_interno: null, sexo: null,
        ciudad: null, delegacion: null, actividad: null, profesion: null, empleador: null,
        observaciones: null, apoderado: null
    };

    masterFields.forEach(f => {
        const el = form[f.key];
        const val = el?.value?.trim() || '';
        core[f.mapTo] = val || null;
    });

    if (!core.nombre || !core.apellido) {
        showToast('Nombre y apellidos son requeridos', 'warning');
        return;
    }

    const sql = `INSERT INTO pacientes(
        nombre, apellido, telefono, email, direccion, fecha_nacimiento,
        nombre_social, curp, convenio, numero_interno, sexo, ciudad,
        delegacion, actividad, profesion, empleador, observaciones, apoderado,
        created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
    
    const params = [
        core.nombre, core.apellido, core.telefono, core.email, core.direccion, core.fecha_nacimiento,
        core.nombre_social, core.curp, core.convenio, core.numero_interno, core.sexo, core.ciudad,
        core.delegacion, core.actividad, core.profesion, core.empleador, core.observaciones, core.apoderado
    ];

    try {
        const onSuccess = async (patientId) => {
            if (patientId && window.api.clinical) {
                const medicalData = extractMedicalFormData(form);
                medicalData.paciente_id = patientId;
                try {
                    await window.api.clinical.saveAntecedentes(medicalData);
                } catch (err) {
                    console.error('Error saving medical history:', err);
                    showToast('Paciente guardado, pero hubo un error en antecedentes médicos', 'warning');
                }
            }

            document.getElementById('new-patient-modal')?.remove();
            showToast('Paciente registrado exitosamente', 'success');
            loadPatients();
        };

        if (db.run.length >= 3) {
            db.run(sql, params, (err, result) => {
                if (err) return showToast('Error: ' + err.message, 'error');
                onSuccess(result?.lastID);
            });
        } else {
            db.run(sql, params).then(result => onSuccess(result?.lastID)).catch(err => showToast('Error: ' + err.message, 'error'));
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

function editPatient(id) {
    const patient = State.patients.find(p => p.id == id);
    if (!patient) return;

    // Similar to showNewPatientModal but pre-filled
    showToast('Función de edición en desarrollo', 'info');
    // TODO: Implement edit modal with pre-filled data
}

function deletePatient(id) {
    const patient = State.patients.find(p => p.id == id);
    if (!patient) return;

    if (!confirm(`¿Eliminar a ${patient.nombre} ${patient.apellido}?\n\nEsta acción no se puede deshacer.`)) return;

    if (!db) {
        State.patients = State.patients.filter(p => p.id != id);
        applyFilters();
        showToast('Paciente eliminado', 'success');
        return;
    }

    const sql = `DELETE FROM pacientes WHERE id = ? `;

    try {
        const onSuccess = () => {
            showToast('Paciente eliminado', 'success');
            loadPatients();
        };

        if (db.run.length >= 3) {
            db.run(sql, [id], (err) => {
                if (err) return showToast('Error: ' + err.message, 'error');
                onSuccess();
            });
        } else {
            db.run(sql, [id]).then(onSuccess).catch(err => showToast('Error: ' + err.message, 'error'));
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

function exportPatients() {
    if (!State.patients.length) {
        showToast('No hay pacientes para exportar', 'warning');
        return;
    }

    const headers = ['ID', 'Nombre', 'Apellidos', 'Email', 'Teléfono', 'Fecha Registro'];
    const rows = State.patients.map(p => [
        p.id,
        p.nombre,
        p.apellido,
        p.email || '',
        p.telefono || '',
        formatDate(p.created_at)
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pacientes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('Archivo CSV descargado', 'success');
}

/* ============================================================================
   IMPORT EXCEL
============================================================================ */
async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
        showToast('Error: Librería Excel no cargada', 'error');
        return;
    }

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);

        if (!rows.length) {
            showToast('El archivo está vacío', 'warning');
            return;
        }

        showToast('Procesando ' + rows.length + ' registros...', 'info');

        let successCount = 0;
        let errorCount = 0;

        // Process sequentially
        for (const row of rows) {
            try {
                // Case-insensitive mapping helper
                const getVal = (keys) => {
                    for (const k of keys) {
                        for (const rowKey in row) {
                            if (rowKey.toLowerCase().trim() === k.toLowerCase()) return row[rowKey];
                        }
                    }
                    return null;
                };

                const nombre = getVal(['nombre', 'nombres', 'name']);
                const apellido = getVal(['apellido', 'apellidos', 'lastname']);
                const telefono = getVal(['telefono', 'tel', 'phone', 'celular', 'movil']);
                const email = getVal(['email', 'correo', 'mail', 'e-mail']);

                if (!nombre || !apellido) {
                    errorCount++;
                    continue;
                }

                const core = {
                    nombre: String(nombre).trim(),
                    apellido: String(apellido).trim(),
                    telefono: telefono ? String(telefono).trim() : null,
                    email: email ? String(email).trim() : null,
                    direccion: getVal(['direccion', 'address', 'domicilio']) || null,
                    fecha_nacimiento: null
                };

                // Store extra fields in meta
                const meta = {};
                // Optional: map other columns to meta if needed

                await new Promise((resolve, reject) => {
                    const sql = `INSERT INTO pacientes(nombre, apellido, telefono, email, direccion, fecha_nacimiento, meta, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
                    const params = [core.nombre, core.apellido, core.telefono, core.email, core.direccion, core.fecha_nacimiento, JSON.stringify(meta)];

                    if (db.run.length >= 3) {
                        db.run(sql, params, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    } else {
                        db.run(sql, params).then(resolve).catch(reject);
                    }
                });

                successCount++;

            } catch (e) {
                console.error('Error importing row', row, e);
                errorCount++;
            }
        }

        if (successCount > 0) {
            showToast(`Importación completada: ${successCount} importados` + (errorCount ? `, ${errorCount} fallidos` : ''), 'success');
            loadPatients();
        } else {
            showToast(`No se importaron pacientes. Verifique los encabezados (Nombre, Apellido).`, 'warning');
        }

        event.target.value = ''; // Reset input

    } catch (e) {
        console.error(e);
        showToast('Error al procesar archivo: ' + e.message, 'error');
        event.target.value = '';
    }
}

/* ============================================================================
   INIT
============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    loadConfig(() => {
        loadPatients();
        setupEventListeners();
    });
});
