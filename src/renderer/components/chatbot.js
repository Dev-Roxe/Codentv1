// chatbot.js
import toast from '../scripts/toast.js';

class SupportChatbot extends HTMLElement {
    constructor() {
        super();
        this.isOpen = false;
        this.step = 'menu';
        this.faqs = [
            { question: '¿Cómo agendar una cita?', answer: 'Ve a la pestaña "Agenda" y haz clic en la línea de tiempo, o utiliza el botón "+" de crear cita.' },
            { question: '¿Cómo crear y guardar tratamientos?', answer: 'Desde la Ficha Clínica del paciente, ve a "Planes de Tratamiento" para presupuestos completos, o a la pestaña "Tratamientos" (y Odontograma) para registrarlos inmediatamente.' },
            { question: '¿Dónde veo facturas e ingresos?', answer: 'Ve a la pestaña "Cajas" o presiona "Financiero -> Pagos y Recaudación" en la Ficha del Paciente para registrar el dinero. Los análisis completos están en "Reportes".' }
        ];
    }

    connectedCallback() {
        this.render();
        this.attachEvents();
    }

    render() {
        this.innerHTML = `
            <style>
                #support-bot-container {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 999999; /* Ensure it's above everything */
                    font-family: inherit;
                }
                #support-bot-bubble {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background-color: #4EABBE;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(78, 171, 190, 0.4);
                    cursor: pointer;
                    transition: transform 0.2s, background-color 0.2s;
                }
                #support-bot-bubble:hover {
                    transform: scale(1.05);
                    background-color: #1D5D69;
                }
                #support-bot-window {
                    display: none;
                    position: absolute;
                    bottom: 80px;
                    right: 0;
                    width: 320px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    overflow: hidden;
                    flex-direction: column;
                    transform: translateY(20px);
                    opacity: 0;
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
                }
                #support-bot-window.open {
                    transform: translateY(0);
                    opacity: 1;
                }
                .dark #support-bot-window {
                    background: #101F2E;
                    border-color: #1e293b;
                }
                #support-bot-header {
                    background-color: #4EABBE;
                    color: white;
                    padding: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #support-bot-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }
                #support-bot-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 4px;
                }
                #support-bot-content {
                    padding: 16px;
                    max-height: 400px;
                    min-height: 250px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    scroll-behavior: smooth;
                }
                #support-bot-content::-webkit-scrollbar {
                    width: 6px;
                }
                #support-bot-content::-webkit-scrollbar-track {
                    background: transparent;
                }
                #support-bot-content::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 10px;
                }
                .dark #support-bot-content::-webkit-scrollbar-thumb {
                    background-color: #334155;
                }
                .bot-msg {
                    background: #f1f5f9;
                    color: #0F2532;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border-bottom-left-radius: 4px;
                    font-size: 14px;
                    align-self: flex-start;
                    max-width: 85%;
                }
                .dark .bot-msg {
                    background: #1e293b;
                    color: #f8fafc;
                }
                .user-msg {
                    background: #8BCFDD;
                    color: #0F2532;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border-bottom-right-radius: 4px;
                    font-size: 14px;
                    align-self: flex-end;
                    max-width: 85%;
                }
                .dark .user-msg {
                    background: #4EABBE;
                    color: #f8fafc;
                }
                .faq-btn {
                    background: white;
                    border: 1px solid #8BCFDD;
                    color: #1D5D69;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                    width: 100%;
                }
                .dark .faq-btn {
                    background: #0E1A25;
                    border-color: #334155;
                    color: #8BCFDD;
                }
                .faq-btn:hover {
                    background: #f8fafc;
                    border-color: #4EABBE;
                }
                .dark .faq-btn:hover {
                    background: #1e293b;
                }
                .support-form {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-top: 10px;
                }
                .support-form textarea {
                    width: 100%;
                    min-height: 80px;
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    font-size: 14px;
                    resize: vertical;
                    background: white;
                    color: #0f172a;
                }
                .dark .support-form textarea {
                    background: #0E1A25;
                    border-color: #334155;
                    color: #f8fafc;
                }
                .support-btn {
                    background: #4EABBE;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 10px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .support-btn:hover {
                    background: #1D5D69;
                }
                .back-btn {
                    background: transparent;
                    color: #64748b;
                    border: none;
                    font-size: 13px;
                    cursor: pointer;
                    text-decoration: underline;
                    margin-top: 8px;
                    text-align: center;
                }
                @keyframes botPulse {
                    0% { box-shadow: 0 0 0 0 rgba(78, 171, 190, 0.7); }
                    70% { box-shadow: 0 0 0 15px rgba(78, 171, 190, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(78, 171, 190, 0); }
                }
                #support-bot-bubble.pulse {
                    animation: botPulse 2s infinite;
                }
                .typing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 12px 14px;
                    background: #f1f5f9;
                    border-radius: 12px;
                    border-bottom-left-radius: 4px;
                    width: fit-content;
                }
                .dark .typing-indicator {
                    background: #1e293b;
                }
                .typing-dot {
                    width: 6px;
                    height: 6px;
                    background-color: #94a3b8;
                    border-radius: 50%;
                    animation: typingFade 1.4s infinite ease-in-out both;
                }
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }
                @keyframes typingFade {
                    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1); }
                }
            </style>
            <div id="support-bot-container">
                <div id="support-bot-window">
                    <div id="support-bot-header">
                        <h3>Soporte Técnico</h3>
                        <button id="support-bot-close" title="Cerrar">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div id="support-bot-content">
                    </div>
                </div>
                <div id="support-bot-bubble" class="pulse" title="Obtener ayuda">
                    <svg width="30" height="30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                </div>
            </div>
        `;
    }

