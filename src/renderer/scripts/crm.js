// CRM front-end logic moved from crm.html
// Manejo de tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Remover clases activas
        tabBtns.forEach(b => {
            b.classList.remove('active', 'border-[#4EABBE]', 'text-[#4EABBE]', 'font-semibold', 'border-b-2');
            b.classList.add('text-gray-500', 'hover:text-gray-700', 'font-medium');
        });

        // Agregar clases activas al botón clickeado
        btn.classList.add('active', 'border-[#4EABBE]', 'text-[#4EABBE]', 'font-semibold', 'border-b-2');
        btn.classList.remove('text-gray-500', 'hover:text-gray-700', 'font-medium');

        // Ocultar todos los tabs
        tabContents.forEach(content => content.classList.add('hidden'));

        // Mostrar el tab seleccionado
        const el = document.getElementById(`${targetTab}-tab`);
        if (el) el.classList.remove('hidden');
    });
});

// ========== CONTADOR DE CARACTERES SMS ==========
const smsText = document.getElementById('smsText');
const charCount = document.getElementById('char-count');
const smsPreview = document.getElementById('smsPreview');

if (smsText) {
    smsText.addEventListener('input', (e) => {
        const count = e.target.value.length;
        if (charCount) charCount.textContent = count;
        if (smsPreview) smsPreview.textContent = e.target.value || 'Escribe tu mensaje para ver la vista previa...';
    });
}

// ========== EMAIL MARKETING - ENVÍO MASIVO ==========
const emailRecipients = document.getElementById('emailRecipients');
const recipientCount = document.getElementById('recipientCount');
const emailSubject = document.getElementById('emailSubject');
const emailMessage = document.getElementById('emailMessage');
const previewEmailBtn = document.getElementById('previewEmailBtn');
const sendBulkEmailBtn = document.getElementById('sendBulkEmailBtn');
const emailStatus = document.getElementById('emailStatus');
const emailStatusText = document.getElementById('emailStatusText');
const emailProgress = document.getElementById('emailProgress');
const insertNameVar = document.getElementById('insertNameVar');
const insertDateVar = document.getElementById('insertDateVar');
const insertDoctorVar = document.getElementById('insertDoctorVar');

// Almacenar pacientes cargados
let currentPatients = [];

/**
 * Carga la lista de pacientes según el grupo seleccionado
 */
async function loadPatients(group) {
    try {
        const patients = await window.electronAPI.invoke('get-patients', { group });
        currentPatients = patients;

        if (patients.length > 0) {
            recipientCount.textContent = ` ${patients.length} ${group === 'all' ? 'pacientes' : 'pacientes seleccionados'}`;
            sendBulkEmailBtn.disabled = false;
        } else {
            recipientCount.textContent = ' No hay pacientes en este grupo';
            sendBulkEmailBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error cargando pacientes:', error);
        recipientCount.textContent = ` Error: ${error.message}`;
        sendBulkEmailBtn.disabled = true;
    }
}

// Cambiar grupo de destinatarios
if (emailRecipients) {
    emailRecipients.addEventListener('change', (e) => {
        const group = e.target.value;
        if (group) {
            loadPatients(group);
        } else {
            currentPatients = [];
            recipientCount.textContent = ' Selecciona un grupo';
            sendBulkEmailBtn.disabled = true;
        }
    });
}

// Insertar variables en el mensajefeat: Implementar sistema completo de envío masivo de emails
if (insertNameVar) {
    insertNameVar.addEventListener('click', (e) => {
        e.preventDefault();
        emailMessage.value += '{nombre}';
    });
}

if (insertDateVar) {
    insertDateVar.addEventListener('click', (e) => {
        e.preventDefault();
        emailMessage.value += '{fecha_cita}';
    });
}

if (insertDoctorVar) {
    insertDoctorVar.addEventListener('click', (e) => {
        e.preventDefault();
        emailMessage.value += '{doctor}';
    });
}

// Vista previa del email
if (previewEmailBtn) {
    previewEmailBtn.addEventListener('click', () => {
        const subject = emailSubject ? emailSubject.value : '';
        const message = emailMessage ? emailMessage.value : '';
        const preview = `ASUNTO:\n${subject || '(sin asunto)'}\n\n---\n\nMENSAJE:\n${message || '(sin mensaje)'}`;
        alert(preview);
    });
}

// Enviar emails masivos
if (sendBulkEmailBtn) {
    sendBulkEmailBtn.addEventListener('click', async () => {
        const subject = emailSubject ? emailSubject.value.trim() : '';
        const body = emailMessage ? emailMessage.value.trim() : '';

        if (!subject || !body) {
            alert('Por favor completa el asunto y el mensaje');
            return;
        }

        if (currentPatients.length === 0) {
            alert('Selecciona un grupo de pacientes');
            return;
        }

        // Confirmar envío
        const confirmSend = confirm(
            `¿Enviar email a ${currentPatients.length} pacientes?\n\nAsunto: ${subject}`
        );
        if (!confirmSend) return;

        try {
            // Mostrar barra de progreso
            emailStatus.classList.remove('hidden');
            emailStatusText.textContent = 'Iniciando envío...';
            emailProgress.style.width = '0%';
            sendBulkEmailBtn.disabled = true;

            // Preparar recipients
            const recipients = currentPatients.map(p => ({
                email: p.email,
                nombre: p.nombre || '',
                fecha_cita: p.fecha_nacimiento || '',
                doctor: p.doctor || '',
            }));

            // Enviar
            const result = await window.electronAPI.invoke('send-bulk-email', {
                recipients,
                subject,
                body,
            });

            if (result.success) {
                emailStatusText.textContent = `✅ Enviado: ${result.sent}/${currentPatients.length} emails`;
                emailProgress.style.width = '100%';
                alert(`✅ Envío completado!\n\n✓ Enviados: ${result.sent}\n✗ Errores: ${result.failed}`);

                // Limpiar formulario
                emailSubject.value = '';
                emailMessage.value = '';
                emailRecipients.value = '';
                currentPatients = [];
                recipientCount.textContent = '📊 Selecciona un grupo';
            } else {
                emailStatusText.textContent = `❌ Error: ${result.error}`;
                alert(`Error al enviar: ${result.error}`);
            }
        } catch (error) {
            console.error('Error:', error);
            emailStatusText.textContent = `❌ Error: ${error.message}`;
            alert(`Error: ${error.message}`);
        } finally {
            sendBulkEmailBtn.disabled = currentPatients.length === 0;
        }
    });
}

// Escuchar actualizaciones de progreso desde el main process
if (window.electronAPI) {
    window.electronAPI.on('email-progress', (data) => {
        const percentage = (data.current / data.total) * 100;
        emailProgress.style.width = `${percentage}%`;
        emailStatusText.textContent = `Enviando: ${data.current}/${data.total}...`;
    });
}

// Export nada (módulo para future extend)
export { };
