// Inicializador para la vista semanal
export async function initSemanal(container, referenceDate) {
	// Cargar plantilla si es necesario
	if (!container.querySelector('#gridContainer')) {
		try {
			const resp = await fetch(new URL('../views/Agendas/semanal.html', import.meta.url));
			const html = await resp.text();
			container.innerHTML = html;
		} catch (err) {
			container.innerHTML = '<div class="py-4"><p class="text-red-500">No se pudo cargar la plantilla de la agenda semanal.</p></div>';
			console.error('Error cargando plantilla semanal.html:', err);
			return;
		}
	}

	const prevBtn = container.querySelector('#prevWeek');
	const nextBtn = container.querySelector('#nextWeek');
	const daysContainer = container.querySelector('#daysContainer');
	const gridContainer = container.querySelector('#gridContainer');

	// Estado: fecha de referencia (hoy o provista)
	let refDate = referenceDate ? new Date(referenceDate) : new Date();

	function startOfWeek(date) {
		const d = new Date(date);
		const day = d.getDay(); // 0=domingo
		const diff = (day + 6) % 7; // ajustar para que lunes sea inicio
		d.setDate(d.getDate() - diff);
		d.setHours(0,0,0,0);
		return d;
	}

	function toSQLDate(d) { return d.toISOString().slice(0,10); }

	async function renderWeek(referenceDate) {
		const weekStart = startOfWeek(referenceDate);
		const days = [];
		for (let i=0;i<7;i++) {
			const d = new Date(weekStart);
			d.setDate(weekStart.getDate() + i);
			days.push({ name: d.toLocaleString('es-ES', { weekday: 'long' }).replace(/^./, s=>s.toUpperCase()), day: String(d.getDate()).padStart(2,'0'), date: toSQLDate(d), iso: d.toISOString() });
		}

		// Mostrar botones de días
		daysContainer.innerHTML = '';
		days.forEach((d, idx) => {
			const dayBtn = document.createElement('button');
			dayBtn.className = `text-center px-2 py-3 rounded-lg transition ${idx === 1 ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`;
			dayBtn.innerHTML = `<div class="text-xs font-medium ${idx === 1 ? 'text-white' : 'text-blue-600'}">${d.name} ${d.day}</div>`;
			daysContainer.appendChild(dayBtn);
		});

		// Consultar citas para la semana (between start and end dates)
		const startSQL = days[0].date;
		const endSQL = days[6].date;
		const sql = `SELECT c.id, c.paciente_id, c.fecha_hora, c.motivo, c.estado, p.nombre, p.apellido FROM citas c JOIN pacientes p ON p.id = c.paciente_id WHERE date(c.fecha_hora) BETWEEN ? AND ?`;
		let rows = [];
		try {
			rows = await window.api.db.all(sql, [startSQL, endSQL]);
		} catch (err) {
			console.error('Error cargando citas semanales:', err);
		}

		// Mapear citas por dayKey y hora
		const appointmentsMap = {};
		rows.forEach(r => {
			const d = new Date(r.fecha_hora);
			const dateKey = toSQLDate(d);
			const hhmm = d.toTimeString().slice(0,5);
			const dayLabel = new Date(d).toLocaleString('es-ES', { weekday: 'long' }).replace(/^./, s=>s.toUpperCase());
			const dayKey = `${dayLabel} ${String(d.getDate()).padStart(2,'0')}`;
			appointmentsMap[`${dateKey}|${hhmm}`] = { name: `${r.nombre} ${r.apellido}`, color: 'bg-blue-200 border-blue-400', raw: r };
		});

		// Generar horarios
		const timeSlots = [];
		for (let hour = 8; hour <= 13; hour++) {
			for (let minute = 0; minute < 60; minute += 15) {
				if (hour === 13 && minute > 30) break;
				timeSlots.push(`${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`);
			}
		}

		// Construir grilla
		const grid = document.createElement('div');
		grid.className = 'grid gap-0';
		grid.style.gridTemplateColumns = '70px repeat(7, minmax(140px, 1fr))';

		const emptyCorner = document.createElement('div');
		emptyCorner.className = 'bg-gray-50 border-r border-b sticky left-0 top-0 z-30';
		grid.appendChild(emptyCorner);

		days.forEach((day, idx) => {
			const dayHeader = document.createElement('div');
			dayHeader.className = `border-r border-b font-semibold text-center py-3 text-sm sticky top-0 z-20 ${idx === 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'}`;
			dayHeader.textContent = `${day.name} ${day.day}`;
			grid.appendChild(dayHeader);
		});

		timeSlots.forEach(time => {
			const timeCell = document.createElement('div');
			timeCell.className = 'border-r border-b bg-gray-50 text-xs text-gray-600 text-right pr-3 py-4 font-medium sticky left-0 z-10';
			timeCell.textContent = time;
			grid.appendChild(timeCell);

			days.forEach(day => {
				const cell = document.createElement('div');
				cell.className = 'border-r border-b relative group transition min-h-[56px]';
				const key = `${day.date}|${time}`;
				const apt = appointmentsMap[key];
				if (apt) {
					cell.className += ` ${apt.color} border-l-4`;
					cell.innerHTML = `
						<div class="p-2 flex items-center justify-between h-full">
							<span class="text-sm font-medium text-gray-800 truncate flex-1">${apt.name}</span>
							<div class="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition">
								<button class="w-6 h-6 rounded-full bg-white shadow-sm hover:shadow flex items-center justify-center hover:bg-gray-50">
									<svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
										<circle cx="10" cy="5" r="1.5"/>
										<circle cx="10" cy="10" r="1.5"/>
										<circle cx="10" cy="15" r="1.5"/>
									</svg>
								</button>
							</div>
						</div>
					`;
				} else {
					cell.className += ' hover:bg-blue-50';
					cell.innerHTML = `
						<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
							<button class="w-8 h-8 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 hover:scale-110 transition-all"> 
								<svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
								</svg>
							</button>
						</div>
					`;
				}

				cell.dataset.date = day.date;
				cell.dataset.time = time;
				grid.appendChild(cell);
			});
		});

		gridContainer.innerHTML = '';
		gridContainer.appendChild(grid);

		// Eventos para celdas
		grid.querySelectorAll('[data-date]').forEach(cell => {
			cell.addEventListener('click', (e) => {
				if (e.target.closest('button')) return; // evita doble acción en botones internos
				const hasAppointment = cell.querySelector('span');
				if (hasAppointment) {
					console.log('Ver cita', { date: cell.dataset.date, time: cell.dataset.time });
				} else {
					openCreateModalFor(cell.dataset.date, cell.dataset.time);
				}
			});
		});

		// dias buttons behavior - cargar vista diaria para el día seleccionado
		daysContainer.querySelectorAll('button').forEach((btn, idx) => {
			btn.addEventListener('click', async () => {
				const selectedDay = days[idx];
				// Importar initDiaria dinámicamente para evitar conflictos
				const { initDiaria } = await import('./agenda_diaria.js');
				// Obtener el contenedor padre (agendaContainer)
				const agendaContainer = container.closest('#agendaContainer') || document.getElementById('agendaContainer');
				if (agendaContainer) {
					// Cargar la plantilla diaria
					try {
						const resp = await fetch(new URL('../views/Agendas/diaria.html', import.meta.url));
						const html = await resp.text();
						agendaContainer.innerHTML = html;
						// Inicializar la vista diaria para la fecha seleccionada
						await initDiaria(agendaContainer, selectedDay.date);
					} catch (err) {
						console.error('Error cargando vista diaria:', err);
					}
				}
			});
		});
	}

	// Modal para crear cita desde la grilla
	async function openCreateModalFor(dateStr, timeStr) {
		let patients = [];
		try { patients = await window.api.db.all('SELECT id, nombre, apellido FROM pacientes ORDER BY nombre, apellido'); }
		catch (err) { return alert('Error cargando pacientes: ' + err.message); }

		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
		const modal = document.createElement('div');
		modal.className = 'bg-white rounded shadow-lg p-6 w-96';
		modal.innerHTML = `
			<h3 class="text-lg font-semibold mb-3">Crear cita (${dateStr} ${timeStr})</h3>
			<label class="text-sm">Paciente</label>
			<select id="selPatientW" class="w-full border p-2 rounded mb-3"></select>
			<label class="text-sm">Motivo</label>
			<input id="aptReasonW" type="text" class="w-full border p-2 rounded mb-4" placeholder="Motivo (opcional)" />
			<div class="flex justify-end gap-2">
				<button id="cancelW" class="px-3 py-2 rounded border">Cancelar</button>
				<button id="saveW" class="px-3 py-2 rounded bg-blue-600 text-white">Crear cita</button>
			</div>
		`;
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		const sel = modal.querySelector('#selPatientW');
		patients.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = `${p.nombre} ${p.apellido}`; sel.appendChild(opt); });

		modal.querySelector('#cancelW').addEventListener('click', () => overlay.remove());
		modal.querySelector('#saveW').addEventListener('click', async () => {
			const pid = sel.value; const motivo = modal.querySelector('#aptReasonW').value || '';
			if (!pid) return alert('Seleccione paciente');
			const fechaHora = `${dateStr} ${timeStr}:00`;
			try {
				await window.api.db.run('INSERT INTO citas (paciente_id, fecha_hora, motivo) VALUES (?, ?, ?)', [pid, fechaHora, motivo]);
				overlay.remove();
				// re-render semana
				await renderWeek(refDate);
				alert('Cita creada');
			} catch (err) {
				console.error(err); alert('Error creando cita: ' + err.message);
			}
		});
	}

	// Prev / Next week
	if (prevBtn) prevBtn.addEventListener('click', () => { refDate.setDate(refDate.getDate() - 7); renderWeek(refDate); });
	if (nextBtn) nextBtn.addEventListener('click', () => { refDate.setDate(refDate.getDate() + 7); renderWeek(refDate); });

	// Inicializar la semana
	await renderWeek(refDate);
}