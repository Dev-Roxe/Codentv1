// Inicializador para la vista diaria
export function initDiaria(container) {
	// container: elemento donde se inyectó el fragmento de la vista diaria
	// Aquí puedes poblar la lista de citas y añadir listeners específicos
	const list = document.createElement('div');
	list.className = 'space-y-3';

	// Ejemplo: crear 3 items mock
	for (let i = 9; i <= 11; i++) {
		const item = document.createElement('div');
		item.className = 'p-3 border rounded-lg flex justify-between items-center';
		item.innerHTML = `
			<div>
				<div class="font-semibold">Paciente ${i}</div>
				<div class="text-sm text-gray-500">Tratamiento ejemplo</div>
			</div>
			<div class="text-sm text-gray-600">${i}:00</div>
		`;
		list.appendChild(item);
	}

	// Insertar o reemplazar contenido de container después del placeholder
	const placeholder = container.querySelector('p.text-gray-500');
	if (placeholder) placeholder.replaceWith(list);

	// Añadir listeners específicos si es necesario
}
