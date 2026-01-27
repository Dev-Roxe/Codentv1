// Importar componentes
import '../components/navbar-component.js';
import toast from './toast.js';

// Inicializar dark mode desde localStorage
const initializeDarkMode = () => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Si está en auto y no hay preferencia guardada, o si es explícitamente dark
    const root = document.documentElement;
    if (isDark) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

const safeParseJSON = (value, fallback = {}) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (err) {
        console.warn('[init] JSON inválido en app_settings:', err);
        return fallback;
    }
};

const applyFontSize = (fontSize) => {
    const root = document.documentElement;
    const sizes = {
        small: '14px',
        medium: '16px',
        large: '18px'
    };
    root.style.fontSize = sizes[fontSize] || sizes.medium;
    root.dataset.fontSize = fontSize || 'medium';
};

const applyCompactMode = (isCompact) => {
    const root = document.documentElement;
    root.classList.toggle('compact-mode', !!isCompact);
};

const applyDateFormat = (dateFormat) => {
    if (dateFormat) {
        document.documentElement.dataset.dateFormat = dateFormat;
    }
};

const initializePreferences = () => {
    const settings = safeParseJSON(localStorage.getItem('app_settings'), {});
    applyFontSize(settings.fontSize);
    applyCompactMode(settings.compactMode);
    applyDateFormat(settings.dateFormat);
    return settings;
};

const NOTIF_DEFAULTS = {
    notifCitas: true,
    notifEmail: true,
    notifSound: true,
    reminderTime: '15',
    timeFormat: '24h'
};

const getNotificationSettings = () => {
    const settings = safeParseJSON(localStorage.getItem('app_settings'), {});
    return {
        ...NOTIF_DEFAULTS,
        ...(settings || {})
    };
};

const parseLocalDateTime = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const normalized = value.includes('T') ? value : value.replace(' ', 'T');
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
};

const formatTime = (date, timeFormat) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (timeFormat === '12h') {
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatFullDate = (date) => {
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

let notifiedKeys = new Set();
let lastEmailWarningShown = false;
let gmailAvailable = null;
let cachedUserEmail = null;
let cachedUserName = null;
let notificationIntervalId = null;

const loadNotifiedKeys = () => {
    try {
        const stored = sessionStorage.getItem('notified_appointments');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                notifiedKeys = new Set(parsed);
            }
        }
    } catch (e) { }
};

const saveNotifiedKeys = () => {
    try {
        sessionStorage.setItem('notified_appointments', JSON.stringify(Array.from(notifiedKeys)));
    } catch (e) { }
};

const playNotificationSound = () => {
    try {
        // Intentar reproducir el archivo de audio personalizado
        const audio = new Audio('../assets/sounds/notification.mp3');
        audio.volume = 0.7; // Volumen al 70%

        audio.play().catch((error) => {
            console.warn('No se pudo reproducir el audio personalizado, usando sonido sintetizado:', error);

            // Fallback: usar sonido sintetizado si el archivo no existe
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();

                // Crear dos tonos para una melodía más agradable
                const playTone = (frequency, startTime, duration) => {
                    const oscillator = ctx.createOscillator();
                    const gain = ctx.createGain();

                    oscillator.type = 'sine';
                    oscillator.frequency.value = frequency;

                    // Volumen más alto y con fade out
                    gain.gain.setValueAtTime(0.3, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                    oscillator.connect(gain);
                    gain.connect(ctx.destination);

                    oscillator.start(startTime);
                    oscillator.stop(startTime + duration);
                };

                // Melodía de dos tonos: Do (523 Hz) y Mi (659 Hz)
                playTone(523, ctx.currentTime, 0.2);
                playTone(659, ctx.currentTime + 0.2, 0.3);

                // Cerrar el contexto después de que termine
                setTimeout(() => {
                    if (ctx && ctx.state !== 'closed') ctx.close();
                }, 600);
            } catch (e) {
                console.error('Error al reproducir sonido sintetizado:', e);
            }
        });
    } catch (e) {
        console.error('Error al reproducir sonido:', e);
    }
};

