// src/renderer/scripts/configuracion.js

import toast from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[configuracion] Pagina cargada');

    const elements = {
        saveAllBtn: document.getElementById('save-all-btn'),
        resetSettingsBtn: document.getElementById('reset-settings-btn'),
        changePasswordBtn: document.getElementById('change-password-btn'),
        viewSessionsBtn: document.getElementById('view-sessions-btn'),

        themeRadios: document.querySelectorAll('input[name="theme"]'),
        fontSizeSelect: document.getElementById('font-size'),
        compactModeCheckbox: document.getElementById('compact-mode'),

        notifCitasCheckbox: document.getElementById('notif-citas'),
        notifEmailCheckbox: document.getElementById('notif-email'),
        notifSoundCheckbox: document.getElementById('notif-sound'),
        reminderTimeSelect: document.getElementById('reminder-time'),

        workStartInput: document.getElementById('work-start'),
        workEndInput: document.getElementById('work-end'),
        lunchStartInput: document.getElementById('lunch-start'),
        lunchEndInput: document.getElementById('lunch-end'),
        defaultDurationSelect: document.getElementById('default-duration'),
        workDaysCheckboxes: document.querySelectorAll('input[name="work-days"]'),
        appointmentIntervalSelect: document.getElementById('appointment-interval'),
        autoConfirmCheckbox: document.getElementById('auto-confirm'),
        weeklyViewCheckbox: document.getElementById('weekly-view'),

        autoSaveCheckbox: document.getElementById('auto-save'),
        dateFormatSelect: document.getElementById('date-format'),

        twoFactorCheckbox: document.getElementById('two-factor'),
        autoLockSelect: document.getElementById('auto-lock'),

        currencySelect: document.getElementById('currency'),
        timeFormatSelect: document.getElementById('time-format'),
        firstDayWeekSelect: document.getElementById('first-day-week'),

        clinicaNombreInput: document.getElementById('clinica-nombre'),
        clinicaTitularNombreInput: document.getElementById('clinica-titular-nombre'),
        clinicaTitularEspecialidadInput: document.getElementById('clinica-titular-especialidad'),
        clinicaTitularCedulaInput: document.getElementById('clinica-titular-cedula'),
        clinicaTitularRfcInput: document.getElementById('clinica-titular-rfc'),
        clinicaTelefonoInput: document.getElementById('clinica-telefono'),
        clinicaDireccionInput: document.getElementById('clinica-direccion')
    };

    const defaultSettings = {
        theme: 'auto',
        fontSize: 'medium',
        compactMode: false,
        notifCitas: true,
        notifEmail: true,
        notifSound: true,
        reminderTime: '15',
        workStart: '08:00',
        workEnd: '18:00',
        lunchStart: '14:00',
        lunchEnd: '15:00',
        defaultDuration: '30',
        workDays: [1, 2, 3, 4, 5],
        appointmentInterval: '10',
        autoConfirm: false,
        weeklyView: false,
        autoSave: true,
        dateFormat: 'dd/mm/yyyy',
        twoFactor: false,
        autoLock: '15',
        currency: 'MXN',
        timeFormat: '24h',
        firstDayWeek: '1'
    };

    const CLINIC_IDENTITY_STORAGE_KEY = 'clinic_identity_cache';
    const LEGACY_SETTING_KEYS = [
        'work-start',
        'work-end',
        'lunch-start',
        'lunch-end',
        'default-duration',
        'appointment-interval',
        'time-format',
        'currency',
        'first-day-week',
        'auto-lock'
    ];

    let currentSettings = { ...defaultSettings, workDays: [...defaultSettings.workDays] };
    let currentClinicIdentity = {};

    const safeParseJSON = (value, fallback = null) => {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (err) {
            console.warn('[configuracion] JSON invalido:', err);
            return fallback;
        }
    };

    const cloneDefaultSettings = () => ({
        ...defaultSettings,
        workDays: [...defaultSettings.workDays]
    });

    const normalizeWorkDays = (value) => {
        if (!Array.isArray(value)) {
            return [...defaultSettings.workDays];
        }

        return [...new Set(
            value
                .map((day) => parseInt(day, 10))
                .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        )];
    };

    const mergeSettings = (storedSettings = {}) => {
        const merged = {
            ...cloneDefaultSettings(),
            ...(storedSettings || {})
        };
        merged.workDays = normalizeWorkDays(
            Array.isArray(storedSettings?.workDays)
                ? storedSettings.workDays
                : merged.workDays
        );
        return merged;
    };

    const hasStoredSettings = (settings = {}) => Object.keys(settings || {}).length > 0;

    const applyTheme = (theme) => {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else if (theme === 'light') {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
            localStorage.setItem('theme', 'auto');
        }

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

    const applyClinicIdentityToInputs = (configMap = {}) => {
        if (elements.clinicaNombreInput) elements.clinicaNombreInput.value = configMap.clinica_nombre || '';
        if (elements.clinicaTitularNombreInput) elements.clinicaTitularNombreInput.value = configMap.clinica_titular || '';
        if (elements.clinicaTitularEspecialidadInput) elements.clinicaTitularEspecialidadInput.value = configMap.clinica_especialidad || '';
        if (elements.clinicaTitularCedulaInput) elements.clinicaTitularCedulaInput.value = configMap.clinica_cedula || '';
        if (elements.clinicaTitularRfcInput) elements.clinicaTitularRfcInput.value = configMap.clinica_rfc || '';
        if (elements.clinicaTelefonoInput) elements.clinicaTelefonoInput.value = configMap.clinica_telefono || '';
        if (elements.clinicaDireccionInput) elements.clinicaDireccionInput.value = configMap.clinica_direccion || '';
    };

    const readClinicIdentityCache = () => safeParseJSON(localStorage.getItem(CLINIC_IDENTITY_STORAGE_KEY), {}) || {};

    const writeClinicIdentityCache = (configMap = {}) => {
        localStorage.setItem(CLINIC_IDENTITY_STORAGE_KEY, JSON.stringify(configMap || {}));
    };

    const hasAnyClinicIdentityValue = (configMap = {}) => {
        return Object.values(configMap || {}).some((value) => String(value || '').trim().length > 0);
    };

    const hasLegacySettingsToMigrate = () => {
        if (localStorage.getItem('app_settings') !== null) return true;
        return LEGACY_SETTING_KEYS.some((key) => localStorage.getItem(key) !== null);
    };

    const readLegacySettingsFromStorage = () => {
        const savedSettings = safeParseJSON(localStorage.getItem('app_settings'), {}) || {};
        return mergeSettings({
            ...savedSettings,
            workStart: localStorage.getItem('work-start') ?? savedSettings.workStart,
            workEnd: localStorage.getItem('work-end') ?? savedSettings.workEnd,
            lunchStart: localStorage.getItem('lunch-start') ?? savedSettings.lunchStart,
            lunchEnd: localStorage.getItem('lunch-end') ?? savedSettings.lunchEnd,
            defaultDuration: localStorage.getItem('default-duration') ?? savedSettings.defaultDuration,
            appointmentInterval: localStorage.getItem('appointment-interval') ?? savedSettings.appointmentInterval,
            timeFormat: localStorage.getItem('time-format') ?? savedSettings.timeFormat,
            currency: localStorage.getItem('currency') ?? savedSettings.currency,
            firstDayWeek: localStorage.getItem('first-day-week') ?? savedSettings.firstDayWeek,
            autoLock: localStorage.getItem('auto-lock') ?? savedSettings.autoLock
        });
    };

    const syncSettingsMirror = (settings) => {
        const mergedSettings = mergeSettings(settings);
        currentSettings = mergedSettings;

        localStorage.setItem('app_settings', JSON.stringify(mergedSettings));
        localStorage.setItem('work-start', mergedSettings.workStart);
        localStorage.setItem('work-end', mergedSettings.workEnd);
        localStorage.setItem('lunch-start', mergedSettings.lunchStart);
        localStorage.setItem('lunch-end', mergedSettings.lunchEnd);
        localStorage.setItem('default-duration', mergedSettings.defaultDuration);
        localStorage.setItem('appointment-interval', mergedSettings.appointmentInterval);
        localStorage.setItem('time-format', mergedSettings.timeFormat);
        localStorage.setItem('currency', mergedSettings.currency);
        localStorage.setItem('first-day-week', String(mergedSettings.firstDayWeek));
        localStorage.setItem('auto-lock', mergedSettings.autoLock);
        localStorage.setItem('theme', mergedSettings.theme);

        return mergedSettings;
    };

    const applySettingsToInputs = (settings = {}) => {
        const mergedSettings = mergeSettings(settings);
        const themeValue = mergedSettings.theme ?? defaultSettings.theme;

        elements.themeRadios.forEach((radio) => {
            radio.checked = radio.value === themeValue;
        });

        if (elements.fontSizeSelect) elements.fontSizeSelect.value = mergedSettings.fontSize ?? defaultSettings.fontSize;
        if (elements.compactModeCheckbox) elements.compactModeCheckbox.checked = mergedSettings.compactMode ?? defaultSettings.compactMode;
        if (elements.notifCitasCheckbox) elements.notifCitasCheckbox.checked = mergedSettings.notifCitas ?? defaultSettings.notifCitas;
        if (elements.notifEmailCheckbox) elements.notifEmailCheckbox.checked = mergedSettings.notifEmail ?? defaultSettings.notifEmail;
        if (elements.notifSoundCheckbox) elements.notifSoundCheckbox.checked = mergedSettings.notifSound ?? defaultSettings.notifSound;
        if (elements.reminderTimeSelect) elements.reminderTimeSelect.value = mergedSettings.reminderTime ?? defaultSettings.reminderTime;
        if (elements.workStartInput) elements.workStartInput.value = mergedSettings.workStart ?? defaultSettings.workStart;
        if (elements.workEndInput) elements.workEndInput.value = mergedSettings.workEnd ?? defaultSettings.workEnd;
        if (elements.lunchStartInput) elements.lunchStartInput.value = mergedSettings.lunchStart ?? defaultSettings.lunchStart;
        if (elements.lunchEndInput) elements.lunchEndInput.value = mergedSettings.lunchEnd ?? defaultSettings.lunchEnd;
        if (elements.defaultDurationSelect) elements.defaultDurationSelect.value = mergedSettings.defaultDuration ?? defaultSettings.defaultDuration;

        elements.workDaysCheckboxes.forEach((checkbox) => {
            checkbox.checked = mergedSettings.workDays.includes(parseInt(checkbox.value, 10));
        });

        if (elements.appointmentIntervalSelect) elements.appointmentIntervalSelect.value = mergedSettings.appointmentInterval ?? defaultSettings.appointmentInterval;
        if (elements.autoConfirmCheckbox) elements.autoConfirmCheckbox.checked = mergedSettings.autoConfirm ?? defaultSettings.autoConfirm;
        if (elements.weeklyViewCheckbox) elements.weeklyViewCheckbox.checked = mergedSettings.weeklyView ?? defaultSettings.weeklyView;
        if (elements.autoSaveCheckbox) elements.autoSaveCheckbox.checked = mergedSettings.autoSave ?? defaultSettings.autoSave;
        if (elements.dateFormatSelect) elements.dateFormatSelect.value = mergedSettings.dateFormat ?? defaultSettings.dateFormat;
        if (elements.twoFactorCheckbox) elements.twoFactorCheckbox.checked = mergedSettings.twoFactor ?? defaultSettings.twoFactor;
        if (elements.autoLockSelect) elements.autoLockSelect.value = mergedSettings.autoLock ?? defaultSettings.autoLock;
        if (elements.currencySelect) elements.currencySelect.value = mergedSettings.currency ?? defaultSettings.currency;
        if (elements.timeFormatSelect) elements.timeFormatSelect.value = mergedSettings.timeFormat ?? defaultSettings.timeFormat;
        if (elements.firstDayWeekSelect) elements.firstDayWeekSelect.value = String(mergedSettings.firstDayWeek ?? defaultSettings.firstDayWeek);

        applyTheme(mergedSettings.theme ?? defaultSettings.theme);
        applyFontSize(mergedSettings.fontSize ?? defaultSettings.fontSize);
        applyCompactMode(mergedSettings.compactMode ?? defaultSettings.compactMode);
        applyDateFormat(mergedSettings.dateFormat ?? defaultSettings.dateFormat);
    };

    const collectSettingsFromInputs = () => {
        let selectedTheme = defaultSettings.theme;
        elements.themeRadios.forEach((radio) => {
            if (radio.checked) selectedTheme = radio.value;
        });

        return {
            theme: selectedTheme,
            fontSize: elements.fontSizeSelect?.value ?? defaultSettings.fontSize,
            compactMode: !!elements.compactModeCheckbox?.checked,
            notifCitas: elements.notifCitasCheckbox?.checked ?? defaultSettings.notifCitas,
            notifEmail: elements.notifEmailCheckbox?.checked ?? defaultSettings.notifEmail,
            notifSound: elements.notifSoundCheckbox?.checked ?? defaultSettings.notifSound,
            reminderTime: elements.reminderTimeSelect?.value ?? defaultSettings.reminderTime,
            workStart: elements.workStartInput?.value ?? defaultSettings.workStart,
            workEnd: elements.workEndInput?.value ?? defaultSettings.workEnd,
            lunchStart: elements.lunchStartInput?.value ?? defaultSettings.lunchStart,
            lunchEnd: elements.lunchEndInput?.value ?? defaultSettings.lunchEnd,
            defaultDuration: elements.defaultDurationSelect?.value ?? defaultSettings.defaultDuration,
            workDays: Array.from(elements.workDaysCheckboxes)
                .filter((checkbox) => checkbox.checked)
                .map((checkbox) => parseInt(checkbox.value, 10)),
            appointmentInterval: elements.appointmentIntervalSelect?.value ?? defaultSettings.appointmentInterval,
            autoConfirm: !!elements.autoConfirmCheckbox?.checked,
            weeklyView: !!elements.weeklyViewCheckbox?.checked,
            autoSave: elements.autoSaveCheckbox?.checked ?? defaultSettings.autoSave,
            dateFormat: elements.dateFormatSelect?.value ?? defaultSettings.dateFormat,
            twoFactor: elements.twoFactorCheckbox?.checked ?? defaultSettings.twoFactor,
            autoLock: elements.autoLockSelect?.value ?? defaultSettings.autoLock,
            currency: elements.currencySelect?.value ?? defaultSettings.currency,
            timeFormat: elements.timeFormatSelect?.value ?? defaultSettings.timeFormat,
            firstDayWeek: elements.firstDayWeekSelect?.value ?? defaultSettings.firstDayWeek
        };
    };

    const collectClinicIdentityFromInputs = () => ({
        clinica_nombre: elements.clinicaNombreInput?.value?.trim() || '',
        clinica_titular: elements.clinicaTitularNombreInput?.value?.trim() || '',
        clinica_especialidad: elements.clinicaTitularEspecialidadInput?.value?.trim() || '',
        clinica_cedula: elements.clinicaTitularCedulaInput?.value?.trim() || '',
        clinica_rfc: elements.clinicaTitularRfcInput?.value?.trim() || '',
        clinica_telefono: elements.clinicaTelefonoInput?.value?.trim() || '',
        clinica_direccion: elements.clinicaDireccionInput?.value?.trim() || '',
    });

    const loadClinicIdentityFromLegacyDb = async () => {
        const dbApi = window.api?.db;
        if (!dbApi?.all) return {};

        const rows = await dbApi.all(
            "SELECT clave, valor FROM admin_config WHERE clave LIKE 'clinica_%' ORDER BY clave"
        );

        if (!Array.isArray(rows) || rows.length === 0) {
            return {};
        }

        return rows.reduce((acc, row) => {
            if (row?.clave) acc[row.clave] = row.valor ?? '';
            return acc;
        }, {});
    };

    const loadPersistedConfiguration = async ({ migrateLegacySettings = false } = {}) => {
        console.log('[configuracion] Cargando configuracion persistida...');

        const cachedIdentity = readClinicIdentityCache();
        if (hasAnyClinicIdentityValue(cachedIdentity)) {
            applyClinicIdentityToInputs(cachedIdentity);
        }

        const api = window.api?.clinicConfig;
        let systemConfig = { settings: {}, clinicIdentity: {} };

        try {
            if (api?.getSystemConfig) {
                systemConfig = await api.getSystemConfig();
                console.log('[configuracion] Datos leidos desde BD:', systemConfig);
            } else if (api?.getSettings || api?.getConfig) {
                const [settings, clinicIdentity] = await Promise.all([
                    api.getSettings ? api.getSettings() : Promise.resolve({}),
                    api.getConfig ? api.getConfig() : Promise.resolve({}),
                ]);
                systemConfig = { settings: settings || {}, clinicIdentity: clinicIdentity || {} };
            } else {
                console.warn('[configuracion] API clinicConfig no disponible; usando almacenamiento local como fallback');
                systemConfig.settings = safeParseJSON(localStorage.getItem('app_settings'), {}) || {};
                systemConfig.clinicIdentity = cachedIdentity;
            }

            if (!hasStoredSettings(systemConfig.settings) && migrateLegacySettings && hasLegacySettingsToMigrate() && api?.saveSettings) {
                const legacySettings = readLegacySettingsFromStorage();
                console.log('[configuracion] Migrando configuracion legacy a BD:', legacySettings);
                systemConfig.settings = await api.saveSettings(legacySettings);
                console.log('[configuracion] Resultado de migracion de settings:', systemConfig.settings);
            }

            if (!hasAnyClinicIdentityValue(systemConfig.clinicIdentity) && migrateLegacySettings) {
                const legacyIdentity = await loadClinicIdentityFromLegacyDb();
                if (hasAnyClinicIdentityValue(legacyIdentity)) {
                    systemConfig.clinicIdentity = legacyIdentity;
                }
            }
        } catch (error) {
            console.error('[configuracion] Error cargando configuracion persistida:', error);
            systemConfig = {
                settings: safeParseJSON(localStorage.getItem('app_settings'), {}) || {},
                clinicIdentity: cachedIdentity
            };
        }

        const mergedSettings = syncSettingsMirror(systemConfig.settings || {});
        applySettingsToInputs(mergedSettings);

        currentClinicIdentity = systemConfig.clinicIdentity || {};
        applyClinicIdentityToInputs(currentClinicIdentity);
        writeClinicIdentityCache(currentClinicIdentity);

        console.log('[configuracion] Configuracion aplicada:', {
            settings: mergedSettings,
            clinicIdentity: currentClinicIdentity
        });

        return {
            settings: mergedSettings,
            clinicIdentity: currentClinicIdentity
        };
    };

    const saveSettings = async () => {
        const settingsPayload = collectSettingsFromInputs();
        const clinicIdentityPayload = collectClinicIdentityFromInputs();

        console.log('[configuracion] Datos del formulario listos para guardar:', {
            settings: settingsPayload,
            clinicIdentity: clinicIdentityPayload
        });

        const api = window.api?.clinicConfig;
        if (!api?.saveSystemConfig && !api?.saveSettings) {
            toast.show('API de configuracion no disponible', 'error');
            return;
        }

        try {
            if (elements.saveAllBtn) {
                elements.saveAllBtn.disabled = true;
            }

            let persisted;
            if (api.saveSystemConfig) {
                persisted = await api.saveSystemConfig({
                    settings: settingsPayload,
                    clinicIdentity: clinicIdentityPayload
                });
            } else {
                const [settings, clinicIdentityResult] = await Promise.all([
                    api.saveSettings(settingsPayload),
                    api.saveConfig ? api.saveConfig(clinicIdentityPayload) : Promise.resolve({ clinicIdentity: clinicIdentityPayload })
                ]);
                persisted = {
                    settings,
                    clinicIdentity: clinicIdentityResult?.clinicIdentity || clinicIdentityPayload
                };
            }

            console.log('[configuracion] Payload persistido en BD:', persisted);

            const mergedSettings = syncSettingsMirror(persisted?.settings || settingsPayload);
            currentClinicIdentity = persisted?.clinicIdentity || clinicIdentityPayload;
            applySettingsToInputs(mergedSettings);
            applyClinicIdentityToInputs(currentClinicIdentity);
            writeClinicIdentityCache(currentClinicIdentity);

            window.dispatchEvent(new CustomEvent('configurationChanged', {
                detail: mergedSettings
            }));

            toast.show('Configuracion guardada correctamente', 'success');
        } catch (error) {
            console.error('[configuracion] Error al guardar configuracion:', error);
            toast.show(`No se pudo guardar la configuracion: ${error.message || 'error desconocido'}`, 'error');
        } finally {
            if (elements.saveAllBtn) {
                elements.saveAllBtn.disabled = false;
            }
        }
    };

    const resetSettings = async () => {
        if (!confirm('Estas seguro de que deseas restaurar la configuracion por defecto? Esta accion no se puede deshacer.')) {
            return;
        }

        console.log('[configuracion] Restaurando configuracion por defecto...');

        const api = window.api?.clinicConfig;
        try {
            if (elements.saveAllBtn) {
                elements.saveAllBtn.disabled = true;
            }

            let persistedSettings = cloneDefaultSettings();
            if (api?.saveSettings) {
                persistedSettings = await api.saveSettings(cloneDefaultSettings());
            }

            const mergedSettings = syncSettingsMirror(persistedSettings);
            applySettingsToInputs(mergedSettings);

            window.dispatchEvent(new CustomEvent('configurationChanged', {
                detail: mergedSettings
            }));

            toast.show('Configuracion restaurada a valores por defecto', 'success');
        } catch (error) {
            console.error('[configuracion] Error restaurando configuracion:', error);
            toast.show(`No se pudo restaurar la configuracion: ${error.message || 'error desconocido'}`, 'error');
        } finally {
            if (elements.saveAllBtn) {
                elements.saveAllBtn.disabled = false;
            }
        }
    };

    elements.saveAllBtn?.addEventListener('click', saveSettings);
    elements.resetSettingsBtn?.addEventListener('click', resetSettings);

    elements.themeRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            console.log('[configuracion] Tema cambiado a:', e.target.value);
        });
    });

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
            elements.lunchStartInput,
            elements.lunchEndInput,
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
            elements.firstDayWeekSelect,
            elements.clinicaNombreInput,
            elements.clinicaTitularNombreInput,
            elements.clinicaTitularEspecialidadInput,
            elements.clinicaTitularCedulaInput,
            elements.clinicaTitularRfcInput,
            elements.clinicaTelefonoInput,
            elements.clinicaDireccionInput
        ].filter(Boolean);

        allInputs.forEach((input) => {
            input.addEventListener('change', async () => {
                if (elements.autoSaveCheckbox?.checked) {
                    console.log('[configuracion] Auto-guardando...');
                    await saveSettings();
                }
            });
        });
    };

    setupAutoSave();

    const openPasswordResetModal = () => {
        if (!window.api || typeof window.api.requestPasswordReset !== 'function') {
            toast.show('No se encontro el servicio para cambiar contrasena.', 'error');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Cambiar contrasena</h3>
                    <p class="text-white/70 text-sm mt-1">Recibiras un codigo en tu correo</p>
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
                            <button type="submit" class="flex-1 py-2.5 bg-[#4EABBE] text-white rounded-xl hover:bg-[#1D5D69] font-semibold shadow-lg shadow-cyan-500/20 transition-all">Enviar codigo</button>
                        </div>
                    </form>
                    <form id="pwConfirmForm" class="space-y-4 hidden">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Codigo de verificacion</label>
                            <input id="pwToken" type="text" required
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nueva contrasena</label>
                            <input id="pwNew" type="password" required minlength="8"
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirmar contrasena</label>
                            <input id="pwConfirm" type="password" required minlength="8"
                                class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4EABBE]"/>
                        </div>
                        <div class="flex gap-3">
                            <button type="button" id="pwBack" class="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors">Atras</button>
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
                    toast.show(result.message || 'Se envio un codigo al correo.', 'success');
                    requestForm.classList.add('hidden');
                    confirmForm.classList.remove('hidden');
                } else {
                    toast.show(result?.error || 'No se pudo enviar el codigo', 'error');
                }
            } catch (err) {
                toast.show('Error solicitando el codigo de recuperacion', 'error');
            }
        });

        confirmForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = tokenInput?.value?.trim();
            const newPassword = newPassInput?.value || '';
            const confirmPassword = confirmInput?.value || '';

            if (!token) {
                toast.show('Ingresa el codigo de verificacion', 'warning');
                return;
            }
            if (newPassword.length < 8) {
                toast.show('La contrasena debe tener al menos 8 caracteres', 'warning');
                return;
            }
            if (newPassword !== confirmPassword) {
                toast.show('Las contrasenas no coinciden', 'warning');
                return;
            }

            try {
                const result = await window.api.resetPassword(token, newPassword);
                if (result?.success) {
                    toast.show(result.message || 'Contrasena actualizada', 'success');
                    closeModal();
                } else {
                    toast.show(result?.error || 'No se pudo actualizar la contrasena', 'error');
                }
            } catch (err) {
                toast.show('Error al actualizar la contrasena', 'error');
            }
        });
    };

    const openSessionsModal = () => {
        const session = safeParseJSON(localStorage.getItem('sesionActual'), {}) || {};
        const nombre = [session.nombre, session.apellido].filter(Boolean).join(' ') || 'Usuario';
        const rol = session.rol || '-';
        const userId = session.id || '-';
        const lastLogin = localStorage.getItem('sesionLastLogin') || '-';

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700">
                <div class="bg-gradient-to-r from-[#1D5D69] to-[#4EABBE] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Sesiones activas</h3>
                    <p class="text-white/70 text-sm mt-1">Detalle de la sesion actual</p>
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
                        <span class="text-gray-500 dark:text-gray-400">Ultimo acceso</span>
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

    const initialize = async () => {
        try {
            await loadPersistedConfiguration({ migrateLegacySettings: true });
            console.log('[configuracion] Inicializacion completa');
        } catch (error) {
            console.error('[configuracion] Error en inicializacion:', error);
            toast.show('No se pudo cargar la configuracion guardada', 'warning');
            applySettingsToInputs(defaultSettings);
            applyClinicIdentityToInputs(readClinicIdentityCache());
        }
    };

    void initialize();

    elements.changePasswordBtn?.addEventListener('click', openPasswordResetModal);
    elements.viewSessionsBtn?.addEventListener('click', openSessionsModal);

    // ── Updates UI Logic ──────────────────────────────────────────────────
    const initUpdatesUI = async () => {
        if (!window.api?.updates) {
            console.warn('[actualizaciones] API de actualizaciones no disponible.');
            return;
        }

        const uElements = {
            currentVersion: document.getElementById('updates-current-version'),
            statusBadge: document.getElementById('updates-status-badge'),
            statusText: document.getElementById('updates-status-text'),
            releaseSummary: document.getElementById('updates-release-summary'),
            checkBtn: document.getElementById('check-updates-btn'),
            downloadBtn: document.getElementById('download-update-btn'),
            installBtn: document.getElementById('install-update-btn'),
            refreshHistoryBtn: document.getElementById('refresh-updates-history-btn'),
            historyList: document.getElementById('updates-history-list'),
            releaseNotes: document.getElementById('updates-release-notes'),
        };

        let currentAppVersion = '--';

        const updateUIState = (state) => {
            if (!state) return;
            
            if (state.currentVersion && state.currentVersion !== 'unknown') {
                currentAppVersion = state.currentVersion;
                if (uElements.currentVersion) {
                    uElements.currentVersion.textContent = `Version actual: ${state.currentVersion}`;
                }
            }

            if (uElements.statusBadge) {
                uElements.statusBadge.className = 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold';
            }

            if (uElements.checkBtn) uElements.checkBtn.classList.remove('hidden');
            if (uElements.downloadBtn) uElements.downloadBtn.classList.add('hidden');
            if (uElements.installBtn) uElements.installBtn.classList.add('hidden');

            switch (state.status) {
                case 'idle':
                case 'development-mode':
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = state.status === 'idle' ? 'Al dia' : 'Modo Dev';
                        uElements.statusBadge.classList.add('bg-emerald-100', 'text-emerald-700', 'dark:bg-emerald-900/30', 'dark:text-emerald-400');
                    }
                    if (uElements.statusText) uElements.statusText.textContent = 'La aplicación está actualizada.';
                    if (uElements.releaseSummary) uElements.releaseSummary.textContent = 'No hay actualizaciones pendientes.';
                    break;
                case 'checking':
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = 'Buscando...';
                        uElements.statusBadge.classList.add('bg-blue-100', 'text-blue-700', 'dark:bg-blue-900/30', 'dark:text-blue-400');
                    }
                    if (uElements.statusText) uElements.statusText.textContent = 'Buscando nuevas versiones...';
                    if (uElements.checkBtn) uElements.checkBtn.disabled = true;
                    break;
                case 'update-available':
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = 'Nueva versión';
                        uElements.statusBadge.classList.add('bg-amber-100', 'text-amber-700', 'dark:bg-amber-900/30', 'dark:text-amber-400');
                    }
                    if (uElements.statusText) uElements.statusText.textContent = `Versión ${state.updateInfo?.version || ''} disponible.`;
                    if (uElements.releaseSummary) uElements.releaseSummary.textContent = 'Haz clic en descargar para comenzar.';
                    if (uElements.checkBtn) uElements.checkBtn.classList.add('hidden');
                    if (uElements.downloadBtn) uElements.downloadBtn.classList.remove('hidden');
                    break;
                case 'downloading':
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = `Descargando ${Math.round(state.progress?.percent || 0)}%`;
                        uElements.statusBadge.classList.add('bg-cyan-100', 'text-cyan-700', 'dark:bg-cyan-900/30', 'dark:text-cyan-400');
                    }
                    if (uElements.statusText) uElements.statusText.textContent = 'Descargando actualización...';
                    if (uElements.checkBtn) uElements.checkBtn.classList.add('hidden');
                    break;
                case 'downloaded':
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = 'Lista para instalar';
                        uElements.statusBadge.classList.add('bg-emerald-100', 'text-emerald-700', 'dark:bg-emerald-900/30', 'dark:text-emerald-400');
                    }
                    if (uElements.statusText) uElements.statusText.textContent = 'La actualización se ha descargado correctamente.';
                    if (uElements.releaseSummary) uElements.releaseSummary.textContent = 'Instala y reinicia para aplicar los cambios.';
                    if (uElements.checkBtn) uElements.checkBtn.classList.add('hidden');
                    if (uElements.installBtn) uElements.installBtn.classList.remove('hidden');
                    break;
                case 'error':
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = 'Error';
                        uElements.statusBadge.classList.add('bg-red-100', 'text-red-700', 'dark:bg-red-900/30', 'dark:text-red-400');
                    }
                    if (uElements.statusText) uElements.statusText.textContent = 'Error al actualizar.';
                    if (uElements.releaseSummary) uElements.releaseSummary.textContent = state.error?.message || 'Error desconocido';
                    if (uElements.checkBtn) uElements.checkBtn.disabled = false;
                    break;
                default:
                    if (uElements.statusBadge) {
                        uElements.statusBadge.textContent = 'Desconocido';
                        uElements.statusBadge.classList.add('bg-gray-100', 'text-gray-700');
                    }
                    if (uElements.checkBtn) uElements.checkBtn.disabled = false;
            }
            
            if (state.status !== 'checking' && state.status !== 'error') {
                if (uElements.checkBtn) uElements.checkBtn.disabled = false;
            }
        };

        const formatDate = (isoString) => {
            if (!isoString) return '';
            const d = new Date(isoString);
            return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
        };

        const loadHistory = async (force = false) => {
            if (!uElements.historyList) return;
            if (force) {
                uElements.historyList.innerHTML = 'Actualizando historial...';
            }
            
            try {
                const res = await window.api.updates.getHistory({ force });
                if (!res.success) {
                    uElements.historyList.innerHTML = \`<span class="text-red-500">\${res.error}</span>\`;
                    return;
                }
                
                const releases = res.releases || [];
                if (releases.length === 0) {
                    uElements.historyList.innerHTML = 'No hay versiones publicadas.';
                    return;
                }
                
                uElements.historyList.innerHTML = releases.map((rel, index) => {
                    const isLatest = index === 0;
                    const isCurrent = rel.version.replace('v', '') === currentAppVersion;
                    return \`
                        <div class="flex items-start justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded transition" data-release-id="\${rel.id}">
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-gray-800 dark:text-gray-200">\${rel.title || rel.version}</span>
                                    \${isLatest ? '<span class="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 text-[10px] rounded uppercase tracking-wider font-bold">Latest</span>' : ''}
                                    \${isCurrent ? '<span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] rounded uppercase tracking-wider font-bold">Instalada</span>' : ''}
                                </div>
                                <div class="text-xs text-gray-500 mt-1">\${formatDate(rel.publishedAt)}</div>
                            </div>
                        </div>
                    \`;
                }).join('');

                const items = uElements.historyList.querySelectorAll('[data-release-id]');
                items.forEach((el, index) => {
                    el.addEventListener('click', () => {
                        const rel = releases[index];
                        if (uElements.releaseNotes) {
                            uElements.releaseNotes.innerHTML = \`
                                <h4 class="font-bold text-gray-800 dark:text-white mb-2">\${rel.title} (\${rel.version})</h4>
                                <div class="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">\${rel.notes || 'Sin notas de lanzamiento'}</div>
                            \`;
                        }
                    });
                });
                
                if (releases.length > 0 && uElements.releaseNotes) {
                    uElements.releaseNotes.innerHTML = \`
                        <h4 class="font-bold text-gray-800 dark:text-white mb-2">\${releases[0].title} (\${releases[0].version})</h4>
                        <div class="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">\${releases[0].notes || 'Sin notas de lanzamiento'}</div>
                    \`;
                }

            } catch (err) {
                uElements.historyList.innerHTML = '<span class="text-red-500">Error al cargar historial</span>';
            }
        };

        if (window.api.updates.onStatusChange) {
            window.api.updates.onStatusChange(updateUIState);
        }

        const initialState = await window.api.updates.getState();
        updateUIState(initialState);
        
        await loadHistory();

        uElements.checkBtn?.addEventListener('click', async () => {
            uElements.checkBtn.disabled = true;
            await window.api.updates.check();
        });

        uElements.downloadBtn?.addEventListener('click', async () => {
            uElements.downloadBtn.classList.add('hidden');
            await window.api.updates.download();
        });

        uElements.installBtn?.addEventListener('click', async () => {
            uElements.installBtn.disabled = true;
            await window.api.updates.install();
        });

        uElements.refreshHistoryBtn?.addEventListener('click', () => {
            loadHistory(true);
        });
    };

    initUpdatesUI();
});
