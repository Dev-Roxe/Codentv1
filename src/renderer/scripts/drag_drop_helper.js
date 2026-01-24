// Funciones de Drag & Drop para Agenda Diaria
// Agregar después de la función updateStats() en agenda_diaria.js

// Habilitar Drag & Drop
function enableDragDrop() {
    const container = $('#appointmentsContainer');
    if (!container) return;

    const appointmentCards = container.querySelectorAll('[data-apt-id]');

    appointmentCards.forEach(card => {
        card.draggable = true;
        card.style.cursor = 'move';

        card.addEventListener('dragstart', (e) => {
            const aptId = parseInt(card.dataset.aptId);
            draggedAppointment = appointments.find(a => a.id === aptId);
            card.classList.add('opacity-50', 'scale-95');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', aptId);
        });

        card.addEventListener('dragend', (e) => {
            card.classList.remove('opacity-50', 'scale-95');
        });
    });

    // Hacer el grid un drop zone
    const grid = $('#appointmentsGrid');
    if (grid) {
        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        grid.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (!draggedAppointment) return;

            // Calcular nueva hora basada en posición del drop
            const rect = grid.getBoundingClientRect();
            const scrollTop = document.querySelector('#timelineScroll')?.scrollTop || 0;
            const y = e.clientY - rect.top + scrollTop;
            const totalMinutes = (y / HOUR_HEIGHT) * 60;
            const newHour = START_HOUR + Math.floor(totalMinutes / 60);
            const newMinutes = Math.round((totalMinutes % 60) / config.appointmentInterval) * config.appointmentInterval;

            // Validar horario laboral
            if (newHour < START_HOUR || newHour >= END_HOUR) {
                alert('⚠️ La hora está fuera del horario laboral');
                draggedAppointment = null;
                return;
            }

            // Crear nueva fecha/hora
            const oldDateTime = new Date(draggedAppointment.fecha_hora);
            const newDateTime = new Date(oldDateTime);
            newDateTime.setHours(newHour, newMinutes, 0, 0);

            const oldTime = `${String(oldDateTime.getHours()).padStart(2, '0')}:${String(oldDateTime.getMinutes()).padStart(2, '0')}`;
            const newTime = `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;

            if (confirm(`¿Mover cita de ${oldTime} a ${newTime}?`)) {
                try {
                    await window.api.db.run(
                        'UPDATE citas SET fecha_hora = ? WHERE id = ?',
                        [newDateTime.toISOString().slice(0, 19).replace('T', ' '), draggedAppointment.id]
                    );
                    await loadAppointments();
                } catch (err) {
                    console.error('Error:', err);
                    alert('❌ Error al mover la cita');
                }
            }

            draggedAppointment = null;
        });
    }
}

// IMPORTANTE: Agregar esta llamada al final de renderAppointments():
// enableDragDrop();
