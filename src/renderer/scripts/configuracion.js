// src/renderer/scripts/configuracion.js

import toast from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[configuracion] Página cargada');

    // ==========================================
    // REFERENCIAS DOM
    // ==========================================

    const elements = {
        // Botones principales
        saveAllBtn: document.getElementById('save-all-btn'),
        resetSettingsBtn: document.getElementById('reset-settings-btn'),
        changePasswordBtn: document.getElementById('change-password-btn'),
        viewSessionsBtn: document.getElementById('view-sessions-btn'),

        // Apariencia
        themeRadios: document.querySelectorAll('input[name="theme"]'),
        fontSizeSelect: document.getElementById('font-size'),
        compactModeCheckbox: document.getElementById('compact-mode'),

        // Notificaciones
        notifCitasCheckbox: document.getElementById('notif-citas'),
        notifEmailCheckbox: document.getElementById('notif-email'),
        notifSoundCheckbox: document.getElementById('notif-sound'),
        reminderTimeSelect: document.getElementById('reminder-time'),

        // Agenda
        workStartInput: document.getElementById('work-start'),
        workEndInput: document.getElementById('work-end'),
        defaultDurationSelect: document.getElementById('default-duration'),
        workDaysCheckboxes: document.querySelectorAll('input[name="work-days"]'),
        appointmentIntervalSelect: document.getElementById('appointment-interval'),
        autoConfirmCheckbox: document.getElementById('auto-confirm'),
        weeklyViewCheckbox: document.getElementById('weekly-view'),

        // Sistema
        autoSaveCheckbox: document.getElementById('auto-save'),
        dateFormatSelect: document.getElementById('date-format'),

        // Seguridad
        twoFactorCheckbox: document.getElementById('two-factor'),
        autoLockSelect: document.getElementById('auto-lock'),

        // Región
        currencySelect: document.getElementById('currency'),
        timeFormatSelect: document.getElementById('time-format'),
        firstDayWeekSelect: document.getElementById('first-day-week')
    };

    // ==========================================
    // CONFIGURACIÓN POR DEFECTO
    // ==========================================

    const defaultSettings = {
        // Apariencia
        theme: 'auto',
        fontSize: 'medium',
        compactMode: false,

        // Notificaciones
        notifCitas: true,
        notifEmail: true,
        notifSound: true,
        reminderTime: '15',

        // Agenda
        workStart: '08:00',
        workEnd: '18:00',
        defaultDuration: '30',
        workDays: [1, 2, 3, 4, 5], // Lunes a Viernes por defecto
        appointmentInterval: '10',
        autoConfirm: false,
        weeklyView: false,

        // Sistema
        autoSave: true,
        dateFormat: 'dd/mm/yyyy',

        // Seguridad
        twoFactor: false,
        autoLock: '15',

        // Región
        currency: 'MXN',
        timeFormat: '24h',
        firstDayWeek: '1'
    };

    const safeParseJSON = (value, fallback = null) => {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (err) {
            console.warn('[configuracion] JSON inválido en app_settings:', err);
            return fallback;
        }
    };

    // ==========================================
    // CARGAR CONFIGURACIÓN
    // ==========================================

    const loadSettings = () => {
        console.log('[configuracion] Cargando configuración...');

        const savedSettings = safeParseJSON(localStorage.getItem('app_settings'), {});
        const settings = { ...defaultSettings, ...(savedSettings || {}) };
        if (!Array.isArray(settings.workDays)) {
            settings.workDays = defaultSettings.workDays;
        } else {
            settings.workDays = settings.workDays.map((d) => parseInt(d, 10)).filter(Number.isFinite);
        }

        // Apariencia
        const themeValue = settings.theme || defaultSettings.theme;
        elements.themeRadios.forEach(radio => {
            radio.checked = radio.value === themeValue;
        });

        if (elements.fontSizeSelect) elements.fontSizeSelect.value = settings.fontSize || defaultSettings.fontSize;
        if (elements.compactModeCheckbox) elements.compactModeCheckbox.checked = settings.compactMode ?? defaultSettings.compactMode;

        // Notificaciones
        if (elements.notifCitasCheckbox) elements.notifCitasCheckbox.checked = settings.notifCitas ?? defaultSettings.notifCitas;
        if (elements.notifEmailCheckbox) elements.notifEmailCheckbox.checked = settings.notifEmail ?? defaultSettings.notifEmail;
        if (elements.notifSoundCheckbox) elements.notifSoundCheckbox.checked = settings.notifSound ?? defaultSettings.notifSound;
        if (elements.reminderTimeSelect) elements.reminderTimeSelect.value = settings.reminderTime || defaultSettings.reminderTime;

        // Agenda
        if (elements.workStartInput) elements.workStartInput.value = settings.workStart || defaultSettings.workStart;
        if (elements.workEndInput) elements.workEndInput.value = settings.workEnd || defaultSettings.workEnd;
        if (elements.defaultDurationSelect) elements.defaultDurationSelect.value = settings.defaultDuration || defaultSettings.defaultDuration;

        // Días laborales
        const workDays = settings.workDays || defaultSettings.workDays;
        elements.workDaysCheckboxes.forEach(checkbox => {
            checkbox.checked = workDays.includes(parseInt(checkbox.value, 10));
        });

        if (elements.appointmentIntervalSelect) elements.appointmentIntervalSelect.value = settings.appointmentInterval || defaultSettings.appointmentInterval;
        if (elements.autoConfirmCheckbox) elements.autoConfirmCheckbox.checked = settings.autoConfirm ?? defaultSettings.autoConfirm;
        if (elements.weeklyViewCheckbox) elements.weeklyViewCheckbox.checked = settings.weeklyView ?? defaultSettings.weeklyView;

        // Sistema
        if (elements.autoSaveCheckbox) elements.autoSaveCheckbox.checked = settings.autoSave ?? defaultSettings.autoSave;
        if (elements.dateFormatSelect) elements.dateFormatSelect.value = settings.dateFormat || defaultSettings.dateFormat;

        // Seguridad
        if (elements.twoFactorCheckbox) elements.twoFactorCheckbox.checked = settings.twoFactor ?? defaultSettings.twoFactor;
        if (elements.autoLockSelect) elements.autoLockSelect.value = settings.autoLock || defaultSettings.autoLock;

        // Región
        if (elements.currencySelect) elements.currencySelect.value = settings.currency || defaultSettings.currency;
        if (elements.timeFormatSelect) elements.timeFormatSelect.value = settings.timeFormat || defaultSettings.timeFormat;
        if (elements.firstDayWeekSelect) elements.firstDayWeekSelect.value = String(settings.firstDayWeek ?? defaultSettings.firstDayWeek);

        applyFontSize(settings.fontSize || defaultSettings.fontSize);
        applyCompactMode(settings.compactMode ?? defaultSettings.compactMode);
        applyDateFormat(settings.dateFormat || defaultSettings.dateFormat);

        console.log('[configuracion] Configuración cargada:', settings);
    };

    // ==========================================
    // GUARDAR CONFIGURACIÓN
    // ==========================================

    const saveSettings = () => {
        console.log('[configuracion] Guardando configuración...');

        let selectedTheme = defaultSettings.theme;
        elements.themeRadios.forEach(radio => {
            if (radio.checked) selectedTheme = radio.value;
        });

        const settings = {
            // Apariencia
            theme: selectedTheme,
            fontSize: elements.fontSizeSelect?.value || defaultSettings.fontSize,
            compactMode: elements.compactModeCheckbox?.checked || false,

            // Notificaciones
            notifCitas: elements.notifCitasCheckbox?.checked ?? defaultSettings.notifCitas,
            notifEmail: elements.notifEmailCheckbox?.checked ?? defaultSettings.notifEmail,
            notifSound: elements.notifSoundCheckbox?.checked ?? defaultSettings.notifSound,
            reminderTime: elements.reminderTimeSelect?.value || defaultSettings.reminderTime,

            // Agenda
            workStart: elements.workStartInput?.value || defaultSettings.workStart,
            workEnd: elements.workEndInput?.value || defaultSettings.workEnd,
            defaultDuration: elements.defaultDurationSelect?.value || defaultSettings.defaultDuration,
            workDays: Array.from(elements.workDaysCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value)),
            appointmentInterval: elements.appointmentIntervalSelect?.value || defaultSettings.appointmentInterval,
            autoConfirm: elements.autoConfirmCheckbox?.checked || false,
            weeklyView: elements.weeklyViewCheckbox?.checked || false,

            // Sistema
            autoSave: elements.autoSaveCheckbox?.checked ?? defaultSettings.autoSave,
            dateFormat: elements.dateFormatSelect?.value || defaultSettings.dateFormat,

            // Seguridad
            twoFactor: elements.twoFactorCheckbox?.checked ?? defaultSettings.twoFactor,
            autoLock: elements.autoLockSelect?.value || defaultSettings.autoLock,

            // Región
            currency: elements.currencySelect?.value || defaultSettings.currency,
            timeFormat: elements.timeFormatSelect?.value || defaultSettings.timeFormat,
            firstDayWeek: elements.firstDayWeekSelect?.value || defaultSettings.firstDayWeek
        };

        localStorage.setItem('app_settings', JSON.stringify(settings));

        // También guardar en formato individual para compatibilidad con agenda
        localStorage.setItem('work-start', settings.workStart);
        localStorage.setItem('work-end', settings.workEnd);
        localStorage.setItem('default-duration', settings.defaultDuration);
        localStorage.setItem('appointment-interval', settings.appointmentInterval);
        localStorage.setItem('time-format', settings.timeFormat);
        localStorage.setItem('currency', settings.currency);
        localStorage.setItem('first-day-week', String(settings.firstDayWeek));
        localStorage.setItem('auto-lock', settings.autoLock);

        applyTheme(settings.theme);
        applyFontSize(settings.fontSize);
        applyCompactMode(settings.compactMode);
        applyDateFormat(settings.dateFormat);

        // Disparar evento personalizado para que la agenda se actualice
        window.dispatchEvent(new CustomEvent('configurationChanged', {
            detail: settings
        }));

        console.log('[configuracion] Configuración guardada:', settings);
        toast.show('Configuracion guardada correctamente', 'success');
    };

    // ==========================================
    // APLICAR TEMA
    // ==========================================

    const applyTheme = (theme) => {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else if (theme === 'light') {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            // Auto: usar preferencia del sistema
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
            localStorage.setItem('theme', 'auto');
        }

        // Dispatch custom event for iframe theme updates
        window.dispatchEvent(new Event('themeChanged'));
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

    // ==========================================
    // RESTAURAR CONFIGURACIÓN
    // ==========================================

    const resetSettings = () => {
        if (!confirm('¿Estás seguro de que deseas restaurar la configuración por defecto? Esta acción no se puede deshacer.')) {
            return;
        }

        console.log('[configuracion] Restaurando configuración por defecto...');

        localStorage.setItem('app_settings', JSON.stringify(defaultSettings));
        localStorage.setItem('work-start', defaultSettings.workStart);
        localStorage.setItem('work-end', defaultSettings.workEnd);
        localStorage.setItem('default-duration', defaultSettings.defaultDuration);
        localStorage.setItem('appointment-interval', defaultSettings.appointmentInterval);
        localStorage.setItem('time-format', defaultSettings.timeFormat);
        localStorage.setItem('currency', defaultSettings.currency);
        localStorage.setItem('first-day-week', String(defaultSettings.firstDayWeek));
        localStorage.setItem('auto-lock', defaultSettings.autoLock);
        loadSettings();
        applyTheme(defaultSettings.theme);
        applyFontSize(defaultSettings.fontSize);
        applyCompactMode(defaultSettings.compactMode);
        applyDateFormat(defaultSettings.dateFormat);

        window.dispatchEvent(new CustomEvent('configurationChanged', {
            detail: defaultSettings
        }));

        toast.show('Configuracion restaurada a valores por defecto', 'success');
    };

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    // Guardar todo
    elements.saveAllBtn?.addEventListener('click', saveSettings);

    // Restaurar configuración
    elements.resetSettingsBtn?.addEventListener('click', resetSettings);

    // Auto-guardar al cambiar tema (para feedback inmediato)
    elements.themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            console.log('[configuracion] Tema cambiado a:', e.target.value);
        });
    });

    // Auto-guardar si está habilitado
    const setupAutoSave = () => {
        const allInputs = [
            ...elements.themeRadios,
            elements.fontSizeSelect,
            elements.compactModeCheckbox,
            elements.notifCitasCheckbox,
            elements.notifEmailCheckbox,
            elements.notifSoundCheckbox,
            elements.reminderTimeSelect,
            elements.workStartInput,
            elements.workEndInput,
            elements.defaultDurationSelect,
            ...elements.workDaysCheckboxes,
            elements.appointmentIntervalSelect,
            elements.autoConfirmCheckbox,
            elements.weeklyViewCheckbox,
            elements.autoSaveCheckbox,
            elements.dateFormatSelect,
            elements.twoFactorCheckbox,
            elements.autoLockSelect,
            elements.currencySelect,
            elements.timeFormatSelect,
            elements.firstDayWeekSelect
        ].filter(Boolean);

        allInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (elements.autoSaveCheckbox?.checked) {
                    console.log('[configuracion] Auto-guardando...');
                    saveSettings();
                }
            });
        });
    };

    setupAutoSave();

    const openPasswordResetModal = () => {
        if (!window.api || typeof window.api.requestPasswordReset !== 'function') {
            toast.show('No se encontró el servicio para cambiar contraseña.', 'error');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Cambiar contraseña</h3>
                    <p class="text-white/70 text-sm mt-1">Recibirás un código en tu correo</p>
                </div>
                <div class="p-6 space-y-6">
                    <form id="pwRequestForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Correo</label>
                            <input id="pwEmail" type="email" required
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div class="flex gap-3">
                            <button type="button" id="pwCancel" class="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors">Cancelar</button>
                            <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Enviar código</button>
                        </div>
                    </form>
                    <form id="pwConfirmForm" class="space-y-4 hidden">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Código de verificación</label>
                            <input id="pwToken" type="text" required
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nueva contraseña</label>
                            <input id="pwNew" type="password" required minlength="8"
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirmar contraseña</label>
                            <input id="pwConfirm" type="password" required minlength="8"
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div class="flex gap-3">
                            <button type="button" id="pwBack" class="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors">Atrás</button>
                            <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Actualizar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const requestForm = overlay.querySelector('#pwRequestForm');
        const confirmForm = overlay.querySelector('#pwConfirmForm');
        const emailInput = overlay.querySelector('#pwEmail');
        const tokenInput = overlay.querySelector('#pwToken');
        const newPassInput = overlay.querySelector('#pwNew');
        const confirmInput = overlay.querySelector('#pwConfirm');
        const cancelBtn = overlay.querySelector('#pwCancel');
        const backBtn = overlay.querySelector('#pwBack');

        const closeModal = () => overlay.remove();

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        cancelBtn?.addEventListener('click', closeModal);
        backBtn?.addEventListener('click', () => {
            confirmForm.classList.add('hidden');
            requestForm.classList.remove('hidden');
        });

        requestForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput?.value?.trim();
            if (!email) return;

            try {
                const result = await window.api.requestPasswordReset(email);
                if (result?.success) {
                    toast.show(result.message || 'Se envió un código al correo.', 'success');
                    requestForm.classList.add('hidden');
                    confirmForm.classList.remove('hidden');
                } else {
                    toast.show(result?.error || 'No se pudo enviar el código', 'error');
                }
            } catch (err) {
                toast.show('Error solicitando el código de recuperación', 'error');
            }
        });

        confirmForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = tokenInput?.value?.trim();
            const newPassword = newPassInput?.value || '';
            const confirmPassword = confirmInput?.value || '';

            if (!token) {
                toast.show('Ingresa el código de verificación', 'warning');
                return;
            }
            if (newPassword.length < 8) {
                toast.show('La contraseña debe tener al menos 8 caracteres', 'warning');
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.show('Las contraseñas no coinciden', 'warning');
                return;
            }

            try {
                const result = await window.api.resetPassword(token, newPassword);
                if (result?.success) {
                    toast.show(result.message || 'Contraseña actualizada', 'success');
                    closeModal();
                } else {
                    toast.show(result?.error || 'No se pudo actualizar la contraseña', 'error');
                }
            } catch (err) {
                toast.show('Error al actualizar la contraseña', 'error');
            }
        });
    };

    const openSessionsModal = () => {
        const session = safeParseJSON(localStorage.getItem('sesionActual'), {}) || {};
        const nombre = [session.nombre, session.apellido].filter(Boolean).join(' ') || 'Usuario';
        const rol = session.rol || '—';
        const userId = session.id || '—';
        const lastLogin = localStorage.getItem('sesionLastLogin') || '—';

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Sesiones activas</h3>
                    <p class="text-white/70 text-sm mt-1">Detalle de la sesión actual</p>
                </div>
                <div class="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Usuario</span>
                        <span class="font-medium text-gray-900 dark:text-white">${nombre}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Rol</span>
                        <span class="font-medium text-gray-900 dark:text-white">${rol}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-500 dark:text-gray-400">ID</span>
                        <span class="font-medium text-gray-900 dark:text-white">${userId}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Último acceso</span>
                        <span class="font-medium text-gray-900 dark:text-white">${lastLogin}</span>
                    </div>
                    <div class="pt-4">
                        <button type="button" id="closeSessionsModal"
                            class="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#closeSessionsModal')?.addEventListener('click', closeModal);
    };

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================

    loadSettings();

    elements.changePasswordBtn?.addEventListener('click', openPasswordResetModal);
    elements.viewSessionsBtn?.addEventListener('click', openSessionsModal);

    console.log('[configuracion] Inicialización completa');
});
