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
        weeklyViewCheckbox: document.getElementById('weekly-view'),

        // Sistema
        autoSaveCheckbox: document.getElementById('auto-save'),
        languageSelect: document.getElementById('language'),
        dateFormatSelect: document.getElementById('date-format')
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

        const savedSettings = localStorage.getItem('app_settings');
        const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

        // Apariencia
        const themeValue = settings.theme || defaultSettings.theme;
        elements.themeRadios.forEach(radio => {
            radio.checked = radio.value === themeValue;
        });

        if (elements.fontSizeSelect) elements.fontSizeSelect.value = settings.fontSize || defaultSettings.fontSize;
        if (elements.compactModeCheckbox) elements.compactModeCheckbox.checked = settings.compactMode || false;

        // Notificaciones
        if (elements.notifCitasCheckbox) elements.notifCitasCheckbox.checked = settings.notifCitas ?? defaultSettings.notifCitas;
        if (elements.notifEmailCheckbox) elements.notifEmailCheckbox.checked = settings.notifEmail ?? defaultSettings.notifEmail;
        if (elements.notifSoundCheckbox) elements.notifSoundCheckbox.checked = settings.notifSound ?? defaultSettings.notifSound;
        if (elements.reminderTimeSelect) elements.reminderTimeSelect.value = settings.reminderTime || defaultSettings.reminderTime;

        // Agenda
        if (elements.workStartInput) elements.workStartInput.value = settings.workStart || defaultSettings.workStart;
        if (elements.workEndInput) elements.workEndInput.value = settings.workEnd || defaultSettings.workEnd;
        if (elements.defaultDurationSelect) elements.defaultDurationSelect.value = settings.defaultDuration || defaultSettings.defaultDuration;
        if (elements.weeklyViewCheckbox) elements.weeklyViewCheckbox.checked = settings.weeklyView || false;

        // Sistema
        if (elements.autoSaveCheckbox) elements.autoSaveCheckbox.checked = settings.autoSave ?? defaultSettings.autoSave;
        if (elements.languageSelect) elements.languageSelect.value = settings.language || defaultSettings.language;
        if (elements.dateFormatSelect) elements.dateFormatSelect.value = settings.dateFormat || defaultSettings.dateFormat;

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
            weeklyView: elements.weeklyViewCheckbox?.checked || false,

            // Sistema
            autoSave: elements.autoSaveCheckbox?.checked ?? defaultSettings.autoSave,
            language: elements.languageSelect?.value || defaultSettings.language,
            dateFormat: elements.dateFormatSelect?.value || defaultSettings.dateFormat
        };

        localStorage.setItem('app_settings', JSON.stringify(settings));
        applyTheme(settings.theme);

        console.log('[configuracion] Configuración guardada:', settings);
        toast.show('✅ Configuración guardada correctamente', 'success');
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

    // ==========================================
    // RESTAURAR CONFIGURACIÓN
    // ==========================================

    const resetSettings = () => {
        if (!confirm('¿Estás seguro de que deseas restaurar la configuración por defecto? Esta acción no se puede deshacer.')) {
            return;
        }

        console.log('[configuracion] Restaurando configuración por defecto...');

        localStorage.setItem('app_settings', JSON.stringify(defaultSettings));
        loadSettings();
        applyTheme(defaultSettings.theme);

        toast.show('🔄 Configuración restaurada a valores por defecto', 'success');
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
            elements.weeklyViewCheckbox,
            elements.autoSaveCheckbox,
            elements.languageSelect,
            elements.dateFormatSelect
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

    // ==========================================
    // INICIALIZACIÓN
    // ==========================================

    loadSettings();

    console.log('[configuracion] Inicialización completa');
});
