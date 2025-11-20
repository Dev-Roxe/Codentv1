// Inicializador para la vista diaria
export async function initDiaria(container, dateStr) {
	// CARGA DE PLANTILLA SI VIENE VACÍA (normalmente agenda.js ya inyecta el fragmento)
	if (!container.querySelector('#appointmentsRows')) {
		try {
			const resp = await fetch(new URL('../views/Agendas/diaria.html', import.meta.url));
			const html = await resp.text();
			container.innerHTML = html;
		} catch (err) {
			container.innerHTML = '<div class="py-4"><p class="text-red-500">No se pudo cargar la plantilla de la agenda diaria.</p></div>';
			console.error('Error cargando plantilla diaria.html:', err);
			return;
		}
	}

	// Estado: fecha actual que muestra la vista
	let currentDate = dateStr ? new Date(dateStr) : new Date();

	// SELECTORES
	const filtersDiv = container.querySelector('#filtersDiv');
	const markAllBtn = container.querySelector('#markAllBtn');
	const prevDayBtn = container.querySelector('#prevDay');
	const nextDayBtn = container.querySelector('#nextDay');
	const appointmentsRows = container.querySelector('#appointmentsRows');
	const dayNumberEl = container.querySelector('#dayNumber');
	const monthYearEl = container.querySelector('#monthYear');
	const dayNameEl = container.querySelector('#dayName');

	// Helper: formatea fecha a YYYY-MM-DD
	const toSQLDate = (d) => d.toISOString().slice(0, 10);

	const formatMonthYear = (d) => d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
	const formatDayName = (d) => d.toLocaleString('es-ES', { weekday: 'long' });

	// Filtros estáticos (puede mantenerse igual)
	const filters = [
		{ id: 'no-confirmado', label: 'No confirmado', checked: true },
		{ id: 'agenda-online', label: 'Agenda Online', checked: true },
		{ id: 'notificado-email', label: 'Notificado vía email', checked: true },
		{ id: 'confirmado-telefono', label: 'Confirmado por teléfono', checked: true },
		{ id: 'confirmado-email', label: 'Confirmado por email', checked: true },
		{ id: 'en-sala', label: 'En sala de espera', checked: true, color: 'yellow' },
		{ id: 'atendiendose', label: 'Atendiéndose', checked: true, color: 'green' },
		{ id: 'atendido', label: 'Atendido', checked: true, color: 'purple' },
		{ id: 'no-asiste', label: 'No asiste', checked: true, color: 'gray' },
		{ id: 'anulado', label: 'Anulado', checked: false, color: 'orange' }
	];

	// Render filtros
	function renderFilters() {
		filtersDiv.innerHTML = '';
		filters.forEach(filter => {
			const label = document.createElement('label');
			label.className = 'flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded';
			label.innerHTML = `
				<input type="checkbox" ${filter.checked ? 'checked' : ''} class="w-4 h-4 text-blue-500 rounded" data-filter="${filter.id}">
				<span class="text-sm text-gray-700">${filter.label}</span>
			`;
			filtersDiv.appendChild(label);
		});
		// attach listeners
		filtersDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
			cb.addEventListener('change', (e) => {
				console.log('Filtro cambiado:', e.target.dataset.filter, e.target.checked);
			});
		});
	}

	// Mostrar fecha en UI
	function renderDate() {
		dayNumberEl.textContent = String(currentDate.getDate()).padStart(2, '0');
		monthYearEl.textContent = formatMonthYear(currentDate);
		dayNameEl.textContent = formatDayName(currentDate).replace(/^./, s => s.toUpperCase());
	}

	// Cargar citas desde DB para la fecha dada
	async function loadAppointmentsFor(dateObj) {
		const dateSQL = toSQLDate(dateObj);
		// Consulta: traer citas y datos de paciente
		const sql = `SELECT c.id, c.paciente_id, c.fecha_hora, c.motivo, c.estado, p.nombre, p.apellido, p.telefono
					 FROM citas c
					 JOIN pacientes p ON p.id = c.paciente_id
					 WHERE date(c.fecha_hora) = ?
					 ORDER BY c.fecha_hora`;
		try {
			const rows = await window.api.db.all(sql, [dateSQL]);
			renderAppointments(rows);
		} catch (err) {
			console.error('Error cargando citas:', err);
			appointmentsRows.innerHTML = '<div class="p-4 text-red-500">Error cargando citas</div>';
		}
	}

	// Renderizar lista de citas a partir de filas de DB
	function renderAppointments(rows) {
		if (!rows || rows.length === 0) {
			appointmentsRows.innerHTML = '<div class="p-6 text-gray-500 text-center">No hay citas para esta fecha</div>';
			return;
		}

		const timeColors = {
			'08:00': 'bg-blue-200',
			'08:30': 'bg-yellow-200',
			'09:00': 'bg-green-200',
			'09:15': 'bg-gray-200',
			'10:00': 'bg-green-100',
			'11:00': 'bg-white'
		};

		appointmentsRows.innerHTML = rows.map(r => {
			const fecha = new Date(r.fecha_hora);
			const hhmm = fecha.toTimeString().slice(0,5);
			const name = `${r.nombre} ${r.apellido}`;
			const phones = r.telefono || '';
			const status = r.estado || 'pendiente';
			const motivo = r.motivo || '';
			return `
				<div class="grid grid-cols-[80px_1fr_200px_250px_200px] gap-4 p-4 border-b hover:bg-gray-50 items-center">
					<div class="${timeColors[hhmm] || 'bg-white'} p-2 rounded text-center font-semibold relative">${hhmm}</div>
					<div>
						<div class="font-semibold text-blue-600 hover:underline cursor-pointer" data-paciente-id="${r.paciente_id}">${name}</div>
						<div class="text-sm text-gray-500 flex items-center gap-1">${phones}</div>
					</div>
					<div class="text-gray-700">--</div>
					<div class="text-blue-600">${status}</div>
					<div><button class="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm w-full">${motivo || 'Ver'}</button></div>
				</div>
			`;
		}).join('');

		// Attach click para crear ver paciente
		appointmentsRows.querySelectorAll('[data-paciente-id]').forEach(el => {
			el.addEventListener('click', (e) => {
				const pid = el.dataset.pacienteId;
				// Navegar a ficha del paciente (si existe la vista)
				window.location.href = `../pacientes.html?id=${pid}`;
			});
		});
	}

	// Crear modal simple para elegir paciente y horario
	async function openCreateAppointmentModal(defaultDate) {
		// Fetch pacientes
		let patients = [];
		try {
			patients = await window.api.db.all('SELECT id, nombre, apellido FROM pacientes ORDER BY nombre, apellido');
		} catch (err) {
			return alert('Error al cargar pacientes: ' + err.message);
		}

		// Overlay
		const overlay = document.createElement('div');
		overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

		const modal = document.createElement('div');
		modal.className = 'bg-white rounded shadow-lg p-6 w-96';
		modal.innerHTML = `
			<h3 class="text-lg font-semibold mb-3">Crear nueva cita</h3>
			<label class="text-sm">Paciente</label>
			<select id="selPatient" class="w-full border p-2 rounded mb-3"></select>
			<label class="text-sm">Fecha</label>
			<input id="aptDate" type="date" class="w-full border p-2 rounded mb-3" />
			<label class="text-sm">Hora</label>
			<input id="aptTime" type="time" class="w-full border p-2 rounded mb-3" />
			<label class="text-sm">Motivo</label>
			<input id="aptReason" type="text" class="w-full border p-2 rounded mb-4" placeholder="Motivo (opcional)" />
			<div class="flex justify-end gap-2">
				<button id="cancelApt" class="px-3 py-2 rounded border">Cancelar</button>
				<button id="saveApt" class="px-3 py-2 rounded bg-blue-600 text-white">Crear cita</button>
			</div>
		`;

		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		const selPatient = modal.querySelector('#selPatient');
		patients.forEach(p => {
			const opt = document.createElement('option');
			opt.value = p.id;
			opt.textContent = `${p.nombre} ${p.apellido}`;
			selPatient.appendChild(opt);
		});

		const inpDate = modal.querySelector('#aptDate');
		const inpTime = modal.querySelector('#aptTime');
		const inpReason = modal.querySelector('#aptReason');
		inpDate.value = toSQLDate(defaultDate || new Date());
		inpTime.value = '09:00';

		modal.querySelector('#cancelApt').addEventListener('click', () => overlay.remove());

		modal.querySelector('#saveApt').addEventListener('click', async () => {
			const pacienteId = selPatient.value;
			const fecha = inpDate.value;
			const hora = inpTime.value;
			const motivo = inpReason.value.trim();
			if (!pacienteId || !fecha || !hora) return alert('Seleccione paciente, fecha y hora');

			const fechaHora = `${fecha} ${hora}:00`;
			try {
				await window.api.db.run('INSERT INTO citas (paciente_id, fecha_hora, motivo) VALUES (?, ?, ?)', [pacienteId, fechaHora, motivo]);
				overlay.remove();
				// Si la cita es para la fecha visible, recargar
				if (fecha === toSQLDate(currentDate)) {
					loadAppointmentsFor(currentDate);
				}
				alert('Cita creada correctamente');
			} catch (err) {
				console.error('Error creando cita:', err);
				alert('Error creando cita: ' + err.message);
			}
		});
	}

	// Botón para crear cita (se añade dinámicamente si no existe)
	function ensureCreateButton() {
		const left = container.querySelector('#leftPanel');
		if (!left) return;
		if (!left.querySelector('#createAptBtn')) {
			const btn = document.createElement('button');
			btn.id = 'createAptBtn';
			btn.className = 'px-3 py-2 border rounded bg-green-500 text-white font-medium';
			btn.textContent = 'Crear cita';
			left.insertBefore(btn, left.querySelector('#filtersDiv'));
			btn.addEventListener('click', () => openCreateAppointmentModal(currentDate));
		}
	}

	// Prev / Next day
	if (prevDayBtn) prevDayBtn.addEventListener('click', () => {
		currentDate.setDate(currentDate.getDate() - 1);
		renderDate();
		loadAppointmentsFor(currentDate);
	});
	if (nextDayBtn) nextDayBtn.addEventListener('click', () => {
		currentDate.setDate(currentDate.getDate() + 1);
		renderDate();
		loadAppointmentsFor(currentDate);
	});

	// Mark all button
	if (markAllBtn) markAllBtn.addEventListener('click', () => {
		const checkboxes = filtersDiv.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach(cb => cb.checked = true);
	});

	// Inicializar
	renderFilters();
	renderDate();
	ensureCreateButton();
	await loadAppointmentsFor(currentDate);
}