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
        monthYearEl.textContent = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, s => s.toUpperCase());
        dayNameEl.textContent = currentDate.toLocaleString('es-ES', { weekday: 'long' }).replace(/^./, s => s.toUpperCase());
    }

    // Cargar dentistas
    async function loadDentists() {
        if (!dentistSelect) return;
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
        try {
            let sql = `
                SELECT c.id, c.paciente_id, c.fecha_hora, c.motivo, c.estado,
                       p.nombre, p.apellido, p.telefono
                FROM citas c
                JOIN pacientes p ON p.id = c.paciente_id
                WHERE date(c.fecha_hora) = ?
                ORDER BY c.fecha_hora
            `;
            const params = [dateSQL];

            if (selectedDentist) {
                // Si hubiera campo dentista_id en citas, filtraríamos aquí
                // sql += ' AND c.dentista_id = ?';
                // params.push(selectedDentist);
            }

            appointments = await window.api.db.all(sql, params);
            renderAppointments();
        } catch (err) {
            console.error('Error cargando citas:', err);
            appointmentsRows.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error cargando citas</td></tr>`;
        }
    }

    // Renderizar filtros
    function renderFilters() {
        if (!filtersDiv) return;
        filtersDiv.innerHTML = statusFilters.map(f => `
            <label class="flex items-center gap-2 cursor-pointer group">
                <div class="relative flex items-center">
                    <input type="checkbox" class="peer sr-only" value="${f.id}" ${f.checked ? 'checked' : ''}>
                    <div class="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 peer-checked:bg-[#4EABBE] peer-checked:border-[#4EABBE] transition-all"></div>
                    <svg class="absolute w-3 h-3 text-white left-1 top-1 opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                </div>
                <span class="text-sm text-[#0F2532]/70 dark:text-gray-300 group-hover:text-[#0F2532] dark:group-hover:text-white transition-colors">${f.label}</span>
            </label>
        `).join('');

        filtersDiv.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const filter = statusFilters.find(f => f.id === e.target.value);
                if (filter) filter.checked = e.target.checked;
                renderAppointments();
            });
        });
    }

    // Renderizar citas
    function renderAppointments() {
        if (!appointmentsRows) return;

        const filtered = appointments.filter(apt => {
            const filter = statusFilters.find(f => f.id === (apt.estado || 'pendiente'));
            return filter ? filter.checked : true;
        });

        if (filtered.length === 0) {
            appointmentsRows.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center">
                        <div class="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            <p class="text-lg font-medium">No hay citas para este día</p>
                            <p class="text-sm mt-1">Intenta cambiar los filtros o selecciona otra fecha</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        appointmentsRows.innerHTML = filtered.map(apt => {
            const time = formatTime(new Date(apt.fecha_hora));
            const statusColors = {
                'pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                'confirmado': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                'en-sala': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                'atendido': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                'no-asiste': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                'cancelado': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
            };
            const statusClass = statusColors[apt.estado] || statusColors['pendiente'];

            return `
                <tr class="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td class="py-4 px-4">
                        <span class="font-mono font-medium text-[#1D5D69] dark:text-[#4EABBE]">${time}</span>
                    </td>
                    <td class="py-4 px-4">
                        <div class="font-medium text-[#0F2532] dark:text-white">${apt.nombre} ${apt.apellido}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${apt.telefono || 'Sin teléfono'}</div>
                    </td>
                    <td class="py-4 px-4 text-gray-600 dark:text-gray-300 text-sm max-w-xs truncate" title="${apt.motivo || ''}">
                        ${apt.motivo || 'Consulta general'}
                    </td>
                    <td class="py-4 px-4">
                        <div class="text-sm text-gray-600 dark:text-gray-400">Dr. General</div>
                    </td>
                    <td class="py-4 px-4">
                        <select class="status-select text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none transition-colors ${statusClass}"
                                data-id="${apt.id}" onchange="updateStatus(${apt.id}, this.value)">
                            <option value="pendiente" ${apt.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="confirmado" ${apt.estado === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                            <option value="en-sala" ${apt.estado === 'en-sala' ? 'selected' : ''}>En Sala</option>
                            <option value="atendido" ${apt.estado === 'atendido' ? 'selected' : ''}>Atendido</option>
                            <option value="no-asiste" ${apt.estado === 'no-asiste' ? 'selected' : ''}>No Asiste</option>
                            <option value="cancelado" ${apt.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </td>
                    <td class="py-4 px-4">
                        <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.location.href='ficha_clinica.html?id=${apt.paciente_id}'" 
                                    class="p-1.5 text-gray-400 hover:text-[#4EABBE] hover:bg-[#8BCFDD]/10 dark:hover:bg-[#8BCFDD]/10 rounded-lg transition-colors" title="Ver Paciente">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                            <button onclick="editAppointment(${apt.id})" 
                                    class="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors" title="Editar">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onclick="deleteAppointment(${apt.id})" 
                                    class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Eliminar">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Actualizar estado (global para onclick)
    window.updateStatus = async (id, status) => {
        try {
            await window.api.db.run('UPDATE citas SET estado = ? WHERE id = ?', [status, id]);
            loadAppointments(); // Recargar para actualizar colores/filtros
        } catch (err) {
            console.error('Error actualizando estado:', err);
            alert('Error al actualizar estado');
        }
    };

    window.deleteAppointment = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta cita?')) return;
        try {
            await window.api.db.run('DELETE FROM citas WHERE id = ?', [id]);
            loadAppointments();
        } catch (err) {
            alert('Error al eliminar cita');
        }
    };

    // Modal para crear cita
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
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-100 dark:border-gray-700" style="animation: slideUp 0.3s ease">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Nueva Cita</h3>
                    <p class="text-white/70 text-sm mt-1">Agendar para el día seleccionado</p>
                </div>
                <form id="createAptForm" class="p-8 space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Paciente *</label>
                        <select id="aptPatient" required class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            <option value="">Seleccionar...</option>
                            ${patients.map(p => `<option value="${p.id}">${p.nombre} ${p.apellido}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Fecha *</label>
                            <input type="date" id="aptDate" required value="${toSQLDate(currentDate)}" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Hora *</label>
                            <input type="time" id="aptTime" required class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Motivo</label>
                        <input type="text" id="aptReason" placeholder="Consulta, limpieza..." class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Notas u observaciones</label>
                        <textarea id="aptNotes" rows="2" placeholder="Información adicional..." class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all resize-none"></textarea>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" id="cancelModal" class="flex-1 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 text-[#0F2532] dark:text-white font-medium transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Crear</button>
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

            try {
                await window.api.db.run(
                    'INSERT INTO citas (paciente_id, fecha_hora, motivo, estado) VALUES (?, ?, ?, ?)',
                    [pacienteId, `${fecha} ${hora}:00`, motivo, 'pendiente']
                );
                overlay.remove();
                if (fecha === toSQLDate(currentDate)) loadAppointments();
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