const getCurrentUser = async () => {
    // Always check localStorage first for fresh session data
    let session = null;
    try {
        session = JSON.parse(localStorage.getItem('sesionActual') || '{}');
    } catch (e) {
        session = {};
    }

    // If session has email, use it directly
    if (session?.email && session?.nombre) {
        cachedUserEmail = session.email;
        cachedUserName = session.nombre;
        return { email: cachedUserEmail, nombre: cachedUserName };
    }

    // Otherwise, try to get from database
    const userId = session?.id;
    if (!userId || !window.api?.db?.get) {
        cachedUserEmail = session?.email || null;
        cachedUserName = session?.nombre || null;
        return { email: cachedUserEmail, nombre: cachedUserName };
    }

    try {
        const row = await window.api.db.get('SELECT nombre, apellido, email FROM usuarios WHERE id = ?', [userId]);
        const nombre = row ? [row.nombre, row.apellido].filter(Boolean).join(' ').trim() : session?.nombre || '';
        cachedUserEmail = row?.email || session?.email || null;
        cachedUserName = nombre || session?.nombre || null;

        // Update session with email if found
        if (row?.email && !session.email) {
            session.email = row.email;
            try {
                localStorage.setItem('sesionActual', JSON.stringify(session));
            } catch (e) { }
        }
    } catch (e) {
        cachedUserEmail = session?.email || null;
        cachedUserName = session?.nombre || null;
    }

    return { email: cachedUserEmail, nombre: cachedUserName };
};

const ensureGmailAvailable = async () => {
    if (gmailAvailable !== null) return gmailAvailable;
    if (!window.electronAPI?.invoke) {
        gmailAvailable = false;
        return gmailAvailable;
    }
    try {
        const res = await window.electronAPI.invoke('gmail-has-token');
        gmailAvailable = !!res?.connected;
    } catch (e) {
        gmailAvailable = false;
    }
    return gmailAvailable;
};

const sendEmailNotification = async (appointment, settings) => {
    if (!window.electronAPI?.invoke) return;

    const gmailReady = await ensureGmailAvailable();
    if (!gmailReady) {
        if (!lastEmailWarningShown) {
            toast.show('Conecta Gmail para enviar notificaciones por email.', 'warning');
            lastEmailWarningShown = true;
        }
        return;
    }

    const user = await getCurrentUser();
    if (!user?.email) {
        if (!lastEmailWarningShown) {
            toast.show('No hay email configurado para el usuario actual.', 'warning');
            lastEmailWarningShown = true;
        }
        return;
    }

    const aptDate = parseLocalDateTime(appointment.fecha_hora);
    if (!aptDate) return;

    const patientName = `${appointment.nombre || ''} ${appointment.apellido || ''}`.trim() || 'Paciente';
    const dentistName = appointment.dentista_nombre
        ? `Dr(a). ${appointment.dentista_nombre} ${appointment.dentista_apellido || ''}`.trim()
        : 'Sin asignar';
    const timeLabel = formatTime(aptDate, settings.timeFormat);
    const dateLabel = formatFullDate(aptDate);
    const motivo = appointment.motivo || 'Sin motivo';

    const subject = `Recordatorio de cita • ${patientName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
            <h2 style="color:#1D5D69;">Recordatorio de cita</h2>
            <p>Hola ${user.nombre || 'equipo'},</p>
            <p>Tienes una cita próxima:</p>
            <ul>
                <li><strong>Paciente:</strong> ${patientName}</li>
                <li><strong>Fecha:</strong> ${dateLabel}</li>
                <li><strong>Hora:</strong> ${timeLabel}</li>
                <li><strong>Motivo:</strong> ${motivo}</li>
                <li><strong>Dentista:</strong> ${dentistName}</li>
            </ul>
            <p>Este es un recordatorio automático generado por Sonalía.</p>
        </div>
    `;

    try {
        await window.electronAPI.invoke('gmail-send', { to: user.email, subject, html });
    } catch (e) {
        if (!lastEmailWarningShown) {
            toast.show('No se pudo enviar la notificación por email.', 'error');
            lastEmailWarningShown = true;
        }
    }
};

