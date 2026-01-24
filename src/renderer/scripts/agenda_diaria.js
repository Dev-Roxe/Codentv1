// agenda_diaria.js - Vista diaria con Timeline, Drag & Drop y Búsqueda

export async function initDiaria(container, dateStr) {
    // Cargar plantilla si es necesario
    if (!container.querySelector('#hoursColumn')) {
        try {
            const resp = await fetch(new URL('../views/Agendas/diaria.html', import.meta.url));
            container.innerHTML = await resp.text();
        } catch (err) {
            container.innerHTML = '<div class="p-8 text-center text-red-500">Error cargando la vista diaria</div>';
            return;
        }
    }

    // Estado
    const parseLocalDate = (value) => {
        if (!value) return new Date();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date(value);
    };
    let currentDate = dateStr ? parseLocalDate(dateStr) : new Date();
    let appointments = [];
    let dentists = [];
    let selectedDentist = '';
    let autoReloadInterval = null;

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

    function dbGet(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                const db = window.api && window.api.db;
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

    async function getCajaAbiertaId() {
        const row = await dbGet("SELECT id FROM cajas WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1");
        return row ? row.id : null;
    }

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
    const dentistSelect = $('#dentistSelect');
    const createAptBtn = $('#createAptBtn');
    const autoReloadCheckbox = $('#autoReloadCheckbox');

    // Helpers
    const toSQLDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const formatTime = (date) => date.toTimeString().slice(0, 5);
    const timeToMinutes = (value) => {
        if (!value) return null;
        const [hours, minutes] = value.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
        return hours * 60 + minutes;
    };
    const minutesToTime = (totalMinutes) => {
        if (!Number.isFinite(totalMinutes)) return '00:00';
        const clamped = Math.max(0, Math.min(1439, totalMinutes));
        const hours = Math.floor(clamped / 60);
        const minutes = clamped % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };
    const getWorkBoundsMinutes = () => {
        normalizeWorkHours();
        return {
            start: START_HOUR * 60,
            end: END_HOUR * 60
        };
    };
    const isWithinWorkHours = (startMinutes, endMinutes) => {
        const bounds = getWorkBoundsMinutes();
        return startMinutes >= bounds.start && endMinutes <= bounds.end;
    };

    // Cargar configuración del localStorage
    function loadConfig() {
        return {
            workStart: parseInt(localStorage.getItem('work-start')?.split(':')[0] || '8'),
            workEnd: parseInt(localStorage.getItem('work-end')?.split(':')[0] || '18'),
            defaultDuration: parseInt(localStorage.getItem('default-duration') || '30'),
            appointmentInterval: parseInt(localStorage.getItem('appointment-interval') || '10'),
            timeFormat: localStorage.getItem('time-format') || '24h'
        };
    }

    let config = loadConfig();

    // Configuración del timeline
    const HOUR_HEIGHT = 84;
    let START_HOUR = config.workStart;
    let END_HOUR = config.workEnd;
    let minuteHeight = HOUR_HEIGHT / 60;
    let intervalMinutes = 10;
    let timelineMinutes = 0;
    let timelineHeight = 0;
    let currentTimeIntervalId = null;
    let searchQuery = '';
    let isCompactView = false;
    let draggedAppointment = null;

    function clampInterval(value) {
        const parsed = parseInt(value, 10);
        if (!parsed || parsed <= 0 || parsed > 60) return 30;
        return parsed;
    }

    function normalizeWorkHours() {
        if (!Number.isFinite(START_HOUR)) START_HOUR = 8;
        if (!Number.isFinite(END_HOUR)) END_HOUR = 18;
        if (END_HOUR <= START_HOUR) END_HOUR = START_HOUR + 1;
    }

    function buildTimeSlots() {
        const slots = [];
        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += intervalMinutes) {
                if (hour === END_HOUR && minute > 0) break;
                const minutesFromStart = (hour - START_HOUR) * 60 + minute;
                slots.push({ hour, minute, minutesFromStart });
            }
        }
        return slots;
    }

    function updateTimelineMetrics() {
        normalizeWorkHours();
        intervalMinutes = clampInterval(config.appointmentInterval);
        minuteHeight = HOUR_HEIGHT / 60;
        timelineMinutes = (END_HOUR - START_HOUR) * 60;
        timelineHeight = timelineMinutes * minuteHeight;
    }

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

    async function loadAppointments() {
        const dateSQL = toSQLDate(currentDate);
        try {
            let sql = `
                SELECT c.id, c.paciente_id, c.fecha_hora, c.duracion_minutos, c.motivo, c.estado, c.dentista_id, c.monto,
                       p.nombre, p.apellido, p.telefono,
                       u.nombre as dentista_nombre, u.apellido as dentista_apellido
                FROM citas c
                JOIN pacientes p ON p.id = c.paciente_id
                LEFT JOIN usuarios u ON u.id = c.dentista_id
                WHERE date(c.fecha_hora) = ?
                ORDER BY c.fecha_hora
            `;
            const params = [dateSQL];

            appointments = await window.api.db.all(sql, params);
            renderAppointments();
        } catch (err) {
            console.error('Error cargando citas:', err);
            const container = $('#appointmentsContainer');
            if (container) {
                container.innerHTML = '<div class="text-center py-4 text-red-500">Error cargando citas</div>';
            }
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

    // Generar slots de horas
    function generateTimelineSlots() {
        const hoursColumn = $('#hoursColumn');
        const hourLines = $('#hourLines');
        const appointmentsGrid = $('#appointmentsGrid');

        if (!hoursColumn || !hourLines) return;

        updateTimelineMetrics();

        const slots = buildTimeSlots();
        const totalHeight = timelineHeight;
        const hourLabelClass = 'text-xs font-semibold text-gray-600 dark:text-gray-400';
        const slotLabelClass = 'text-[10px] text-gray-400 dark:text-gray-500';
        const hourLineClass = 'absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700';
        const slotLineClass = 'absolute left-0 right-0 border-t border-gray-200/40 dark:border-gray-800/70';

        if (appointmentsGrid) {
            appointmentsGrid.style.minHeight = `${totalHeight}px`;
        }
        hoursColumn.style.minHeight = `${totalHeight}px`;

        let hoursHTML = `<div class="relative" style="height: ${totalHeight}px">`;
        let linesHTML = '';

        slots.forEach(slot => {
            const topPos = slot.minutesFromStart * minuteHeight;
            const timeStr = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`;
            const labelClass = slot.minute === 0 ? hourLabelClass : slotLabelClass;
            const lineClass = slot.minute === 0 ? hourLineClass : slotLineClass;

            hoursHTML += `
                <div class="${lineClass}" style="top: ${topPos}px"></div>
                <div class="absolute left-0 right-0 pr-2 text-right leading-none ${labelClass}" style="top: ${topPos}px;">
                    ${timeStr}
                </div>
            `;

            linesHTML += `
                <div class="${lineClass}" style="top: ${topPos}px"></div>
            `;
        });

        hoursHTML += '</div>';

        hoursColumn.innerHTML = hoursHTML;
        hourLines.innerHTML = linesHTML;

        updateCurrentTimeLine();
        if (currentTimeIntervalId) clearInterval(currentTimeIntervalId);
        currentTimeIntervalId = setInterval(updateCurrentTimeLine, 60000);
    }

    // Actualizar línea de hora actual
    function updateCurrentTimeLine() {
        const currentTimeLine = $('#currentTimeLine');
        const currentTimeLabel = $('#currentTimeLabel');

        if (!currentTimeLine) return;

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const minutesFromStart = (hours - START_HOUR) * 60 + minutes;

        if (minutesFromStart >= 0 && minutesFromStart <= timelineMinutes) {
            const topPos = minutesFromStart * minuteHeight;

            currentTimeLine.style.top = `${topPos}px`;
            currentTimeLine.classList.remove('hidden');

            if (currentTimeLabel) {
                currentTimeLabel.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        } else {
            currentTimeLine.classList.add('hidden');
        }
    }

    // Renderizar citas en timeline
    function renderAppointments() {
        const container = $('#appointmentsContainer');
        if (!container) return;

        // Filtrar por búsqueda
        let filtered = appointments.filter(apt => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const nombre = `${apt.nombre} ${apt.apellido}`.toLowerCase();
                const telefono = (apt.telefono || '').toLowerCase();
                return nombre.includes(query) || telefono.includes(query);
            }
            return true;
        });

        // Filtrar por estado
        filtered = filtered.filter(apt => {
            const filter = statusFilters.find(f => f.id === (apt.estado || 'pendiente'));
            return filter ? filter.checked : true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center py-20">
                    <svg class="w-16 h-16 mb-4 opacity-50 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <p class="text-lg font-medium text-gray-700 dark:text-gray-200">No hay citas</p>
                    <p class="text-sm mt-1 text-gray-400 dark:text-gray-500">
                        ${searchQuery ? 'No se encontraron resultados' : 'No hay citas para este día'}
                    </p>
                </div>
            `;
            return;
        }

        // Renderizar citas posicionadas
        container.innerHTML = filtered.map(apt => {
            const dateTime = new Date(apt.fecha_hora);
            const hours = dateTime.getHours();
            const minutes = dateTime.getMinutes();

            const minutesFromStart = (hours - START_HOUR) * 60 + minutes;
            const topPos = minutesFromStart * minuteHeight;

            const duration = Number(apt.duracion_minutos || config.defaultDuration || 30);
            const height = duration * minuteHeight;

            const endTime = new Date(dateTime);
            endTime.setMinutes(endTime.getMinutes() + duration);
            const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

            const statusStyles = {
                'pendiente': 'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
                'confirmado': 'border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20',
                'en-sala': 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20',
                'atendido': 'border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20',
                'no-asiste': 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20',
                'cancelado': 'border-l-4 border-gray-400 bg-gray-50 dark:bg-gray-700'
            };
            const statusClass = statusStyles[apt.estado] || statusStyles['pendiente'];

            const statusBadges = {
                'pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                'confirmado': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                'en-sala': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                'atendido': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                'no-asiste': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                'cancelado': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
            };
            const badgeClass = statusBadges[apt.estado] || statusBadges['pendiente'];

            return `
                <div class="absolute left-2 right-2 rounded-xl shadow-sm hover:shadow-md transition-all cursor-move group ${statusClass}"
                     style="top: ${topPos}px; height: ${height}px; max-height: ${height}px;"
                     data-apt-id="${apt.id}"
                     draggable="true">
                    <div class="p-3 h-full flex flex-col">
                        <div class="flex items-start justify-between gap-2 mb-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-semibold text-gray-900 dark:text-white truncate">
                                    ${apt.nombre} ${apt.apellido}
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    ${timeStr} - ${endTimeStr}
                                </div>
                            </div>
                            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass} whitespace-nowrap">
                                ${apt.estado || 'Pendiente'}
                            </span>
                        </div>
                        
                        ${!isCompactView ? `
                            <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1 flex-1">
                                ${apt.dentista_nombre ? `
                                    <div class="flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                        </svg>
                                        Dr(a). ${apt.dentista_nombre} ${apt.dentista_apellido || ''}
                                    </div>
                                ` : ''}
                                ${apt.telefono ? `
                                    <div class="flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                        </svg>
                                        ${apt.telefono}
                                    </div>
                                ` : ''}
                                ${apt.motivo ? `
                                    <div class="truncate">${apt.motivo}</div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        <div class="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.location.href='ficha_clinica.html?id=${apt.paciente_id}'" 
                                    class="p-1 text-gray-400 hover:text-[#4EABBE] rounded transition-colors" title="Ver Paciente">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>
                            <button onclick="editAppointment(${apt.id})" 
                                    class="p-1 text-gray-400 hover:text-yellow-500 rounded transition-colors" title="Editar">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                            </button>
                            <button onclick="deleteAppointment(${apt.id})" 
                                    class="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Eliminar">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        updateStats(filtered);
        enableDragDrop();
    }

    // Actualizar estadísticas
    function updateStats(filtered) {
        const statTotal = $('#statTotalCitas');
        const statConfirmadas = $('#statConfirmadas');
        const statPendientes = $('#statPendientes');

        if (statTotal) statTotal.textContent = filtered.length;
        if (statConfirmadas) {
            const confirmadas = filtered.filter(a => a.estado === 'confirmado' || a.estado === 'atendido').length;
            statConfirmadas.textContent = confirmadas;
        }
        if (statPendientes) {
            const pendientes = filtered.filter(a => a.estado === 'pendiente').length;
            statPendientes.textContent = pendientes;
        }
    }

    // Habilitar Drag & Drop
    function enableDragDrop() {
        const container = $('#appointmentsContainer');
        if (!container) return;

        const appointmentCards = container.querySelectorAll('[data-apt-id]');

        appointmentCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                const aptId = parseInt(card.dataset.aptId);
                draggedAppointment = appointments.find(a => a.id === aptId);
                card.classList.add('opacity-50', 'scale-95');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(aptId));

                // Crear imagen de arrastre personalizada
                const dragImage = card.cloneNode(true);
                dragImage.style.width = card.offsetWidth + 'px';
                document.body.appendChild(dragImage);
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                e.dataTransfer.setDragImage(dragImage, card.offsetWidth / 2, 20);
                setTimeout(() => document.body.removeChild(dragImage), 0);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('opacity-50', 'scale-95');
                draggedAppointment = null;
                const indicator = document.querySelector('#dragIndicatorLine');
                if (indicator) indicator.style.display = 'none';
            });
        });


        const grid = $('#appointmentsGrid');
        if (grid && !grid.dataset.dragDropBound) {
            const ensureDragIndicator = () => {
                let indicator = grid.querySelector('#dragIndicatorLine');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.id = 'dragIndicatorLine';
                    indicator.className = 'absolute left-0 right-0 h-0.5 bg-[#4EABBE] opacity-80 pointer-events-none';
                    indicator.style.display = 'none';
                    indicator.style.zIndex = '25';
                    indicator.style.boxShadow = '0 0 8px rgba(78, 171, 190, 0.6)';
                    indicator.innerHTML = `
                        <div class="absolute right-3 -top-3 bg-[#4EABBE] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
                            00:00
                        </div>
                    `;
                    grid.appendChild(indicator);
                }
                return indicator;
            };

            const getSnappedTimeFromClientY = (clientY) => {
                const rect = grid.getBoundingClientRect();
                const scrollTop = document.querySelector('#timelineScroll')?.scrollTop || 0;
                let y = clientY - rect.top + scrollTop;
                const maxHeight = timelineHeight || 0;
                y = Math.max(0, Math.min(y, maxHeight));
                const totalMinutes = minuteHeight > 0 ? (y / minuteHeight) : 0;
                const step = intervalMinutes || clampInterval(config.appointmentInterval);
                const snappedTotal = Math.round(totalMinutes / step) * step;
                const clampedTotal = Math.max(0, Math.min(snappedTotal, timelineMinutes));
                const newHour = START_HOUR + Math.floor(clampedTotal / 60);
                const newMinutes = clampedTotal % 60;
                const topPos = clampedTotal * minuteHeight;
                return { newHour, newMinutes, topPos };
            };

            const handleDragOver = (e) => {
                if (!draggedAppointment) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const { newHour, newMinutes, topPos } = getSnappedTimeFromClientY(e.clientY);
                const indicator = ensureDragIndicator();
                indicator.style.display = 'block';
                indicator.style.top = `${topPos}px`;
                const label = indicator.querySelector('div');
                if (label) {
                    label.textContent = `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
                }
            };

            const handleDrop = async (e) => {
                e.preventDefault();
                if (!draggedAppointment) return;

                let { newHour, newMinutes } = getSnappedTimeFromClientY(e.clientY);

                // Ajustar si los minutos llegan a 60
                if (newMinutes >= 60) {
                    newHour += 1;
                    newMinutes = 0;
                }

                const durationMinutes = Number(draggedAppointment.duracion_minutos || config.defaultDuration || 30);
                const startMinutes = (newHour * 60) + newMinutes;
                const endMinutes = startMinutes + durationMinutes;
                if (!isWithinWorkHours(startMinutes, endMinutes)) {
                    const bounds = getWorkBoundsMinutes();
                    const startLabel = minutesToTime(bounds.start);
                    const endLabel = minutesToTime(bounds.end);
                    alert(`No es posible agendar fuera del horario (${startLabel} - ${endLabel})`);
                    draggedAppointment = null;
                    return;
                }

                const oldDateTime = new Date(draggedAppointment.fecha_hora);

                // Crear nueva fecha/hora usando la fecha actual de la vista
                const newDateTime = new Date(currentDate);
                newDateTime.setHours(newHour, newMinutes, 0, 0);

                const oldTime = `${String(oldDateTime.getHours()).padStart(2, '0')}:${String(oldDateTime.getMinutes()).padStart(2, '0')}`;
                const newTime = `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;

                if (confirm(`¿Mover de ${oldTime} a ${newTime}?`)) {
                    try {
                        // Formatear para SQL: YYYY-MM-DD HH:MM:SS
                        const year = newDateTime.getFullYear();
                        const month = String(newDateTime.getMonth() + 1).padStart(2, '0');
                        const day = String(newDateTime.getDate()).padStart(2, '0');
                        const hours = String(newDateTime.getHours()).padStart(2, '0');
                        const minutes = String(newDateTime.getMinutes()).padStart(2, '0');
                        const sqlDateTime = `${year}-${month}-${day} ${hours}:${minutes}:00`;

                        await window.api.db.run(
                            'UPDATE citas SET fecha_hora = ? WHERE id = ?',
                            [sqlDateTime, draggedAppointment.id]
                        );
                        await loadAppointments();
                    } catch (err) {
                        console.error('Error al mover cita:', err);
                        alert('❌ Error al mover: ' + err.message);
                    }
                }

                draggedAppointment = null;
                const indicator = grid.querySelector('#dragIndicatorLine');
                if (indicator) indicator.style.display = 'none';
            };

            grid.addEventListener('dragover', handleDragOver, true);
            grid.addEventListener('drop', handleDrop, true);
            grid.dataset.dragDropBound = 'true';
        }
    }

    // Búsqueda
    const searchInput = $('#searchInput');
    const clearSearch = $('#clearSearch');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            if (clearSearch) clearSearch.classList.toggle('hidden', !searchQuery);
            renderAppointments();
        });
    }

    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            searchQuery = '';
            if (searchInput) searchInput.value = '';
            clearSearch.classList.add('hidden');
            renderAppointments();
        });
    }

    // Toggle de vista
    const viewToggle = $('#viewToggle');
    const viewModeText = $('#viewModeText');

    if (viewToggle) {
        viewToggle.addEventListener('click', () => {
            isCompactView = !isCompactView;
            if (viewModeText) {
                viewModeText.textContent = isCompactView ? 'Compacta' : 'Expandida';
            }
            renderAppointments();
        });
    }

    // Funciones globales
    window.updateStatus = async (id, status) => {
        try {
            if (status === 'atendido') {
                const cajaId = await getCajaAbiertaId();
                if (!cajaId) {
                    alert('Debe abrir una caja para marcar la cita como atendida');
                    return;
                }
                const apt = appointments.find(a => String(a.id) === String(id));
                if (apt && apt.estado !== 'atendido') {
                    const monto = Number(apt.monto || 0);
                    if (monto > 0) {
                        const usuarioId = getCurrentUserId();
                        const pacienteNombre = `${apt.nombre || ''} ${apt.apellido || ''}`.trim();
                        const concepto = pacienteNombre ? `Cita atendida - ${pacienteNombre}` : 'Cita atendida';
                        await window.api.db.run(
                            'INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)',
                            [cajaId, 'ingreso', monto, concepto, usuarioId]
                        );
                    }
                }
            }
            await window.api.db.run('UPDATE citas SET estado = ? WHERE id = ?', [status, id]);
            loadAppointments();
        } catch (err) {
            alert('Error al actualizar estado');
        }
    };

    window.deleteAppointment = async (id) => {
        if (!confirm('¿Eliminar esta cita?')) return;
        try {
            await window.api.db.run('DELETE FROM citas WHERE id = ?', [id]);
            loadAppointments();
        } catch (err) {
            alert('Error al eliminar');
        }
    };

    window.editAppointment = async (id) => {
        const apt = appointments.find(a => String(a.id) === String(id));
        if (!apt) {
            alert('Cita no encontrada');
            return;
        }

        let patients = [];
        try {
            patients = await window.api.db.all('SELECT id, nombre, apellido FROM pacientes ORDER BY nombre');
        } catch (err) {
            return alert('Error cargando pacientes');
        }

        const aptDateObj = new Date(apt.fecha_hora);
        const aptDate = toSQLDate(aptDateObj);
        const aptTime = `${String(aptDateObj.getHours()).padStart(2, '0')}:${String(aptDateObj.getMinutes()).padStart(2, '0')}`;
        const durationMinutes = Number(apt.duracion_minutos || config.defaultDuration || 30);
        const startMinutes = timeToMinutes(aptTime) ?? 0;
        const aptEndTime = minutesToTime(startMinutes + durationMinutes);
        const statusOptions = statusFilters.map(f => {
            const selected = (apt.estado || 'pendiente') == f.id ? 'selected' : '';
            return `<option value="${f.id}" ${selected}>${f.label}</option>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-100 dark:border-gray-700" style="animation: slideUp 0.3s ease">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Editar Cita</h3>
                    <p class="text-white/70 text-sm mt-1">${aptDate} ${aptTime} - ${aptEndTime}</p>
                </div>
                <form id="editAptForm" class="p-8 space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Paciente *</label>
                        <select id="aptPatientEdit" required class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            ${patients.map(p => `<option value="${p.id}" ${String(p.id) === String(apt.paciente_id) ? 'selected' : ''}>${p.nombre} ${p.apellido}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Dentista</label>
                        <select id="aptDentistEdit" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            <option value="">Sin asignar</option>
                            ${dentists.map(d => `<option value="${d.id}" ${String(d.id) === String(apt.dentista_id) ? 'selected' : ''}>Dr(a). ${d.nombre} ${d.apellido}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Fecha *</label>
                            <input type="date" id="aptDateEdit" required value="${aptDate}" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Hora inicio *</label>
                            <input type="time" id="aptTimeEdit" required value="${aptTime}" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Hora fin *</label>
                            <input type="time" id="aptEndTimeEdit" required value="${aptEndTime}" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Estado</label>
                        <select id="aptStatusEdit" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            ${statusOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Motivo</label>
                        <input type="text" id="aptReasonEdit" value="${apt.motivo || ''}" placeholder="Consulta, limpieza..." class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" id="cancelModalEdit" class="flex-1 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl hover:bg-[#F8F7F7] dark:hover:bg-gray-700 text-[#0F2532] dark:text-white font-medium transition-colors">Cancelar</button>
                        <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Guardar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#cancelModalEdit').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        const editStartInput = overlay.querySelector('#aptTimeEdit');
        const editEndInput = overlay.querySelector('#aptEndTimeEdit');
        editStartInput?.addEventListener('change', () => {
            const startMinutesValue = timeToMinutes(editStartInput.value);
            if (startMinutesValue === null) return;
            editEndInput.value = minutesToTime(startMinutesValue + durationMinutes);
        });

        overlay.querySelector('#editAptForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pacienteId = overlay.querySelector('#aptPatientEdit').value;
            const dentistaId = overlay.querySelector('#aptDentistEdit').value || null;
            const fecha = overlay.querySelector('#aptDateEdit').value;
            const hora = overlay.querySelector('#aptTimeEdit').value;
            const horaFin = overlay.querySelector('#aptEndTimeEdit').value;
            const motivo = overlay.querySelector('#aptReasonEdit').value || '';
            const estado = overlay.querySelector('#aptStatusEdit').value || 'pendiente';

            if (!pacienteId || !fecha || !hora) return alert('Completa los campos obligatorios');
            const startMinutes = timeToMinutes(hora);
            const endMinutes = timeToMinutes(horaFin);
            if (startMinutes === null || endMinutes === null) {
                return alert('Completa la hora de inicio y fin');
            }
            const duracion = endMinutes - startMinutes;
            if (duracion <= 0) {
                return alert('La hora fin debe ser mayor a la hora inicio');
            }
            if (!isWithinWorkHours(startMinutes, endMinutes)) {
                const bounds = getWorkBoundsMinutes();
                const startLabel = minutesToTime(bounds.start);
                const endLabel = minutesToTime(bounds.end);
                return alert(`No es posible agendar fuera del horario (${startLabel} - ${endLabel})`);
            }

            try {
                await window.api.db.run(
                    'UPDATE citas SET paciente_id = ?, dentista_id = ?, fecha_hora = ?, duracion_minutos = ?, motivo = ?, estado = ? WHERE id = ?',
                    [pacienteId, dentistaId, `${fecha} ${hora}:00`, duracion, motivo, estado, apt.id]
                );
                overlay.remove();
                loadAppointments();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
    };


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
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Dentista</label>
                        <select id="aptDentist" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all">
                            <option value="">Sin asignar</option>
                            ${dentists.map(d => `<option value="${d.id}">Dr(a). ${d.nombre} ${d.apellido}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Fecha *</label>
                            <input type="date" id="aptDate" required value="${toSQLDate(currentDate)}" class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Hora inicio *</label>
                            <input type="time" id="aptTime" required class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Hora fin *</label>
                            <input type="time" id="aptEndTime" required class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[#0F2532] dark:text-gray-300 mb-2">Motivo</label>
                        <input type="text" id="aptReason" placeholder="Consulta, limpieza..." class="w-full px-4 py-2.5 border border-[#D9D9D9] dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#0F2532] dark:text-white focus:ring-2 focus:ring-[#4EABBE] outline-none transition-all"/>
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

        const startInput = overlay.querySelector('#aptTime');
        const endInput = overlay.querySelector('#aptEndTime');
        const setEndFromStart = () => {
            const startMinutes = timeToMinutes(startInput?.value);
            if (startMinutes === null) return;
            const duration = Number(config.defaultDuration) || 30;
            endInput.value = minutesToTime(startMinutes + duration);
        };
        startInput?.addEventListener('change', setEndFromStart);

        overlay.querySelector('#createAptForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pacienteId = overlay.querySelector('#aptPatient').value;
            const dentistaId = overlay.querySelector('#aptDentist').value || null;
            const fecha = overlay.querySelector('#aptDate').value;
            const hora = overlay.querySelector('#aptTime').value;
            const horaFin = overlay.querySelector('#aptEndTime').value;
            const motivo = overlay.querySelector('#aptReason').value;

            const startMinutes = timeToMinutes(hora);
            const endMinutes = timeToMinutes(horaFin);
            if (startMinutes === null || endMinutes === null) {
                return alert('Completa la hora de inicio y fin');
            }
            const duracion = endMinutes - startMinutes;
            if (duracion <= 0) {
                return alert('La hora fin debe ser mayor a la hora inicio');
            }
            if (!isWithinWorkHours(startMinutes, endMinutes)) {
                const bounds = getWorkBoundsMinutes();
                const startLabel = minutesToTime(bounds.start);
                const endLabel = minutesToTime(bounds.end);
                return alert(`No es posible agendar fuera del horario (${startLabel} - ${endLabel})`);
            }

            try {
                await window.api.db.run(
                    'INSERT INTO citas (paciente_id, dentista_id, fecha_hora, duracion_minutos, motivo, estado, monto) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [pacienteId, dentistaId, `${fecha} ${hora}:00`, duracion, motivo, 'pendiente', 0]
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

    // Escuchar cambios en la configuración (mismo window)
    window.addEventListener('configurationChanged', (e) => {
        console.log('Configuración actualizada (mismo window), recargando timeline...');
        config = loadConfig();
        START_HOUR = config.workStart;
        END_HOUR = config.workEnd;
        generateTimelineSlots();
        loadAppointments();
    });

    // Escuchar cambios en la configuración (otras pestañas)
    window.addEventListener('storage', (e) => {
        if (e.key === 'work-start' || e.key === 'work-end' || e.key === 'default-duration' || e.key === 'appointment-interval') {
            console.log('Configuración actualizada (otra pestaña), recargando timeline...');
            config = loadConfig();
            START_HOUR = config.workStart;
            END_HOUR = config.workEnd;
            generateTimelineSlots();
            loadAppointments();
        }
    });

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
    generateTimelineSlots();
    await loadDentists();
    await loadAppointments();
}

