// Importar componentes
import '../components/navbar-component.js';
import '../components/chatbot.js';
import { enhanceDateInputs, refreshDateInputs } from './date-inputs.js';
import toast from './toast.js';

const WINDOWS_1252_BYTES = {
    '\u20AC': 0x80,
    '\u201A': 0x82,
    '\u0192': 0x83,
    '\u201E': 0x84,
    '\u2026': 0x85,
    '\u2020': 0x86,
    '\u2021': 0x87,
    '\u02C6': 0x88,
    '\u2030': 0x89,
    '\u0160': 0x8A,
    '\u2039': 0x8B,
    '\u0152': 0x8C,
    '\u017D': 0x8E,
    '\u2018': 0x91,
    '\u2019': 0x92,
    '\u201C': 0x93,
    '\u201D': 0x94,
    '\u2022': 0x95,
    '\u2013': 0x96,
    '\u2014': 0x97,
    '\u02DC': 0x98,
    '\u2122': 0x99,
    '\u0161': 0x9A,
    '\u203A': 0x9B,
    '\u0153': 0x9C,
    '\u017E': 0x9E,
    '\u0178': 0x9F
};

const MOJIBAKE_PATTERN = /[ÃÂâðï]/;
const MOJIBAKE_ATTRS = ['placeholder', 'title', 'aria-label', 'value'];
const utf8Decoder = new TextDecoder('utf-8', { fatal: false });

function toWindows1252Bytes(text) {
    return Uint8Array.from(String(text ?? ''), (char) => {
        const code = char.charCodeAt(0);
        return code <= 0xFF ? code : (WINDOWS_1252_BYTES[char] ?? 0x3F);
    });
}

function repairMojibakeText(value) {
    let text = String(value ?? '');

    for (let index = 0; index < 2; index += 1) {
        if (!MOJIBAKE_PATTERN.test(text)) break;

        const repaired = utf8Decoder.decode(toWindows1252Bytes(text));
        if (!repaired || repaired === text) break;
        text = repaired;
    }

    return text;
}

function repairTextNode(node) {
    if (!node || !MOJIBAKE_PATTERN.test(node.data || '')) return;
    node.data = repairMojibakeText(node.data);
}

function repairElementAttributes(element) {
    if (!element) return;

    MOJIBAKE_ATTRS.forEach((attr) => {
        if (!element.hasAttribute?.(attr)) return;
        const currentValue = element.getAttribute(attr);
        if (!MOJIBAKE_PATTERN.test(currentValue || '')) return;
        element.setAttribute(attr, repairMojibakeText(currentValue));
    });
}

function repairMojibakeInDom(root = document.body) {
    if (!root) return;

    document.title = repairMojibakeText(document.title);

    if (root.nodeType === Node.TEXT_NODE) {
        repairTextNode(root);
        return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
        repairElementAttributes(root);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    while (currentNode) {
        repairTextNode(currentNode);
        currentNode = walker.nextNode();
    }

    if (root.querySelectorAll) {
        root.querySelectorAll('*').forEach(repairElementAttributes);
    }
}

function observeMojibake() {
    if (!document.body) return;

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'characterData') {
                repairTextNode(mutation.target);
                return;
            }

            if (mutation.type === 'attributes' && mutation.target) {
                repairElementAttributes(mutation.target);
                return;
            }

            mutation.addedNodes.forEach((node) => {
                repairMojibakeInDom(node);
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: MOJIBAKE_ATTRS
    });
}

function ensureAppFocus() {
    try {
        window.parent?.focus?.();
    } catch (error) {
        // Ignore cross-window focus issues.
    }

    try {
        window.focus();
    } catch (error) {
        // Ignore browser focus issues.
    }
}

function patchNativeDialogs() {
    const nativeAlert = window.alert?.bind(window);
    const nativeConfirm = window.confirm?.bind(window);
    const nativePrompt = window.prompt?.bind(window);

    if (nativeAlert) {
        window.alert = (message) => nativeAlert(repairMojibakeText(message));
    }

    if (nativeConfirm) {
        window.confirm = (message) => nativeConfirm(repairMojibakeText(message));
    }

    if (nativePrompt) {
        window.prompt = (message, defaultValue = '') => nativePrompt(
            repairMojibakeText(message),
            repairMojibakeText(defaultValue)
        );
    }
}

window.showToast = (message, type = 'info', duration = 3000) => {
    toast.show(repairMojibakeText(message), type, duration);
};
window.enhanceDateInputs = enhanceDateInputs;
window.refreshDateInputs = refreshDateInputs;
window.repairMojibakeText = repairMojibakeText;
window.repairMojibakeInDom = repairMojibakeInDom;
window.ensureAppFocus = ensureAppFocus;

patchNativeDialogs();

document.addEventListener('pointerdown', () => {
    ensureAppFocus();
}, true);

const safeParseJSON = (value, fallback = {}) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (err) {
        console.warn('[init] JSON inválido en app_settings:', err);
        return fallback;
    }
};

