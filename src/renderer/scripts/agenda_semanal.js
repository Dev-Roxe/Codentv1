// Inicializador para la vista semanal
export function initSemanal(container) {
	// Limpiar contenedor
	container.innerHTML = '';
	
	// Crear estructura principal
	const mainDiv = document.createElement('div');
	mainDiv.className = 'flex flex-col h-full bg-gray-50';
	
	// ========== TOOLBAR SUPERIOR ==========
	const toolbar = document.createElement('div');
	toolbar.className = 'bg-white border-b px-6 py-3 flex items-center gap-4';
	toolbar.innerHTML = `
		<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition font-medium">
			Sillón 1
		</button>
		<button class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition">
			Sobre Agendamiento
		</button>
		<div class="flex-1"></div>
		<select class="border rounded px-3 py-2 text-sm">
			<option>Dr(a). Gonzalez, Fernand</option>
			<option>Dr(a). García Muñoz</option>
			<option>Dr(a). Urrutia</option>
		</select>
	`;
	
	// ========== HEADER CON NAVEGACIÓN DE DÍAS ==========
	const headerDiv = document.createElement('div');
	headerDiv.className = 'bg-white border-b shadow-sm sticky top-0 z-20';
	
	const days = [
		{ name: 'Lunes', day: 29, date: '29' },
		{ name: 'Martes', day: 30, date: '30' },
		{ name: 'Miercoles', day: '01', date: '01' },
		{ name: 'Jueves', day: '02', date: '02' },
		{ name: 'Viernes', day: '03', date: '03' },
		{ name: 'Sabado', day: '04', date: '04' },
		{ name: 'Domingo', day: '05', date: '05' }
	];
	
	const navContainer = document.createElement('div');
	navContainer.className = 'flex items-center px-4 py-2';
	
	const prevBtn = document.createElement('button');
	prevBtn.id = 'prevWeek';
	prevBtn.className = 'p-2 hover:bg-gray-100 rounded-lg transition';
	prevBtn.innerHTML = `
		<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
		</svg>
	`;
	
	const daysContainer = document.createElement('div');
	daysContainer.className = 'flex-1 grid grid-cols-7 gap-1 mx-2';
	
	days.forEach((d, idx) => {
		const dayBtn = document.createElement('button');
		dayBtn.className = `text-center px-2 py-3 rounded-lg transition ${
			idx === 1 ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
		}`;
		dayBtn.innerHTML = `
			<div class="text-xs font-medium ${idx === 1 ? 'text-white' : 'text-blue-600'}">${d.name} ${d.day}</div>
		`;
		daysContainer.appendChild(dayBtn);
	});
	
	const nextBtn = document.createElement('button');
	nextBtn.id = 'nextWeek';
	nextBtn.className = 'p-2 hover:bg-gray-100 rounded-lg transition';
	nextBtn.innerHTML = `
		<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
		</svg>
	`;
	
	navContainer.appendChild(prevBtn);
	navContainer.appendChild(daysContainer);
	navContainer.appendChild(nextBtn);
	headerDiv.appendChild(navContainer);
	
	// ========== GRID DE CALENDARIO ==========
	const calendarDiv = document.createElement('div');
	calendarDiv.className = 'flex-1 overflow-auto bg-white';
	
	const gridContainer = document.createElement('div');
	gridContainer.className = 'min-w-max';
	
	// Generar horarios
	const timeSlots = [];
	for (let hour = 8; hour <= 13; hour++) {
		for (let minute = 0; minute < 60; minute += 15) {
			if (hour === 13 && minute > 30) break;
			timeSlots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
		}
	}
	
	// Citas con más detalle
	const appointments = {
		'Lunes 29': {},
		'Martes 30': {
			'08:00': { name: 'Elie Avendañ...', color: 'bg-blue-200 border-blue-400', icon: true },
			'10:00': { name: 'Camila Arrati...', color: 'bg-green-200 border-green-400', icon: true },
			'11:00': { name: 'Diana Arriag...', color: 'bg-gray-200 border-gray-400', icon: true }
		},
		'Miercoles 01': {
			'08:00': { name: 'Ariana Aguirr...', color: 'bg-blue-200 border-blue-400', icon: true },
			'08:30': { name: 'Alexandra H...', color: 'bg-blue-200 border-blue-400', icon: true },
			'09:30': { name: 'Claudia Arm...', color: 'bg-blue-200 border-blue-400', icon: true },
			'09:45': { name: 'Vanessa Aspr...', color: 'bg-blue-200 border-blue-400', icon: true },
			'12:00': { name: 'Cristopher Bl...', color: 'bg-gray-200 border-gray-400', icon: true }
		},
		'Jueves 02': {
			'08:00': { name: 'Adriana Cam...', color: 'bg-gray-200 border-gray-400', icon: true },
			'10:00': { name: 'Eduardo Ast...', color: 'bg-gray-200 border-gray-400', icon: true }
		},
		'Viernes 03': {},
		'Sabado 04': {},
		'Domingo 05': {}
	};
	
	// Grid principal
	const grid = document.createElement('div');
	grid.className = 'grid gap-0';
	grid.style.gridTemplateColumns = '70px repeat(7, minmax(140px, 1fr))';
	
	// Header de días
	const emptyCorner = document.createElement('div');
	emptyCorner.className = 'bg-gray-50 border-r border-b sticky left-0 top-0 z-30';
	grid.appendChild(emptyCorner);
	
	days.forEach((day, idx) => {
		const dayHeader = document.createElement('div');
		dayHeader.className = `border-r border-b font-semibold text-center py-3 text-sm sticky top-0 z-20 ${
			idx === 1 ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
		}`;
		dayHeader.textContent = `${day.name} ${day.day}`;
		grid.appendChild(dayHeader);
	});
	
	// Filas de horarios
	timeSlots.forEach(time => {
		// Columna de hora
		const timeCell = document.createElement('div');
		timeCell.className = 'border-r border-b bg-gray-50 text-xs text-gray-600 text-right pr-3 py-4 font-medium sticky left-0 z-10';
		timeCell.textContent = time;
		grid.appendChild(timeCell);
		
		// Celdas de cada día
		days.forEach(day => {
			const cell = document.createElement('div');
			cell.className = 'border-r border-b relative group transition min-h-[56px]';
			
			const dayKey = `${day.name} ${day.day}`;
			const apt = appointments[dayKey]?.[time];
			
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
			
			cell.dataset.day = dayKey;
			cell.dataset.time = time;
			grid.appendChild(cell);
		});
	});
	
	gridContainer.appendChild(grid);
	calendarDiv.appendChild(gridContainer);
	
	// ========== ENSAMBLAR ==========
	mainDiv.appendChild(toolbar);
	mainDiv.appendChild(headerDiv);
	mainDiv.appendChild(calendarDiv);
	container.appendChild(mainDiv);
	
	// ========== EVENTS ==========
	prevBtn.addEventListener('click', () => console.log('Semana anterior'));
	nextBtn.addEventListener('click', () => console.log('Semana siguiente'));
	
	grid.querySelectorAll('[data-day]').forEach(cell => {
		cell.addEventListener('click', (e) => {
			if (e.target.closest('button')) return;
			const hasAppointment = cell.querySelector('span');
			console.log(hasAppointment ? 'Ver cita' : 'Nueva cita', {
				day: cell.dataset.day,
				time: cell.dataset.time
			});
		});
	});
	
	daysContainer.querySelectorAll('button').forEach((btn, idx) => {
		btn.addEventListener('click', () => {
			daysContainer.querySelectorAll('button').forEach(b => {
				b.className = 'text-center px-2 py-3 rounded-lg transition hover:bg-gray-100';
				b.querySelector('div').className = 'text-xs font-medium text-blue-600';
			});
			btn.className = 'text-center px-2 py-3 rounded-lg transition bg-blue-500 text-white';
			btn.querySelector('div').className = 'text-xs font-medium text-white';
			console.log('Cambiar a día:', days[idx]);
		});
	});
}