    attachEvents() {
        this.bubble = this.querySelector('#support-bot-bubble');
        this.win = this.querySelector('#support-bot-window');
        this.closeBtn = this.querySelector('#support-bot-close');
        this.content = this.querySelector('#support-bot-content');

        this.bubble.addEventListener('click', () => this.toggleChat());
        this.closeBtn.addEventListener('click', () => this.toggleChat(false));

        this.renderMenu();
    }

    toggleChat(forceState) {
        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        
        if (this.isOpen) {
            this.win.style.display = 'flex';
            this.bubble.classList.remove('pulse'); // Parar animación al abrir
            // Pequeño timeout para permitir reflow y animar
            requestAnimationFrame(() => {
                this.win.classList.add('open');
            });
            if (this.step === 'menu') {
                this.renderMenu();
            }
        } else {
            this.win.classList.remove('open');
            // Ocultar después de la animación
            setTimeout(() => {
                if (!this.isOpen) this.win.style.display = 'none';
            }, 300);
        }
    }

    renderMenu() {
        this.step = 'menu';
        this.content.innerHTML = `
            <div class="bot-msg">¡Hola! Soy el asistente de soporte. ¿En qué te puedo ayudar hoy?</div>
        `;

        this.faqs.forEach((faq, index) => {
            const btn = document.createElement('button');
            btn.className = 'faq-btn';
            btn.innerText = faq.question;
            btn.onclick = () => this.showAnswer(index);
            this.content.appendChild(btn);
        });

        const btnMajor = document.createElement('button');
        btnMajor.className = 'faq-btn';
        btnMajor.style.borderColor = '#ef4444';
        btnMajor.style.color = '#ef4444';
        btnMajor.innerText = '⚠️ Tengo un problema mayor';
        btnMajor.onclick = () => this.showSupportForm();
        this.content.appendChild(btnMajor);
    }

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        this.content.innerHTML += `
            <div id="${id}" class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        this.scrollToBottom();
        return id;
    }

    removeTypingIndicator(id) {
        const el = this.querySelector('#' + id);
        if (el) el.remove();
    }

    showAnswer(index) {
        const faq = this.faqs[index];
        this.content.innerHTML += `<div class="user-msg">${faq.question}</div>`;
        this.scrollToBottom();

        const typingId = this.showTypingIndicator();

        setTimeout(() => {
            this.removeTypingIndicator(typingId);
            this.content.innerHTML += `<div class="bot-msg">${faq.answer}</div>`;
            
            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerText = 'Volver al menú principal';
            backBtn.onclick = () => this.renderMenu();
            this.content.appendChild(backBtn);
            
            this.scrollToBottom();
        }, 800);
    }

    showSupportForm() {
        this.step = 'form';
        this.content.innerHTML += `<div class="user-msg">Tengo un problema mayor</div>`;
        this.scrollToBottom();

        const typingId = this.showTypingIndicator();

        setTimeout(() => {
            this.removeTypingIndicator(typingId);
            this.content.innerHTML += `
                <div class="bot-msg">Por favor, describe tu problema detalladamente. Enviaremos un correo directo a <strong>roxedev@gmail.com</strong> utilizando la cuenta de la clínica.</div>
            `;

            const formDiv = document.createElement('div');
            formDiv.className = 'support-form';
            
            const textarea = document.createElement('textarea');
            textarea.placeholder = 'Describe el error o problema aquí...';
            textarea.id = 'support-incident-msg';

            const submitBtn = document.createElement('button');
            submitBtn.className = 'support-btn';
            submitBtn.innerText = 'Enviar Reporte a Roxe';
            submitBtn.onclick = () => this.sendSupportEmail(textarea.value);

            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerText = 'Cancelar';
            backBtn.onclick = () => this.renderMenu();

            formDiv.appendChild(textarea);
            formDiv.appendChild(submitBtn);
            formDiv.appendChild(backBtn);

            this.content.appendChild(formDiv);
            this.scrollToBottom();
            
            // Auto-focus the textarea
            setTimeout(() => textarea.focus(), 50);
        }, 600);
    }

    async sendSupportEmail(message) {
        if (!message.trim()) {
            toast.show('Por favor escribe un mensaje', 'warning');
            return;
        }

        const submitBtn = this.querySelector('.support-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Enviando...';
        }

        try {
            // Check if gmail token exists before attempting to send
            if (window.electronAPI && window.electronAPI.invoke) {
                const gmailReady = await window.electronAPI.invoke('gmail-has-token');
                if (!gmailReady || !gmailReady.connected) {
                    toast.show('No hay cuenta de Gmail conectada a la clínica. El correo no se puede enviar.', 'error');
                    throw new Error('Cuenta de Gmail no conectada en Configuración.');
                }
            }

            let userInfo = 'Usuario desconocido';
            try {
                const session = JSON.parse(localStorage.getItem('sesionActual') || '{}');
                if (session.email) {
                    userInfo = session.email + (session.nombre ? ` (${session.nombre})` : '');
                }
            } catch (e) {}

            const html = `
                <h2>Nuevo Reporte de Soporte Odontológico</h2>
                <p><strong>Usuario / Clínica:</strong> ${userInfo}</p>
                <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
                <h3>Mensaje del usuario:</h3>
                <p style="background: #f4f4f4; padding: 15px; border-left: 4px solid #ef4444; border-radius: 4px;">${message.replace(/\n/g, '<br>')}</p>
            `;

            if (window.electronAPI && window.electronAPI.invoke) {
                const result = await window.electronAPI.invoke('gmail-send', {
                    to: 'roxedev@gmail.com',
                    subject: 'Soporte Urgente - Aplicación de Clínica',
                    html: html
                });

                if (result && result.success) {
                    this.content.innerHTML += `
                        <div class="user-msg">${message}</div>
                        <div class="bot-msg">✅ Tu reporte ha sido enviado con éxito a <strong>roxedev@gmail.com</strong>. Te contactaremos pronto.</div>
                    `;
                } else {
                    throw new Error(result?.error || 'Error enviando el correo.');
                }
            } else {
                throw new Error('La API de correo electrónico no está disponible.');
            }
        } catch (error) {
            console.error('Error enviando soporte:', error);
            this.content.innerHTML += `
                <div class="bot-msg" style="color: #ef4444;">❌ No se pudo enviar el correo: <strong>${error.message}</strong> <br><br> Por favor revisa que tengas Gmail conectado en Configuración e inténtalo de nuevo.</div>
            `;
        }

        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerText = 'Volver al menú principal';
        backBtn.style.marginTop = '15px';
        backBtn.onclick = () => this.renderMenu();
        this.content.appendChild(backBtn);

        this.scrollToBottom();
    }

    scrollToBottom() {
        setTimeout(() => {
            this.content.scrollTop = this.content.scrollHeight;
        }, 10);
    }
}

// Only define if not already defined
if (!customElements.get('support-chatbot')) {
    customElements.define('support-chatbot', SupportChatbot);
}
