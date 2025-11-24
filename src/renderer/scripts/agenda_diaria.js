// agenda_diaria.js - Vista diaria mejorada

export async function initDiaria(container, dateStr) {
    // Cargar plantilla si es necesario
    if (!container.querySelector('#appointmentsRows')) {
        try {
            const resp = await fetch(new URL('../views/Agendas/diaria.html', import.meta.url));
            container.innerHTML = await resp.text();
        } catch (err) {
            container.innerHTML = '<div class="p-8 text-center text-red-500">Error cargando la vista diaria</div>';
            return;
        }
    }

    // Estado
    let currentDate = dateStr ? new Date(dateStr) : new Date();
    let appointments = [];
    let dentists = [];
    let selectedDentist = '';
    let autoReloadInterval = null;

    // Filtros de estado
    const statusFilters = [
        { id: 'pendiente', label: 'Pendiente', color: 'bg-yellow-400', checked: true },
        { id: 'confirmado', label: 'Confirmado', color: 'bg-green-500', checked: true },
        { id: 'en-sala', label: 'En sala de espera', color: 'bg-blue-500', checked: true },
        { id: 'atendido', label: 'Atendido', color: 'bg-purple-500', checked: true },
        { id: 'no-asiste', label: 'No asiste', color: 'bg-red-500', checked: true },
        { id: 'cancelado', label: 'Cancelado', color: 'bg-gray-400', checked: false }
    ];

    // Selectores
    const $ = (sel) => container.querySelector(sel);
    const prevDayBtn = $('#prevDay');
    const nextDayBtn = $('#nextDay');
    const dayNumberEl = $('#dayNumber');
    const monthYearEl = $('#monthYear');
    const dayNameEl = $('#dayName');
    const filtersDiv = $('#filtersDiv');
    const markAllBtn = $('#markAllBtn');
    const appointmentsRows = $('#appointmentsRows');
    const dentistSelect = $('#dentistSelect');
    const createAptBtn = $('#createAptBtn');
    const autoReloadCheckbox = $('#autoReloadCheckbox');

    // Helpers
    const toSQLDate = (d) => d.toISOString().slice(0, 10);
    const formatTime = (date) => date.toTimeString().slice(0, 5);

    // Renderizar fecha
    function renderDate() {
        dayNumberEl.textContent = String(currentDate.getDate()).padStart(2, '0');
        monthYearEl.textContent = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        dayNameEl.textContent = currentDate.toLocaleString('es-ES', { weekday: 'long' }).replace(/^./, s => s.toUpperCase());
    }

    // Renderizar filtros
    function renderFilters() {
        filtersDiv.innerHTML = statusFilters.map(f => `
            <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F8F7F7] cursor-pointer transition group">
                <input type="checkbox" ${f.checked ? 'checked' : ''} data-filter="${f.id}"
                    class="w-4 h-4 rounded border-[#D9D9D9] text-[#4EABBE] focus:ring-[#4EABBE]"/>
                <span class="w-3 h-3 rounded-full ${f.color}"></span>
                <span class="text-sm text-[#0F2532] group-hover:text-[#1D5D69]">${f.label}</span>
            </label>
        `).join('');

        filtersDiv.querySelectorAll('input').forEach(cb => {
            cb.addEventListener('change', () => {
                const filter = statusFilters.find(f => f.id === cb.dataset.filter);
                if (filter) filter.checked = cb.checked;
                renderAppointments();
            });
        });
    }

    // Cargar dentistas
    async function loadDentists() {
        try {
            dentists = await window.api.db.all('SELECT id, nombre, apellido FROM usuarios WHERE rol = "dentista" ORDER BY nombre');
            dentistSelect.innerHTML = '<option value="">Todos los dentistas</option>' +
                dentists.map(d => `<option value="${d.id}">Dr(a). ${d.nombre} ${d.apellido}</option>`).join('');
        } catch (err) {
            console.error('Error cargando dentistas:', err);
        }
    }

    // Cargar citas
    async function loadAppointments() {
        const dateSQL = toSQLDate(currentDate);
        const sql = `
            SELECT c.id, c.paciente_id, c.fecha_hora, c.motivo, c.estado,
                   p.nombre, p.apellido, p.telefono, p.email
            FROM citas c
            JOIN pacientes p ON p.id = c.paciente_id
            WHERE date(c.fecha_hora) = ?
            ORDER BY c.fecha_hora
        `;

        try {
            appointments = await window.api.db.all(sql, [dateSQL]);
            updateStats();
            renderAppointments();
        } catch (err) {
            console.error('Error cargando citas:', err);
            appointmentsRows.innerHTML = `
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <svg class="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <p class="text-[#0F2532]/60">Error al cargar citas</p>
                    </div>
                </div>
            `;
        }
    }

    // Actualizar estadísticas
    function updateStats() {
        const total = appointments.length;
        const confirmadas = appointments.filter(a => a.estado === 'confirmado').length;
        const pendientes = appointments.filter(a => a.estado === 'pendiente' || !a.estado).length;

        $('#statTotalCitas').textContent = total;
        $('#statConfirmadas').textContent = confirmadas;
        $('#statPendientes').textContent = pendientes;
    }

    // Renderizar citas
    function renderAppointments() {
        const activeFilters = statusFilters.filter(f => f.checked).map(f => f.id);
        let filtered = appointments.filter(a => {
            const status = a.estado || 'pendiente';
            return activeFilters.includes(status);
        });

        if (selectedDentist) {
            filtered = filtered.filter(a => a.dentista_id == selectedDentist);
        }

        if (!filtered.length) {
            appointmentsRows.innerHTML = `
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <svg class="w-20 h-20 text-[#D9D9D9] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <p class="text-lg font-medium text-[#0F2532]/70">No hay citas para este día</p>
                        <p class="text-sm text-[#0F2532]/50 mt-1">Haz clic en "Nueva Cita" para agregar una</p>
                    </div>
                </div>
            `;
            return;
        }

        appointmentsRows.innerHTML = filtered.map((apt, i) => {
            const fecha = new Date(apt.fecha_hora);
            const time = formatTime(fecha);
            const name = `${apt.nombre} ${apt.apellido}`;
            const dentista = 'Sin asignar'; // Ya que no tenemos dentista_id
            const status = apt.estado || 'pendiente';
            const statusClass = `status-${status}`;

            return `
                <div class="appointment-row grid grid-cols-[100px_1fr_180px_200px_150px] gap-4 px-6 py-4 bg-white border-b border-[#E6E6E6] items-center cursor-pointer" 
                     data-id="${apt.id}" style="animation: slideIn 0.3s ease ${i * 0.05}s both">
                    <!-- Hora -->
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${getStatusDotColor(status)}"></div>
                        <span class="font-semibold text-[#0F2532]">${time}</span>
                    </div>
                    
                    <!-- Paciente -->
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-[#4EABBE] to-[#1D5D69] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            ${name.split(' ').map(n => n[0]).slice(0,2).join('')}
                        </div>
                        <div>
                            <p class="font-semibold text-[#1D5D69] hover:underline" data-paciente-id="${apt.paciente_id}">${name}</p>
                            <p class="text-xs text-[#0F2532]/50">${apt.telefono || apt.email || 'Sin contacto'}</p>
                        </div>
                    </div>
                    
                    <!-- Dentista -->
                    <div class="text-sm text-[#0F2532]">${dentista}</div>
                    
                    <!-- Estado -->
                    <div>
                        <select class="status-select text-xs px-3 py-1.5 rounded-full border-0 font-semibold ${statusClass}" data-apt-id="${apt.id}">
                            <option value="pendiente" ${status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="confirmado" ${status === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                            <option value="en-sala" ${status === 'en-sala' ? 'selected' : ''}>En sala</option>
                            <option value="atendido" ${status === 'atendido' ? 'selected' : ''}>Atendido</option>
                            <option value="no-asiste" ${status === 'no-asiste' ? 'selected' : ''}>No asiste</option>
                            <option value="cancelado" ${status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </div>
                    
                    <!-- Acciones -->
                    <div class="flex items-center justify-center gap-2">
                        <button class="action-view p-2 hover:bg-[#8BCFDD]/20 rounded-lg transition" title="Ver detalles">
                            <svg class="w-5 h-5 text-[#4EABBE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                        <button class="action-edit p-2 hover:bg-yellow-100 rounded-lg transition" title="Editar">
                            <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button class="action-delete p-2 hover:bg-red-100 rounded-lg transition" title="Cancelar">
                            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners
        appointmentsRows.querySelectorAll('.appointment-row').forEach(row => {
            const id = row.dataset.id;
            
            row.querySelector('[data-paciente-id]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = `ficha_clinica.html?id=${e.target.dataset.pacienteId}`;
            });

            row.querySelector('.status-select')?.addEventListener('change', async (e) => {
                e.stopPropagation();
                await updateAppointmentStatus(id, e.target.value);
            });

            row.querySelector('.action-view')?.addEventListener('click', (e) => {
                e.stopPropagation();
                showAppointmentDetails(id);
            });

            row.querySelector('.action-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                cancelAppointment(id);
            });
        });
    }

    function getStatusDotColor(status) {
        const colors = {
            pendiente: 'bg-yellow-400',
            confirmado: 'bg-green-500',
            'en-sala': 'bg-blue-500',
            atendido: 'bg-purple-500',
            'no-asiste': 'bg-red-500',
            cancelado: 'bg-gray-400'
        };
        return colors[status] || 'bg-gray-400';
    }

    // Actualizar estado de cita
    async function updateAppointmentStatus(id, newStatus) {
        try {
            await window.api.db.run('UPDATE citas SET estado = ? WHERE id = ?', [newStatus, id]);
            await loadAppointments();
        } catch (err) {
            alert('Error actualizando estado: ' + err.message);
        }
    }

    // Cancelar cita
    async function cancelAppointment(id) {
        if (!confirm('¿Cancelar esta cita?')) return;
        await updateAppointmentStatus(id, 'cancelado');
    }

    // Modal crear cita
    async function openCreateModal() {
        let patients = [];
        try {
            patients = await window.api.db.all('SELECT id, nombre, apellido FROM pacientes ORDER BY nombre');
        } catch (err) {
            return alert('Error cargando pacientes');
        }

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Nueva Cita</h3>
                    <p class="text-white/70 text-sm mt-1">${currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <form id="createAptForm" class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] mb-2">Paciente</label>
                        <select id="aptPatient" required class="w-full px-4 py-2.5 border border-[#D9D9D9] rounded-xl focus:ring-2 focus:ring-[#4EABBE]">
                            <option value="">Seleccionar paciente...</option>
                            ${patients.map(p => `<option value="${p.id}">${p.nombre} ${p.apellido}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] mb-2">Fecha</label>
                            <input type="date" id="aptDate" value="${toSQLDate(currentDate)}" required class="w-full px-4 py-2.5 border border-[#D9D9D9] rounded-xl"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] mb-2">Hora</label>
                            <input type="time" id="aptTime" value="09:00" required class="w-full px-4 py-2.5 border border-[#D9D9D9] rounded-xl"/>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] mb-2">Dentista</label>
                        <p class="text-sm text-[#0F2532]/60 italic">Campo no disponible en esta versión</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] mb-2">Motivo</label>
                        <input type="text" id="aptReason" placeholder="Consulta general, limpieza..." class="w-full px-4 py-2.5 border border-[#D9D9D9] rounded-xl"/>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" id="cancelModal" class="flex-1 py-2.5 border border-[#D9D9D9] rounded-xl hover:bg-[#F8F7F7] font-medium">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold">Crear Cita</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#cancelModal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#createAptForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pacienteId = overlay.querySelector('#aptPatient').value;
            const fecha = overlay.querySelector('#aptDate').value;
            const hora = overlay.querySelector('#aptTime').value;
            const motivo = overlay.querySelector('#aptReason').value;

            if (!pacienteId || !fecha || !hora) return alert('Completa los campos requeridos');

            try {
                await window.api.db.run(
                    'INSERT INTO citas (paciente_id, fecha_hora, motivo, estado) VALUES (?, ?, ?, ?)',
                    [pacienteId, `${fecha} ${hora}:00`, motivo, 'pendiente']
                );
                overlay.remove();
                if (fecha === toSQLDate(currentDate)) loadAppointments();
                alert('Cita creada correctamente');
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
    }

    // Event listeners
    prevDayBtn?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 1); renderDate(); loadAppointments(); });
    nextDayBtn?.addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 1); renderDate(); loadAppointments(); });
    markAllBtn?.addEventListener('click', () => { filtersDiv.querySelectorAll('input').forEach(cb => cb.checked = true); statusFilters.forEach(f => f.checked = true); renderAppointments(); });
    createAptBtn?.addEventListener('click', openCreateModal);
    dentistSelect?.addEventListener('change', (e) => { selectedDentist = e.target.value; renderAppointments(); });
    
    autoReloadCheckbox?.addEventListener('change', (e) => {
        if (e.target.checked) {
            autoReloadInterval = setInterval(loadAppointments, 60000);
        } else {
            clearInterval(autoReloadInterval);
        }
    });

    // Inicializar
    renderFilters();
    renderDate();
    await loadDentists();
    await loadAppointments();
}