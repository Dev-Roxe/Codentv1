// Inicializador para la vista diaria
export function initDiaria(container) {
	// Limpiar contenedor
	container.innerHTML = '';
	
	// Crear estructura principal
	const mainDiv = document.createElement('div');
	mainDiv.className = 'flex gap-4 h-full';
	
	// ========== PANEL LATERAL IZQUIERDO ==========
	const leftPanel = document.createElement('div');
	leftPanel.className = 'w-80 bg-white border-r p-6 flex flex-col gap-6';
	
	// Calendario con fecha
	const calendarSection = document.createElement('div');
	calendarSection.className = 'text-center';
	calendarSection.innerHTML = `
		<div class="flex items-center justify-center gap-4 mb-2">
			<button id="prevDay" class="p-2 hover:bg-gray-100 rounded">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
			</button>
			<div>
				<div class="text-7xl font-bold text-gray-800" id="dayNumber">30</div>
				<div class="text-xl text-gray-600" id="monthYear">Junio 2015</div>
			</div>
			<button id="nextDay" class="p-2 hover:bg-gray-100 rounded">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
				</svg>
			</button>
		</div>
		<div class="text-sm text-gray-500 uppercase">Martes</div>
	`;
	
	// Dropdown de dentistas
	const dentistDropdown = document.createElement('div');
	dentistDropdown.innerHTML = `
		<select class="w-full p-2 border rounded bg-white text-gray-700">
			<option>Todos los dentistas</option>
			<option>Dr(a). Gonzalez</option>
			<option>Dr(a). García Muñoz</option>
			<option>Dr(a). Urrutia</option>
		</select>
	`;
	
	// Botón "Marcar todos"
	const markAllBtn = document.createElement('button');
	markAllBtn.className = 'flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium';
	markAllBtn.innerHTML = `
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
		</svg>
		Marcar todos
	`;
	
	// Filtros
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
	
	const filtersDiv = document.createElement('div');
	filtersDiv.className = 'space-y-2';
	
	filters.forEach(filter => {
		const filterItem = document.createElement('label');
		filterItem.className = 'flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded';
		filterItem.innerHTML = `
			<input type="checkbox" ${filter.checked ? 'checked' : ''} 
				class="w-4 h-4 text-blue-500 rounded" data-filter="${filter.id}">
			<span class="text-sm text-gray-700">${filter.label}</span>
		`;
		filtersDiv.appendChild(filterItem);
	});
	
	// Checkbox recarga automática
	const autoReload = document.createElement('div');
	autoReload.className = 'pt-4 border-t';
	autoReload.innerHTML = `
		<label class="flex items-start gap-2 cursor-pointer">
			<input type="checkbox" class="w-4 h-4 mt-0.5 text-blue-500 rounded">
			<div>
				<div class="font-medium text-sm">Recarga automática</div>
				<div class="text-xs text-gray-500">Esta agenda se recarga automáticamente cada minuto</div>
			</div>
		</label>
	`;
	
	// Ensamblar panel izquierdo
	leftPanel.appendChild(calendarSection);
	leftPanel.appendChild(dentistDropdown);
	leftPanel.appendChild(markAllBtn);
	leftPanel.appendChild(filtersDiv);
	leftPanel.appendChild(autoReload);
	
	// ========== PANEL DERECHO - LISTA DE CITAS ==========
	const rightPanel = document.createElement('div');
	rightPanel.className = 'flex-1 overflow-auto';
	
	// Datos de ejemplo basados en la imagen
	const appointments = [
		{
			time: '08:00',
			name: 'Elie Avendaño Madrid',
			phones: '99833-6459 - 99818 9208',
			doctor: 'Dr(a). Gonzalez',
			status: 'Notificado vía email',
			situation: 'No hay saldo',
			situationColor: 'bg-yellow-500'
		},
		{
			time: '08:00',
			name: 'Josefina Barrón',
			phones: '948399433 - 991663115',
			doctor: 'Dr(a). García Muñoz',
			status: 'En sala de espera desde las 14:48',
			situation: 'Diagnóstico',
			situationColor: 'bg-green-600'
		},
		{
			time: '08:30',
			name: 'Fernando Arrue Soto',
			phones: '996053659 - 989116241',
			doctor: 'Dr(a). Urrutia',
			status: 'En sala de espera desde las 13:36',
			situation: 'Deudas',
			situationColor: 'bg-red-600'
		},
		{
			time: '09:00',
			name: 'Miyako Azamoto Yukisho',
			phones: '998189208 - 962335550',
			doctor: 'Dr(a). Urrutia',
			status: 'Atendiéndose',
			situation: 'Diagnóstico',
			situationColor: 'bg-green-600'
		},
		{
			time: '09:15',
			name: 'Fernando Arrue Soto',
			phones: '996053659 - 989116241',
			doctor: 'Dr(a). García Muñoz',
			status: 'Atendido',
			situation: 'Deudas',
			situationColor: 'bg-red-600'
		},
		{
			time: '10:00',
			name: 'Camila Arratia Gutierrez',
			phones: '99818 9208 - 945602009',
			doctor: 'Dr(a). Gonzalez',
			status: 'Atendiéndose',
			situation: 'Hay saldo',
			situationColor: 'bg-green-600'
		},
		{
			time: '10:00',
			name: 'Camila Arratia Gutierrez',
			phones: '99818 9208 - 945602009',
			doctor: 'Dr(a). García Muñoz',
			status: 'No confirmado',
			situation: 'Diagnóstico',
			situationColor: 'bg-green-600'
		},
		{
			time: '10:00',
			name: 'Eduardo Astudillo Espinoza',
			phones: '12549038 - 998189208',
			doctor: 'Dr(a). García Muñoz',
			status: 'No confirmado',
			situation: 'Diagnóstico',
			situationColor: 'bg-green-600',
			special: 'SC'
		},
		{
			time: '11:00',
			name: 'Diana Arriagada Beltran',
			phones: '',
			doctor: 'Dr(a). Gonzalez',
			status: 'Atendido',
			situation: 'Diagnóstico',
			situationColor: 'bg-green-600'
		}
	];
	
	// Crear tabla de citas
	const table = document.createElement('div');
	table.className = 'bg-white';
	
	// Encabezado de tabla
	const header = document.createElement('div');
	header.className = 'grid grid-cols-[80px_1fr_200px_250px_200px] gap-4 p-4 bg-gray-50 border-b font-semibold text-gray-700 text-sm sticky top-0';
	header.innerHTML = `
		<div>Hora</div>
		<div>Paciente</div>
		<div>Doctor</div>
		<div>Estado de la cita</div>
		<div>Situación</div>
	`;
	table.appendChild(header);
	
	// Filas de citas
	appointments.forEach(apt => {
		const row = document.createElement('div');
		row.className = 'grid grid-cols-[80px_1fr_200px_250px_200px] gap-4 p-4 border-b hover:bg-gray-50 items-center';
		
		// Columna hora con color de fondo
		const timeColors = {
			'08:00': 'bg-blue-200',
			'08:30': 'bg-yellow-200',
			'09:00': 'bg-green-200',
			'09:15': 'bg-gray-200',
			'10:00': 'bg-green-100',
			'11:00': 'bg-white'
		};
		
		row.innerHTML = `
			<div class="${timeColors[apt.time] || 'bg-white'} p-2 rounded text-center font-semibold relative">
				${apt.time}
				${apt.special ? `<div class="text-xs text-gray-500 absolute bottom-0 right-1">${apt.special}</div>` : ''}
			</div>
			<div>
				<div class="font-semibold text-blue-600 hover:underline cursor-pointer">${apt.name}</div>
				<div class="text-sm text-gray-500 flex items-center gap-1">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
					</svg>
					${apt.phones}
				</div>
			</div>
			<div class="text-gray-700">${apt.doctor}</div>
			<div class="text-blue-600">${apt.status}</div>
			<div>
				<button class="${apt.situationColor} text-white px-4 py-2 rounded text-sm font-medium w-full hover:opacity-90">
					${apt.situation}
				</button>
			</div>
		`;
		
		table.appendChild(row);
	});
	
	rightPanel.appendChild(table);
	
	// ========== ENSAMBLAR TODO ==========
	mainDiv.appendChild(leftPanel);
	mainDiv.appendChild(rightPanel);
	container.appendChild(mainDiv);
	
	// ========== EVENT LISTENERS ==========
	// Navegación de días
	document.getElementById('prevDay').addEventListener('click', () => {
		console.log('Día anterior');
	});
	
	document.getElementById('nextDay').addEventListener('click', () => {
		console.log('Día siguiente');
	});
	
	// Marcar todos
	markAllBtn.addEventListener('click', () => {
		const checkboxes = filtersDiv.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach(cb => cb.checked = true);
	});
	
	// Filtros
	filtersDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
		cb.addEventListener('change', (e) => {
			console.log('Filtro cambiado:', e.target.dataset.filter, e.target.checked);
		});
	});
}
