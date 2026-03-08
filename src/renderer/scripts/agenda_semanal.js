// agenda_semanal.js - Vista semanal mejorada

export async function initSemanal(container, referenceDate) {
    // Inyectar estilos de animaciÃ³n
    if (!document.getElementById('semanal-animations')) {
        const style = document.createElement('style');
        style.id = 'semanal-animations';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(-10px); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // La plantilla HTML ya fue cargada por agenda.js
    // Solo esperamos a que el DOM estÃ© listo
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Estado
    let refDate = referenceDate ? new Date(referenceDate) : new Date();
    let appointments = [];
    let dentists = [];
    let selectedDentist = '';
    let selectedChair = '1';

    const safeParseJSON = (value, fallback = {}) => {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (err) {
            console.warn('[agenda_semanal] JSON invÃ¡lido en app_settings:', err);
            return fallback;
        }
    };

    // Selectores con validaciÃ³n
    const $ = (sel) => container.querySelector(sel);
    const prevWeekBtn = $('#prevWeek');
    const nextWeekBtn = $('#nextWeek');
    const todayBtn = $('#todayBtn');
    const gridContainer = $('#gridContainer');
    const currentMonthYear = $('#currentMonthYear');
    const dentistSelect = $('#dentistSelectWeekly');
    const lunchStartInput = $('#lunchStartInputWeekly');
    const lunchEndInput = $('#lunchEndInputWeekly');

    // Verificar que existen los elementos necesarios
    if (!gridContainer) {
        console.error('Elementos necesarios no encontrados:', {
            gridContainer: !!gridContainer,
            container: container.innerHTML.substring(0, 200)
        });
        container.innerHTML = '<div class="p-8 text-center text-red-500">Error: Elementos del DOM no encontrados. Verifica que la plantilla semanal.html estÃ© disponible.</div>';
        return;
    }

    // Helpers
    const toSQLDate = (d) => d.toISOString().slice(0, 10);
    const formatTime = (d) => d.toTimeString().slice(0, 5);
    const formatDisplayTimeFromString = (timeStr, timeFormat) => {
        const [h, m] = (timeStr || '00:00').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;
        if (timeFormat === '12h') {
            const period = h >= 12 ? 'PM' : 'AM';
            const hour12 = h % 12 || 12;
            return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
        }
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const timeToMinutes = (value) => {
        if (!value) return null;
        const [hours, minutes] = String(value).split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
        return (hours * 60) + minutes;
    };
    const minutesToTime = (totalMinutes) => {
        if (!Number.isFinite(totalMinutes)) return '00:00';
        const clamped = Math.max(0, Math.min(1439, totalMinutes));
        const h = Math.floor(clamped / 60);
        const m = clamped % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    function startOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const startDayRaw = parseInt(config.firstDayWeek ?? 1, 10);
        const startDay = Number.isFinite(startDayRaw) ? startDayRaw : 1;
        const diff = (day - startDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function isToday(dateStr) {
        return dateStr === toSQLDate(new Date());
    }

    // Cargar configuraciÃ³n del localStorage
    function loadConfig() {
        const savedSettings = safeParseJSON(localStorage.getItem('app_settings'), {});
        let workDays = [1, 2, 3, 4, 5]; // Default: Lunes a Viernes

        if (savedSettings && Array.isArray(savedSettings.workDays)) {
            workDays = savedSettings.workDays.map((d) => parseInt(d, 10)).filter(Number.isFinite);
        }

        return {
            workStart: parseInt(localStorage.getItem('work-start')?.split(':')[0] || '8'),
            workEnd: parseInt(localStorage.getItem('work-end')?.split(':')[0] || '18'),
            defaultDuration: parseInt(localStorage.getItem('default-duration') || '30'),
            appointmentInterval: parseInt(localStorage.getItem('appointment-interval') || '10'),
            lunchStart: localStorage.getItem('lunch-start') || savedSettings.lunchStart || '14:00',
            lunchEnd: localStorage.getItem('lunch-end') || savedSettings.lunchEnd || '15:00',
            timeFormat: localStorage.getItem('time-format') || savedSettings.timeFormat || '24h',
            workDays: workDays,
            firstDayWeek: savedSettings.firstDayWeek ?? '1',
            autoConfirm: savedSettings.autoConfirm ?? false
        };
    }

    let config = loadConfig();

    const getLunchRangeMinutes = () => {
        const start = timeToMinutes(config.lunchStart);
        const end = timeToMinutes(config.lunchEnd);
        if (start === null || end === null) return null;
        if (end <= start) return null;
        return { start, end };
    };

    const isLunchSlot = (timeStr) => {
        const lunch = getLunchRangeMinutes();
        if (!lunch) return false;
        const start = timeToMinutes(timeStr);
        if (start === null) return false;
        const slotEnd = start + (Number(config.appointmentInterval) || 30);
        return start < lunch.end && slotEnd > lunch.start;
    };

    function syncLunchInputs() {
        if (lunchStartInput) lunchStartInput.value = config.lunchStart || '14:00';
        if (lunchEndInput) lunchEndInput.value = config.lunchEnd || '15:00';
    }

    function saveLunchConfig() {
        const startValue = lunchStartInput?.value || '14:00';
        const endValue = lunchEndInput?.value || '15:00';
        const startMinutes = timeToMinutes(startValue);
        const endMinutes = timeToMinutes(endValue);

        if (startMinutes === null || endMinutes === null) {
            alert('Define correctamente la hora de comida');
            syncLunchInputs();
            return;
        }
        if (endMinutes <= startMinutes) {
            alert('La hora fin de comida debe ser mayor a la hora inicio');
            syncLunchInputs();
            return;
        }

        localStorage.setItem('lunch-start', startValue);
        localStorage.setItem('lunch-end', endValue);
        window.dispatchEvent(new Event('configurationChanged'));
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

    // Generar slots de tiempo basados en configuraciÃ³n
    function generateTimeSlots() {
        const slots = [];
        const startHour = config.workStart;
        const endHour = config.workEnd;
        let interval = config.appointmentInterval;

        // Validar intervalo para evitar loops infinitos
        if (!interval || interval <= 0 || interval > 60) {
            interval = 30; // Default a 30 minutos si es invÃ¡lido
        }

        for (let hour = startHour; hour <= endHour; hour++) {
            for (let minute = 0; minute < 60; minute += interval) {
                if (hour === endHour && minute > 0) break;
                slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            }
        }
        return slots;
    }

    // Renderizar semana
    async function renderWeek() {
        const weekStart = startOfWeek(refDate);
        const days = [];
        const locale = 'es-ES';

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dayOfWeek = d.getDay();
            const isWorkDay = config.workDays.includes(dayOfWeek);

            days.push({
                name: d.toLocaleString(locale, { weekday: 'short' }).replace(/^./, s => s.toUpperCase()),
                fullName: d.toLocaleString(locale, { weekday: 'long' }).replace(/^./, s => s.toUpperCase()),
                day: d.getDate(),
                date: toSQLDate(d),
                isToday: isToday(toSQLDate(d)),
                isWeekend: !isWorkDay,
                dayOfWeek: dayOfWeek
            });
        }

        // Actualizar mes/aÃ±o
        if (currentMonthYear) {
            const monthYear = weekStart.toLocaleString(locale, { month: 'long', year: 'numeric' });
            currentMonthYear.textContent = monthYear.replace(/^./, s => s.toUpperCase());
        }

        // Cargar citas de la semana
        const startSQL = days[0].date;
        const endSQL = days[6].date;

        try {
            let sql = `
                SELECT c.id, c.paciente_id, c.fecha_hora, c.motivo, c.estado, c.dentista_id, c.monto, c.especialista_id,
                       p.nombre, p.apellido,
                       u.nombre as dentista_nombre, u.apellido as dentista_apellido,
                       e.nombre as especialista_nombre, e.especialidad as especialista_especialidad
                FROM citas c
                JOIN pacientes p ON p.id = c.paciente_id
                LEFT JOIN usuarios u ON u.id = c.dentista_id
                LEFT JOIN especialistas e ON e.id = c.especialista_id
                WHERE date(c.fecha_hora) BETWEEN ? AND ?
                ORDER BY c.fecha_hora
            `;
            const params = [startSQL, endSQL];

            appointments = await window.api.db.all(sql, params);
        } catch (err) {
            console.error('Error cargando citas:', err);
            appointments = [];
        }

        // Contar citas por dÃ­a
        const appointmentsByDay = {};
        appointments.forEach(apt => {
            const date = toSQLDate(new Date(apt.fecha_hora));
            appointmentsByDay[date] = (appointmentsByDay[date] || 0) + 1;
        });

        // Renderizar grilla
        renderGrid(days);
    }

    // Renderizar grilla de horarios
    function renderGrid(days) {
        const timeSlots = generateTimeSlots();

        // Mapear citas por fecha y hora
        const appointmentsMap = {};
        appointments.forEach(apt => {
            const d = new Date(apt.fecha_hora);
            const dateKey = toSQLDate(d);
            const timeKey = formatTime(d);
            appointmentsMap[`${dateKey}|${timeKey}`] = apt;
        });

        // Crear grilla
        const grid = document.createElement('div');
        grid.className = 'grid';
        grid.style.gridTemplateColumns = '80px repeat(7, minmax(140px, 1fr))';

        // Header de dÃ­as (vacÃ­o + 7 dÃ­as)
        const headerEmpty = document.createElement('div');
        headerEmpty.className = 'bg-[#F8F7F7] dark:bg-gray-900 border-r border-b border-[#E6E6E6] dark:border-gray-700 sticky top-0 left-0 z-30 transition-colors';
        grid.appendChild(headerEmpty);

        days.forEach(d => {
            const dayHeader = document.createElement('div');
            dayHeader.className = `bg-[#F8F7F7] dark:bg-gray-900 border-r border-b border-[#E6E6E6] dark:border-gray-700 p-3 text-center sticky top-0 z-20 transition-colors ${d.isToday ? 'bg-[#8BCFDD]/20 dark:bg-[#8BCFDD]/10' : ''} ${d.isWeekend ? 'bg-gray-100 dark:bg-gray-800' : ''}`;
            dayHeader.innerHTML = `
                <div class="text-xs font-medium text-[#0F2532]/60 dark:text-gray-400 uppercase">${d.name}</div>
                <div class="text-lg font-bold text-[#1D5D69] dark:text-[#4EABBE] ${d.isToday ? 'w-8 h-8 bg-[#4EABBE] text-white rounded-full flex items-center justify-center mx-auto' : ''}">${d.day}</div>
            `;
            grid.appendChild(dayHeader);
        });

        // Filas de tiempo
        timeSlots.forEach(time => {
            const lunchTimeSlot = isLunchSlot(time);
            // Celda de hora
            const timeCell = document.createElement('div');
            timeCell.className = `time-cell border-r border-b border-[#E5E7EB] dark:border-gray-700 text-gray-500 dark:text-gray-400 transition-colors ${lunchTimeSlot ? 'bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold' : 'bg-[#F9FAFB] dark:bg-gray-900'}`;
            timeCell.textContent = formatDisplayTimeFromString(time, config.timeFormat);
            grid.appendChild(timeCell);

            // Celdas por dÃ­a
            days.forEach(day => {
                const cell = document.createElement('div');
                cell.className = `grid-cell border-r border-b border-[#F3F4F6] dark:border-gray-700 transition-colors ${day.isWeekend ? 'bg-gray-50 dark:bg-gray-800/50' : ''} ${day.isToday ? 'bg-[#8BCFDD]/5 dark:bg-[#8BCFDD]/5' : ''} ${lunchTimeSlot ? 'bg-amber-50 dark:bg-amber-900/15' : ''}`;
                cell.dataset.date = day.date;
                cell.dataset.time = time;
                cell.dataset.isWeekend = day.isWeekend ? '1' : '0';
                cell.dataset.isLunch = lunchTimeSlot ? '1' : '0';

                const key = `${day.date}|${time}`;
                const apt = appointmentsMap[key];

                if (apt) {
                    cell.classList.add('has-appointment');
                    const status = apt.estado || 'pendiente';
                    cell.innerHTML = `
                        <div class="appointment-block status-${status} shadow-sm hover:shadow-md transition-all" data-apt-id="${apt.id}">
                            <div class="font-medium text-white truncate">${apt.nombre} ${apt.apellido}</div>
                            <div class="text-white/80 text-xs truncate">${apt.motivo || 'Sin motivo'}</div>
                        </div>
                    `;
                } else if (!day.isWeekend && lunchTimeSlot) {
                    cell.innerHTML = `
                        <div class="h-full flex items-center justify-center text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            Comida
                        </div>
                    `;
                } else if (!day.isWeekend) {
                    // Solo mostrar botÃ³n de agregar si es dÃ­a laboral
                    cell.innerHTML = `
                        <div class="add-appointment-btn">
                            <button title="Agregar cita" class="hover:scale-110 transition-transform">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                </svg>
                            </button>
                        </div>
                    `;
                }

                grid.appendChild(cell);
            });
        });

        gridContainer.innerHTML = '';
        gridContainer.appendChild(grid);

        // Event listeners para celdas
        grid.querySelectorAll('.grid-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const apt = cell.querySelector('.appointment-block');
                if (apt) {
                    showAppointmentDetails(apt.dataset.aptId);
                } else if (cell.dataset.isWeekend !== '1') {
                    if (cell.dataset.isLunch === '1') {
                        const lunch = getLunchRangeMinutes();
                        if (lunch) {
                            alert(`Horario bloqueado por comida (${minutesToTime(lunch.start)} - ${minutesToTime(lunch.end)})`);
                        } else {
                            alert('Horario bloqueado por comida');
                        }
                        return;
                    }
                    openCreateModal(cell.dataset.date, cell.dataset.time);
                }
            });
        });

        // Click en citas existentes
        grid.querySelectorAll('.appointment-block').forEach(block => {
            block.addEventListener('click', (e) => {
                e.stopPropagation();
                showAppointmentDetails(block.dataset.aptId);
            });
        });
    }

    // Modal para crear cita
    async function openCreateModal(dateStr, timeStr) {
        if (isLunchSlot(timeStr)) {
            const lunch = getLunchRangeMinutes();
            if (lunch) {
                alert(`Horario bloqueado por comida (${minutesToTime(lunch.start)} - ${minutesToTime(lunch.end)})`);
            } else {
                alert('Horario bloqueado por comida');
            }
            return;
        }

        let patients = [];
        let especialistas = [];
        try {
            patients = await window.api.db.all('SELECT id, nombre, apellido FROM pacientes ORDER BY nombre');
            especialistas = await window.api.db.all('SELECT id, nombre, especialidad FROM especialistas WHERE activo = 1 ORDER BY nombre');
        } catch (err) {
            return alert('Error cargando datos');
        }

        const displayTime = formatDisplayTimeFromString(timeStr, config.timeFormat);

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700" style="animation: slideUp 0.3s ease">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Nueva Cita</h3>
                    <p class="text-white/70 text-sm mt-1">${dateStr} a las ${displayTime}</p>
                </div>
                <form id="createAptFormWeekly" class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Paciente *</label>
                        <select id="aptPatientW" required class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            <option value="">Seleccionar...</option>
                            ${patients.map(p => `<option value="${p.id}">${p.nombre} ${p.apellido}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Especialista</label>
                        <select id="aptEspecialistaW" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            <option value="">Sin asignar</option>
                            ${especialistas.map(e => `<option value="${e.id}">${e.nombre} - ${e.especialidad}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Motivo</label>
                        <input type="text" id="aptReasonW" placeholder="Consulta, limpieza..." class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" id="cancelModalW" class="flex-1 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 text-[#0F2532] dark:text-white font-medium transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Crear</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#cancelModalW').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#createAptFormWeekly').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pacienteId = overlay.querySelector('#aptPatientW').value;
            const especialistaId = overlay.querySelector('#aptEspecialistaW').value || null;
            const motivo = overlay.querySelector('#aptReasonW').value;

            if (!pacienteId) return alert('Selecciona un paciente');

            try {
                const estado = config.autoConfirm ? 'confirmado' : 'pendiente';
                await window.api.db.run(
                    'INSERT INTO citas (paciente_id, especialista_id, fecha_hora, motivo, estado, monto) VALUES (?, ?, ?, ?, ?, ?)',
                    [pacienteId, especialistaId, `${dateStr} ${timeStr}:00`, motivo, estado, 0]
                );

                // Enviar notificaciÃ³n por email
                try {
                    // Obtener datos del paciente
                    const patient = await window.api.db.get(
                        'SELECT nombre, apellido, email FROM pacientes WHERE id = ?',
                        [pacienteId]
                    );

                    // Solo enviar si el paciente tiene email
                    if (patient && patient.email) {
                        // Obtener nombre del especialista si estÃ¡ asignado
                        let specialistName = null;
                        if (especialistaId) {
                            const specialist = await window.api.db.get(
                                'SELECT nombre, especialidad FROM especialistas WHERE id = ?',
                                [especialistaId]
                            );
                            if (specialist) {
                                specialistName = `${specialist.nombre} - ${specialist.especialidad}`.trim();
                            }
                        }

                        // Enviar notificaciÃ³n
                        const notificationResult = await window.api.sendAppointmentNotification({
                            patientEmail: patient.email,
                            patientName: `${patient.nombre} ${patient.apellido}`.trim(),
                            appointmentDate: dateStr,
                            appointmentTime: timeStr,
                            reason: motivo || null,
                            dentistName: specialistName,
                            duration: config.defaultDuration || 30
                        });

                        if (notificationResult.success) {
                            console.log('âœ“ NotificaciÃ³n enviada a', patient.email);
                        }
                    }
                } catch (notifError) {
                    // No bloquear si falla el envÃ­o de notificaciÃ³n
                    console.warn('No se pudo enviar notificaciÃ³n:', notifError);
                }

                overlay.remove();
                await renderWeek();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
    }

    // Ver detalles de cita
    function showAppointmentDetails(aptId) {
        const apt = appointments.find(a => a.id == aptId);
        if (!apt) return;
        const locale = 'es-ES';

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">${apt.nombre} ${apt.apellido}</h3>
                    <p class="text-white/70 text-sm mt-1">${new Date(apt.fecha_hora).toLocaleString(locale, { hour12: config.timeFormat === '12h' })}</p>
                </div>
                <div class="p-6 space-y-4">
                    <div class="flex justify-between">
                        <span class="text-[#0F2532]/60 dark:text-gray-400">Estado</span>
                        <span class="font-medium capitalize text-[#0F2532] dark:text-white">${apt.estado || 'Pendiente'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-[#0F2532]/60 dark:text-gray-400">Motivo</span>
                        <span class="font-medium text-[#0F2532] dark:text-white">${apt.motivo || 'Sin especificar'}</span>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button onclick="this.closest('.fixed').remove()" class="flex-1 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 text-[#0F2532] dark:text-white font-medium transition-colors">Cerrar</button>
                        <button onclick="window.location.href='ficha_clinica.html?id=${apt.paciente_id}'" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Ver Paciente</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    // Tabs de sillones
    container.querySelectorAll('.chair-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.chair-tab').forEach(t => {
                t.classList.remove('bg-[#4EABBE]', 'text-white', 'shadow-sm');
                t.classList.add('text-[#0F2532]/70', 'hover:bg-[#F8F7F7]');
            });
            tab.classList.add('bg-[#4EABBE]', 'text-white', 'shadow-sm');
            tab.classList.remove('text-[#0F2532]/70', 'hover:bg-[#F8F7F7]');
            selectedChair = tab.dataset.chair;
            // Recargar si filtras por sillÃ³n
        });
    });

    // Escuchar cambios en la configuraciÃ³n (mismo window)
    window.addEventListener('configurationChanged', (e) => {
        console.log('ConfiguraciÃ³n actualizada (mismo window), recargando vista semanal...');
        config = loadConfig();
        syncLunchInputs();
        renderWeek();
    });

    // Escuchar cambios en la configuraciÃ³n (otras pestaÃ±as)
    window.addEventListener('storage', (e) => {
        if (e.key === 'work-start' || e.key === 'work-end' || e.key === 'default-duration' || e.key === 'appointment-interval' || e.key === 'time-format' || e.key === 'app_settings' || e.key === 'lunch-start' || e.key === 'lunch-end') {
            console.log('ConfiguraciÃ³n actualizada (otra pestaÃ±a), recargando vista semanal...');
            config = loadConfig();
            syncLunchInputs();
            renderWeek();
        }
    });

    // Event listeners
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => { refDate.setDate(refDate.getDate() - 7); renderWeek(); });
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => { refDate.setDate(refDate.getDate() + 7); renderWeek(); });
    if (todayBtn) todayBtn.addEventListener('click', () => { refDate = new Date(); renderWeek(); });
    if (dentistSelect) dentistSelect.addEventListener('change', (e) => { selectedDentist = e.target.value; renderWeek(); });
    lunchStartInput?.addEventListener('change', saveLunchConfig);
    lunchEndInput?.addEventListener('change', saveLunchConfig);

    // Inicializar
    syncLunchInputs();
    await loadDentists();
    await renderWeek();
}