const THEME_STORAGE_KEY = 'theme';
const SETTINGS_STORAGE_KEY = 'app_settings';
const VALID_THEMES = new Set(['light', 'dark', 'auto']);

const getStoredTheme = () => {
    const direct = localStorage.getItem(THEME_STORAGE_KEY);
    if (VALID_THEMES.has(direct)) return direct;

    const settings = safeParseJSON(localStorage.getItem(SETTINGS_STORAGE_KEY), {});
    const fromSettings = settings?.theme;
    if (VALID_THEMES.has(fromSettings)) return fromSettings;

    return 'auto';
};

const prefersDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');

const applyThemePreference = (theme) => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDarkMedia.matches);

    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    root.dataset.theme = theme;

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
        // ignore
    }
};

// Inicializar dark mode desde storage (theme o app_settings)
const initializeDarkMode = () => {
    applyThemePreference(getStoredTheme());
};

const initializeUiRecovery = () => {
    repairMojibakeInDom(document.documentElement);
    observeMojibake();
};

const syncThemeFromStorage = () => {
    applyThemePreference(getStoredTheme());
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

const mirrorSettingsToLocalStorage = (settings = {}) => {
    if (!settings || typeof settings !== 'object') return;

    try {
        localStorage.setItem('app_settings', JSON.stringify(settings));
        if (settings.workStart != null) localStorage.setItem('work-start', settings.workStart);
        if (settings.workEnd != null) localStorage.setItem('work-end', settings.workEnd);
        if (settings.lunchStart != null) localStorage.setItem('lunch-start', settings.lunchStart);
        if (settings.lunchEnd != null) localStorage.setItem('lunch-end', settings.lunchEnd);
        if (settings.defaultDuration != null) localStorage.setItem('default-duration', settings.defaultDuration);
        if (settings.appointmentInterval != null) localStorage.setItem('appointment-interval', settings.appointmentInterval);
        if (settings.timeFormat != null) localStorage.setItem('time-format', settings.timeFormat);
        if (settings.currency != null) localStorage.setItem('currency', settings.currency);
        if (settings.firstDayWeek != null) localStorage.setItem('first-day-week', String(settings.firstDayWeek));
        if (settings.autoLock != null) localStorage.setItem('auto-lock', settings.autoLock);
        if (settings.theme != null) localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
    } catch (error) {
        console.warn('[init] No se pudo reflejar configuracion en localStorage:', error);
    }
};

const refreshSettingsFromDatabase = async () => {
    if (!window.api?.clinicConfig?.getSettings) return null;
    try {
        const settings = await window.api.clinicConfig.getSettings();
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
        mirrorSettingsToLocalStorage(settings);
        return settings;
    } catch (error) {
        console.warn('[init] No se pudo leer configuracion desde BD:', error);
        return null;
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

        // Update session with email and foto_perfil if found
        if (row?.email && !session.email) {
            session.email = row.email;
        }
        // Backfill foto_perfil in session from full profile API (so navbar can show it)
        if (!session.foto_perfil && userId && window.api?.getUserProfile) {
            try {
                const profile = await window.api.getUserProfile({ id: userId });
                if (profile?.foto_perfil) {
                    session.foto_perfil = profile.foto_perfil;
                }
            } catch (e) { /* non-critical */ }
        }
        if (row?.email || session.foto_perfil) {
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
    initializeUiRecovery();

    // Inicializar dark mode
    initializeDarkMode();
    const settings = initializePreferences();
    setupAutoLock(settings.autoLock);
    startAppointmentReminders();
    void refreshSettingsFromDatabase().then((dbSettings) => {
        if (!dbSettings) return;
        applyThemePreference(getStoredTheme());
        applyFontSize(dbSettings.fontSize);
        applyCompactMode(dbSettings.compactMode);
        applyDateFormat(dbSettings.dateFormat);
        window.dispatchEvent(new CustomEvent('configurationChanged', { detail: dbSettings }));
    });
    // enhanceDateInputs(document);

    // Inyectar el Chatbot de Soporte solo si no estamos dentro de un iframe
    if (window.self === window.top) {
        if (!document.querySelector('support-chatbot')) {
            const bot = document.createElement('support-chatbot');
            document.body.appendChild(bot);
        }
    }

    // Mantener tema sincronizado con cambios de configuración
    prefersDarkMedia.addEventListener('change', () => {
        if (getStoredTheme() === 'auto') {
            applyThemePreference('auto');
        }
    });
    window.addEventListener('themeChanged', syncThemeFromStorage);
    window.addEventListener('configurationChanged', (e) => {
        if (e?.detail?.theme) {
            applyThemePreference(e.detail.theme);
        }
        // refreshDateInputs(document);
    });
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_STORAGE_KEY || e.key === SETTINGS_STORAGE_KEY) {
            syncThemeFromStorage();
            // refreshDateInputs(document);
        }
    });

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
            case 'contabilidad':
                window.location.href = '../views/contabilidad.html';
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
