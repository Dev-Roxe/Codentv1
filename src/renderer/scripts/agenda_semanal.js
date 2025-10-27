// Inicializador para la vista semanal
export function initSemanal(container) {
	// container: elemento donde se inyectó el fragmento de la vista semanal
	// Aquí puedes construir la cuadrícula semanal y añadir listeners
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-7 gap-2';

	for (let d = 0; d < 7; d++) {
		const col = document.createElement('div');
		col.className = 'p-2 border rounded-lg min-h-[80px]';
		col.innerHTML = `<div class="font-medium text-sm">Día ${d + 1}</div>`;
		grid.appendChild(col);
	}

	const placeholder = container.querySelector('p.text-gray-500');
	if (placeholder) placeholder.replaceWith(grid);
}
