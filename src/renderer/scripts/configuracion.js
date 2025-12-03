// src/renderer/scripts/configuracion.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('[configuracion] Página cargada');

    // ==========================================
    // HELPERS
    // ==========================================

    const showToast = (message, type = 'success') => {
        // Crear toast notification
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg transform transition-all duration-300 translate-x-full ${type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`;
        toast.innerHTML = `
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${type === 'success'
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />'
            }
        </svg>
        <span class="font-medium">${message}</span>
      </div>
    `;

        document.body.appendChild(toast);

        // Animar entrada
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);

        // Animar salida y remover
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // ==========================================
    // REFERENCIAS DOM
    // ==========================================

    // Botones principales
    const saveAllBtn = document.getElementById('save-all-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');

    // Apariencia
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const fontSizeSelect = document.getElementById('font-size');
    const compactModeCheckbox = document.getElementById('compact-mode');

    // Notificaciones
    const notifCitasCheckbox = document.getElementById('notif-citas');
    const notifEmailCheckbox = document.getElementById('notif-email');
    const notifSoundCheckbox = document.getElementById('notif-sound');
    const reminderTimeSelect = document.getElementById('reminder-time');

    // Agenda
    const workStartInput = document.getElementById('work-start');
    const workEndInput = document.getElementById('work-end');
    const defaultDurationSelect = document.getElementById('default-duration');
    const weeklyViewCheckbox = document.getElementById('weekly-view');

    // Sistema
    const autoSaveCheckbox = document.getElementById('auto-save');
    const languageSelect = document.getElementById('language');
    const dateFormatSelect = document.getElementById('date-format');

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
        weeklyView: false,

        // Sistema
        autoSave: true,
        language: 'es',
        dateFormat: 'dd/mm/yyyy'
    };

    // ==========================================
    // CARGAR CONFIGURACIÓN
    // ==========================================

    const loadSettings = () => {
        console.log('[configuracion] Cargando configuración...');

        // Obtener configuración guardada o usar defaults
        const savedSettings = localStorage.getItem('app_settings');
        const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

        // Apariencia
        const themeValue = settings.theme || defaultSettings.theme;
        themeRadios.forEach(radio => {
            radio.checked = radio.value === themeValue;
        });

        if (fontSizeSelect) fontSizeSelect.value = settings.fontSize || defaultSettings.fontSize;
        if (compactModeCheckbox) compactModeCheckbox.checked = settings.compactMode || false;

        // Notificaciones
        if (notifCitasCheckbox) notifCitasCheckbox.checked = settings.notifCitas ?? defaultSettings.notifCitas;
        if (notifEmailCheckbox) notifEmailCheckbox.checked = settings.notifEmail ?? defaultSettings.notifEmail;
        if (notifSoundCheckbox) notifSoundCheckbox.checked = settings.notifSound ?? defaultSettings.notifSound;
        if (reminderTimeSelect) reminderTimeSelect.value = settings.reminderTime || defaultSettings.reminderTime;

        // Agenda
        if (workStartInput) workStartInput.value = settings.workStart || defaultSettings.workStart;
        if (workEndInput) workEndInput.value = settings.workEnd || defaultSettings.workEnd;
        if (defaultDurationSelect) defaultDurationSelect.value = settings.defaultDuration || defaultSettings.defaultDuration;
        if (weeklyViewCheckbox) weeklyViewCheckbox.checked = settings.weeklyView || false;

        // Sistema
        if (autoSaveCheckbox) autoSaveCheckbox.checked = settings.autoSave ?? defaultSettings.autoSave;
        if (languageSelect) languageSelect.value = settings.language || defaultSettings.language;
        if (dateFormatSelect) dateFormatSelect.value = settings.dateFormat || defaultSettings.dateFormat;

        console.log('[configuracion] Configuración cargada:', settings);
    };

    // ==========================================
    // GUARDAR CONFIGURACIÓN
    // ==========================================

    const saveSettings = () => {
        console.log('[configuracion] Guardando configuración...');

        // Obtener tema seleccionado
        let selectedTheme = defaultSettings.theme;
        themeRadios.forEach(radio => {
            if (radio.checked) selectedTheme = radio.value;
        });

        const settings = {
            // Apariencia
            theme: selectedTheme,
            fontSize: fontSizeSelect?.value || defaultSettings.fontSize,
            compactMode: compactModeCheckbox?.checked || false,

            // Notificaciones
            notifCitas: notifCitasCheckbox?.checked ?? defaultSettings.notifCitas,
            notifEmail: notifEmailCheckbox?.checked ?? defaultSettings.notifEmail,
            notifSound: notifSoundCheckbox?.checked ?? defaultSettings.notifSound,
            reminderTime: reminderTimeSelect?.value || defaultSettings.reminderTime,

            // Agenda
            workStart: workStartInput?.value || defaultSettings.workStart,
            workEnd: workEndInput?.value || defaultSettings.workEnd,
            defaultDuration: defaultDurationSelect?.value || defaultSettings.defaultDuration,
            weeklyView: weeklyViewCheckbox?.checked || false,

            // Sistema
            autoSave: autoSaveCheckbox?.checked ?? defaultSettings.autoSave,
            language: languageSelect?.value || defaultSettings.language,
            dateFormat: dateFormatSelect?.value || defaultSettings.dateFormat
        };

        // Guardar en localStorage
        localStorage.setItem('app_settings', JSON.stringify(settings));

        // Aplicar tema inmediatamente
        applyTheme(settings.theme);

        console.log('[configuracion] Configuración guardada:', settings);
        showToast('✅ Configuración guardada correctamente', 'success');
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
    };

    // ==========================================
    // RESTAURAR CONFIGURACIÓN
    // ==========================================

    const resetSettings = () => {
        if (!confirm('¿Estás seguro de que deseas restaurar la configuración por defecto? Esta acción no se puede deshacer.')) {
            return;
        }

        console.log('[configuracion] Restaurando configuración por defecto...');

        // Guardar defaults
        localStorage.setItem('app_settings', JSON.stringify(defaultSettings));

        // Recargar la configuración en la UI
        loadSettings();

        // Aplicar tema
        applyTheme(defaultSettings.theme);

        showToast('🔄 Configuración restaurada a valores por defecto', 'success');
    };

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    // Guardar todo
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', saveSettings);
    }

    // Restaurar configuración
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', resetSettings);
    }

    // Auto-guardar al cambiar tema (para feedback inmediato)
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            console.log('[configuracion] Tema cambiado a:', e.target.value);
        });
    });

    // Auto-guardar si está habilitado (opcional, se puede descomentar)
    const setupAutoSave = () => {
        const allInputs = [
            ...themeRadios,
            fontSizeSelect,
            compactModeCheckbox,
            notifCitasCheckbox,
            notifEmailCheckbox,
            notifSoundCheckbox,
            reminderTimeSelect,
            workStartInput,
            workEndInput,
            defaultDurationSelect,
            weeklyViewCheckbox,
            autoSaveCheckbox,
            languageSelect,
            dateFormatSelect
        ].filter(Boolean);

        allInputs.forEach(input => {
            input.addEventListener('change', () => {
                // Solo auto-guardar si la opción está activada
                if (autoSaveCheckbox?.checked) {
                    console.log('[configuracion] Auto-guardando...');
                    saveSettings();
                }
            });
        });
    };

    setupAutoSave();

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================

    loadSettings();

    console.log('[configuracion] Inicialización completa');
});