const pollAppointmentReminders = async () => {
    const settings = getNotificationSettings();
    if (!settings.notifCitas) return;
    if (!window.api?.db?.all) return;

    const reminderMinutesRaw = parseInt(settings.reminderTime, 10);
    const reminderMinutes = Number.isFinite(reminderMinutesRaw) ? Math.max(1, reminderMinutesRaw) : 15;
    const windowMinutes = Math.max(1, reminderMinutes);

    let rows = [];
    try {
        rows = await window.api.db.all(
            `SELECT c.id, c.fecha_hora, c.motivo, c.estado,
                    p.nombre, p.apellido, p.email,
                    u.nombre as dentista_nombre, u.apellido as dentista_apellido
             FROM citas c
             JOIN pacientes p ON p.id = c.paciente_id
             LEFT JOIN usuarios u ON u.id = c.dentista_id
             WHERE datetime(c.fecha_hora) BETWEEN datetime('now','localtime')
               AND datetime('now','localtime', ?)
               AND (c.estado IS NULL OR c.estado NOT IN ('cancelado','no-asiste'))
             ORDER BY c.fecha_hora ASC`,
            [`+${windowMinutes} minutes`]
        );
    } catch (e) {
        return;
    }

    const now = new Date();
    rows.forEach((apt) => {
        const aptDate = parseLocalDateTime(apt.fecha_hora);
        if (!aptDate) return;
        const diffMs = aptDate - now;
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 0 || diffMin > reminderMinutes) return;

        const key = `${apt.id}|${apt.fecha_hora}|${reminderMinutes}`;
        if (notifiedKeys.has(key)) return;

        notifiedKeys.add(key);
        saveNotifiedKeys();

        const timeLabel = formatTime(aptDate, settings.timeFormat);
        const patientName = `${apt.nombre || ''} ${apt.apellido || ''}`.trim() || 'Paciente';
        const whenLabel = diffMin <= 0 ? 'ahora' : `en ${diffMin} min`;

        toast.show(`Cita con ${patientName} ${whenLabel} (${timeLabel})`, 'info', 6000);

        if (settings.notifSound) {
            playNotificationSound();
        }

        if (settings.notifEmail) {
            sendEmailNotification(apt, settings);
        }
    });
};

const startAppointmentReminders = () => {
    if (notificationIntervalId) return;
    loadNotifiedKeys();
    pollAppointmentReminders();
    notificationIntervalId = setInterval(pollAppointmentReminders, 60000);

    window.addEventListener('configurationChanged', () => {
        lastEmailWarningShown = false;
        gmailAvailable = null;
        cachedUserEmail = null;
        cachedUserName = null;
        pollAppointmentReminders();
    });

    window.addEventListener('storage', (e) => {
        if (e.key === 'app_settings') {
            lastEmailWarningShown = false;
            pollAppointmentReminders();
        }
    });
};

const clearSessionData = () => {
    try {
        localStorage.removeItem('sesionActual');
        localStorage.removeItem('userName');
        localStorage.removeItem('userToken');
        localStorage.removeItem('sesionLastLogin');
    } catch (e) { }

    try {
        sessionStorage.removeItem('notified_appointments');
        sessionStorage.removeItem('notifiedAppointments');
        sessionStorage.removeItem('openAdminMenu');
    } catch (e) { }

    cachedUserEmail = null;
    cachedUserName = null;
    gmailAvailable = null;
    lastEmailWarningShown = false;
};

const setupAutoLock = (autoLockValue) => {
    if (!autoLockValue || autoLockValue === 'never') return;

    const minutes = parseInt(autoLockValue, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    let timeoutId = null;

    const logout = () => {
        clearSessionData();
        window.location.href = '../views/login.html';
    };

    const resetTimer = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(logout, minutes * 60 * 1000);
    };

    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, resetTimer, { passive: true });
    });

    resetTimer();
};

// Código de inicialización global
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar dark mode
    initializeDarkMode();
    const settings = initializePreferences();
    setupAutoLock(settings.autoLock);
    startAppointmentReminders();

    // Manejo global de eventos del navbar
    document.addEventListener('navigate', (e) => {
        const page = e.detail.page;
        const openMenu = !!e.detail.openMenu;
        // Manejar navegación según la página
        switch (page) {
            case 'agenda_diaria':
            case 'agenda_semanal':
                window.location.href = '../views/agenda.html';
                break;
            case 'pacientes':
                window.location.href = '../views/pacientes.html';
                break;
            case 'cajas':
                window.location.href = '../views/cajas.html';
                break;
            case 'administracion':
                if (openMenu) {
                    try { sessionStorage.setItem('openAdminMenu', '1'); } catch (e) { }
                }
                window.location.href = '../views/administracion.html';
                break;
            case 'inventario':
                window.location.href = '../views/inventario.html';
                break;
            case 'reportes':
                window.location.href = '../views/reportes.html';
                break;
            case 'crm':
                window.location.href = '../views/crm.html';
                break;
            case 'perfil':
                window.location.href = '../views/perfil.html';
                break;
            case 'configuracion':
                window.location.href = '../views/configuracion.html';
                break;
        }
    });

    // Manejo del logout
    document.addEventListener('logout', () => {
        clearSessionData();
        window.location.href = '../views/login.html';
    });

    // Manejo de búsqueda
    document.addEventListener('search', (e) => {
        console.log('Búsqueda:', e.detail.query);
        // Implementar lógica de búsqueda
    });
});
