// agenda_semanal.js - Vista semanal mejorada

export async function initSemanal(container, referenceDate) {
    // Inyectar estilos de animación
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
    // Solo esperamos a que el DOM esté listo
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Estado
    let refDate = referenceDate ? new Date(referenceDate) : new Date();
    let appointments = [];
    let dentists = [];
    let selectedDentist = '';
    let selectedChair = '1';

    // Selectores con validación
    const $ = (sel) => container.querySelector(sel);
    const prevWeekBtn = $('#prevWeek');
    const nextWeekBtn = $('#nextWeek');
    const todayBtn = $('#todayBtn');
    const daysContainer = $('#daysContainer');
    const gridContainer = $('#gridContainer');
    const currentMonthYear = $('#currentMonthYear');
    const dentistSelect = $('#dentistSelectWeekly');

    // Verificar que existen los elementos necesarios
    if (!daysContainer || !gridContainer) {
        console.error('Elementos necesarios no encontrados:', {
            daysContainer: !!daysContainer,
            gridContainer: !!gridContainer,
            container: container.innerHTML.substring(0, 200)
        });
        container.innerHTML = '<div class="p-8 text-center text-red-500">Error: Elementos del DOM no encontrados. Verifica que la plantilla semanal.html esté disponible.</div>';
        return;
    }

    // Helpers
    const toSQLDate = (d) => d.toISOString().slice(0, 10);
    const formatTime = (d) => d.toTimeString().slice(0, 5);

    function startOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day + 6) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function isToday(dateStr) {
        return dateStr === toSQLDate(new Date());
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

    // Generar slots de tiempo
    function generateTimeSlots() {
        const slots = [];
        for (let hour = 8; hour <= 20; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                if (hour === 20 && minute > 0) break;
                slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            }
        }
        return slots;
    }

    // Renderizar semana
    async function renderWeek() {
        const weekStart = startOfWeek(refDate);
        const days = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            days.push({
                name: d.toLocaleString('es-ES', { weekday: 'short' }).replace(/^./, s => s.toUpperCase()),
                fullName: d.toLocaleString('es-ES', { weekday: 'long' }).replace(/^./, s => s.toUpperCase()),
                day: d.getDate(),
                date: toSQLDate(d),
                isToday: isToday(toSQLDate(d)),
                isWeekend: d.getDay() === 0 || d.getDay() === 6
            });
        }

        // Actualizar mes/año
        if (currentMonthYear) {
            const monthYear = weekStart.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
            currentMonthYear.textContent = monthYear.replace(/^./, s => s.toUpperCase());
        }

        // Cargar citas de la semana
        const startSQL = days[0].date;
        const endSQL = days[6].date;

        try {
            let sql = `
                SELECT c.id, c.paciente_id, c.fecha_hora, c.motivo, c.estado,
                       p.nombre, p.apellido
                FROM citas c
                JOIN pacientes p ON p.id = c.paciente_id
                WHERE date(c.fecha_hora) BETWEEN ? AND ?
                ORDER BY c.fecha_hora
            `;
            const params = [startSQL, endSQL];

            appointments = await window.api.db.all(sql, params);
        } catch (err) {
            console.error('Error cargando citas:', err);
            appointments = [];
        }

        // Contar citas por día
        const appointmentsByDay = {};
        appointments.forEach(apt => {
            const date = toSQLDate(new Date(apt.fecha_hora));
            appointmentsByDay[date] = (appointmentsByDay[date] || 0) + 1;
        });

        // Renderizar botones de días
        daysContainer.innerHTML = days.map((d, idx) => `
            <button class="day-btn ${d.isToday ? 'today' : ''} ${idx === 0 ? 'active' : ''} ${d.isWeekend ? 'opacity-70' : ''} dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-colors" 
                    data-date="${d.date}" data-index="${idx}">
                <span class="day-name dark:text-gray-400">${d.name}</span>
                <span class="day-number">${d.day}</span>
                ${appointmentsByDay[d.date] ? `<span class="appointments-count dark:bg-teal-900 dark:text-teal-100">${appointmentsByDay[d.date]} citas</span>` : ''}
            </button>
        `).join('');

        // Event listeners para días
        daysContainer.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                daysContainer.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                console.log('Día seleccionado:', btn.dataset.date);
            });
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

        // Header de días (vacío + 7 días)
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
            // Celda de hora
            const timeCell = document.createElement('div');
            timeCell.className = 'time-cell bg-[#F9FAFB] dark:bg-gray-900 border-r border-b border-[#E5E7EB] dark:border-gray-700 text-gray-500 dark:text-gray-400 transition-colors';
            timeCell.textContent = time;
            grid.appendChild(timeCell);

            // Celdas por día
            days.forEach(day => {
                const cell = document.createElement('div');
                cell.className = `grid-cell border-r border-b border-[#F3F4F6] dark:border-gray-700 transition-colors ${day.isWeekend ? 'bg-gray-50 dark:bg-gray-800/50' : ''} ${day.isToday ? 'bg-[#8BCFDD]/5 dark:bg-[#8BCFDD]/5' : ''}`;
                cell.dataset.date = day.date;
                cell.dataset.time = time;

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
                } else if (!day.isWeekend) {
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
                } else if (!cell.closest('.grid-cell').classList.contains('bg-gray-50')) {
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
        let patients = [];
        try {
            patients = await window.api.db.all('SELECT id, nombre, apellido FROM pacientes ORDER BY nombre');
        } catch (err) {
            return alert('Error cargando pacientes');
        }

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700" style="animation: slideUp 0.3s ease">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Nueva Cita</h3>
                    <p class="text-white/70 text-sm mt-1">${dateStr} a las ${timeStr}</p>
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
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Dentista</label>
                        <p class="text-sm text-[#0F2532]/60 dark:text-gray-500 italic">Campo no disponible en esta versión</p>
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
            const motivo = overlay.querySelector('#aptReasonW').value;

            if (!pacienteId) return alert('Selecciona un paciente');

            try {
                await window.api.db.run(
                    'INSERT INTO citas (paciente_id, fecha_hora, motivo, estado) VALUES (?, ?, ?, ?)',
                    [pacienteId, `${dateStr} ${timeStr}:00`, motivo, 'pendiente']
                );
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

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">${apt.nombre} ${apt.apellido}</h3>
                    <p class="text-white/70 text-sm mt-1">${new Date(apt.fecha_hora).toLocaleString('es-ES')}</p>
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
            // Recargar si filtras por sillón
        });
    });

    // Event listeners
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => { refDate.setDate(refDate.getDate() - 7); renderWeek(); });
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => { refDate.setDate(refDate.getDate() + 7); renderWeek(); });
    if (todayBtn) todayBtn.addEventListener('click', () => { refDate = new Date(); renderWeek(); });
    if (dentistSelect) dentistSelect.addEventListener('change', (e) => { selectedDentist = e.target.value; renderWeek(); });

    // Inicializar
    await loadDentists();
    await renderWeek();
}