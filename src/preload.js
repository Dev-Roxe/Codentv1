const { contextBridge, ipcRenderer } = require('electron');

function normalizeDbParams(params) {
    if (typeof params === 'function') {
        return [];
    }
    if (params == null) {
        return [];
    }
    return Array.isArray(params) ? params : [params];
}

function invokeLegacyDb(channel, sql, params, callback) {
    const finalCallback = typeof params === 'function'
        ? params
        : (typeof callback === 'function' ? callback : null);
    const finalParams = normalizeDbParams(params);
    const request = ipcRenderer.invoke(channel, sql, finalParams);

    if (finalCallback) {
        request
            .then((result) => finalCallback(null, result))
            .catch((error) => finalCallback(error));
        return undefined;
    }

    return request;
}

const legacyDbApi = Object.freeze({
    all: (sql, params, callback) => invokeLegacyDb('db-all', sql, params, callback),
    get: (sql, params, callback) => invokeLegacyDb('db-get', sql, params, callback),
    run: (sql, params, callback) => invokeLegacyDb('db-run', sql, params, callback),
});

const financeApi = Object.freeze({
    saveTreatmentPlan: (data) => ipcRenderer.invoke('finance-save-treatment-plan', data),
    getTreatmentPlanDetail: (planId) => ipcRenderer.invoke('finance-get-treatment-plan-detail', planId),
    getPatientSummary: (patientId) => ipcRenderer.invoke('finance-get-patient-summary', patientId),
    updateTreatmentPlanProgress: (data) => ipcRenderer.invoke('finance-update-treatment-plan-progress', data),
    setTreatmentPlanStatus: (data) => ipcRenderer.invoke('finance-set-treatment-plan-status', data),
    cancelTreatmentPlan: (data) => ipcRenderer.invoke('finance-cancel-treatment-plan', data),
    deleteTreatmentPlan: (data) => ipcRenderer.invoke('finance-delete-treatment-plan', data),
    registerPayment: (data) => ipcRenderer.invoke('finance-register-payment', data),
    registerRefund: (data) => ipcRenderer.invoke('finance-register-refund', data),
    generateSimulatedInvoice: (data) => ipcRenderer.invoke('finance-generate-simulated-invoice', data),
    getSimulatedInvoices: (filters) => ipcRenderer.invoke('finance-get-simulated-invoices', filters),
    getOverdueAccounts: (filters) => ipcRenderer.invoke('finance-get-overdue-accounts', filters || {}),
    getReport: (filters) => ipcRenderer.invoke('finance-get-report', filters),
    sendCollectionReminder: (data) => ipcRenderer.invoke('finance-send-collection-reminder', data),
});

const odontogramApi = Object.freeze({
    saveDiagnosis: (data) => ipcRenderer.invoke('odontogram-save-diagnosis', data || {}),
    clearDiagnosis: (data) => ipcRenderer.invoke('odontogram-clear-diagnosis', data || {}),
});

const clinicConfigApi = Object.freeze({
    getConfig: () => ipcRenderer.invoke('clinic-get-config'),
    saveConfig: (payload) => ipcRenderer.invoke('clinic-save-config', payload || {}),
});

const cajasReportApi = Object.freeze({
    getMovimientosAvanzado: (filters) => ipcRenderer.invoke('cajas-get-movimientos-avanzado', filters || {}),
    getResumenContable: (filters) => ipcRenderer.invoke('cajas-get-resumen-contable', filters || {}),
    getSaldosMetodo: (filters) => ipcRenderer.invoke('cajas-get-saldos-metodo', filters || {}),
});

const cashApi = Object.freeze({
    openBox: (payload) => ipcRenderer.invoke('cash-open-box', payload || {}),
    closeBox: (payload) => ipcRenderer.invoke('cash-close-box', payload || {}),
    recordMovement: (payload) => ipcRenderer.invoke('cash-record-movement', payload || {}),
});

const updatesApi = Object.freeze({
    getState: () => ipcRenderer.invoke('updates-get-state'),
    check: () => ipcRenderer.invoke('updates-check'),
    download: () => ipcRenderer.invoke('updates-download'),
    install: () => ipcRenderer.invoke('updates-install'),
    getHistory: (options) => ipcRenderer.invoke('updates-get-history', options || {}),
});

const patientsApi = Object.freeze({
    getFieldConfig: () => ipcRenderer.invoke('patients-get-field-config'),
    saveFieldConfig: (config) => ipcRenderer.invoke('patients-save-field-config', config || {}),
    list: () => ipcRenderer.invoke('patients-list'),
    listBasic: () => ipcRenderer.invoke('patients-list-basic'),
    getById: (patientId) => ipcRenderer.invoke('patients-get-by-id', patientId),
    save: (payload) => ipcRenderer.invoke('patients-save', payload || {}),
    remove: (patientId) => ipcRenderer.invoke('patients-remove', patientId),
});

const appointmentsApi = Object.freeze({
    listProfessionals: () => ipcRenderer.invoke('appointments-list-professionals'),
    listSpecialists: () => ipcRenderer.invoke('appointments-list-specialists'),
    listPatients: () => ipcRenderer.invoke('appointments-list-patients'),
    listDaily: (dateValue) => ipcRenderer.invoke('appointments-list-daily', dateValue),
    listRange: (filters) => ipcRenderer.invoke('appointments-list-range', filters || {}),
    create: (payload) => ipcRenderer.invoke('appointments-create', payload || {}),
    update: (payload) => ipcRenderer.invoke('appointments-update', payload || {}),
    updateStatus: (payload) => ipcRenderer.invoke('appointments-update-status', payload || {}),
    move: (payload) => ipcRenderer.invoke('appointments-move', payload || {}),
    remove: (appointmentId) => ipcRenderer.invoke('appointments-remove', appointmentId),
    getNotificationDetails: (appointmentId) => ipcRenderer.invoke('appointments-get-notification-details', appointmentId),
    listUpcoming: (filters) => ipcRenderer.invoke('appointments-list-upcoming', filters || {}),
});

const specialistsApi = Object.freeze({
    list: () => ipcRenderer.invoke('specialists-list'),
    getById: (specialistId) => ipcRenderer.invoke('specialists-get-by-id', specialistId),
    save: (payload) => ipcRenderer.invoke('specialists-save', payload || {}),
    remove: (specialistId) => ipcRenderer.invoke('specialists-remove', specialistId),
});

const catalogApi = Object.freeze({
    listTreatments: (filters) => ipcRenderer.invoke('catalog-list-treatments', filters || {}),
    getTreatmentById: (treatmentId) => ipcRenderer.invoke('catalog-get-treatment-by-id', treatmentId),
    saveTreatment: (payload) => ipcRenderer.invoke('catalog-save-treatment', payload || {}),
    removeTreatment: (treatmentId) => ipcRenderer.invoke('catalog-remove-treatment', treatmentId),
    listMedicines: () => ipcRenderer.invoke('catalog-list-medicines'),
    getMedicineById: (medicineId) => ipcRenderer.invoke('catalog-get-medicine-by-id', medicineId),
    saveMedicine: (payload) => ipcRenderer.invoke('catalog-save-medicine', payload || {}),
    removeMedicine: (medicineId) => ipcRenderer.invoke('catalog-remove-medicine', medicineId),
    listSupplies: (filters) => ipcRenderer.invoke('catalog-list-supplies', filters || {}),
    getSupplyById: (supplyId) => ipcRenderer.invoke('catalog-get-supply-by-id', supplyId),
    saveSupply: (payload) => ipcRenderer.invoke('catalog-save-supply', payload || {}),
    removeSupply: (supplyId) => ipcRenderer.invoke('catalog-remove-supply', supplyId),
});

const clinicalApi = Object.freeze({
    getAntecedentes: (patientId) => ipcRenderer.invoke('clinical-get-antecedentes', patientId),
    saveAntecedentes: (payload) => ipcRenderer.invoke('clinical-save-antecedentes', payload || {}),
    listDefaultConditions: () => ipcRenderer.invoke('clinical-list-default-conditions'),
    addDefaultCondition: (name) => ipcRenderer.invoke('clinical-add-default-condition', name),
    removeDefaultCondition: (conditionId) => ipcRenderer.invoke('clinical-remove-default-condition', conditionId),
    listRadiographs: (patientId) => ipcRenderer.invoke('clinical-list-radiographs', patientId),
    saveRadiograph: (payload) => ipcRenderer.invoke('clinical-save-radiograph', payload || {}),
    removeRadiograph: (payload) => ipcRenderer.invoke('clinical-remove-radiograph', payload || {}),
    getPeriodontogram: (patientId) => ipcRenderer.invoke('clinical-get-periodontogram', patientId),
    savePeriodontogram: (payload) => ipcRenderer.invoke('clinical-save-periodontogram', payload || {}),
    saveTreatmentRecord: (payload) => ipcRenderer.invoke('clinical-save-treatment-record', payload || {}),
    listTreatmentHistory: (patientId) => ipcRenderer.invoke('clinical-list-treatment-history', patientId),
    listPrescriptions: (patientId) => ipcRenderer.invoke('clinical-list-prescriptions', patientId),
});

const crmApi = Object.freeze({
    saveTemplate: (payload) => ipcRenderer.invoke('crm-save-template', payload || {}),
    archiveTemplate: (templateId) => ipcRenderer.invoke('crm-archive-template', templateId),
    restoreTemplate: (templateId) => ipcRenderer.invoke('crm-restore-template', templateId),
    duplicateTemplate: (templateId) => ipcRenderer.invoke('crm-duplicate-template', templateId),
    setDefaultReminderTemplate: (templateId) => ipcRenderer.invoke('crm-set-default-reminder-template', templateId),
    saveCampaign: (payload) => ipcRenderer.invoke('crm-save-campaign', payload || {}),
    deleteCampaign: (campaignId) => ipcRenderer.invoke('crm-delete-campaign', campaignId),
    logSurveyDispatch: (payload) => ipcRenderer.invoke('crm-log-survey-dispatch', payload || {}),
    recordReminderDeliveries: (payload) => ipcRenderer.invoke('crm-record-reminder-deliveries', payload || {}),
    saveSurveyTemplate: (payload) => ipcRenderer.invoke('crm-save-survey-template', payload || {}),
    archiveSurveyTemplate: (templateId) => ipcRenderer.invoke('crm-archive-survey-template', templateId),
});

// No requerimos la DB directamente aquí (evita problemas con empaquetadores).
// En su lugar, exponemos funciones que usan IPC para pedir al proceso main
// que ejecute las consultas. Para compatibilidad con el código existente
// que usa callbacks, la API soporta tanto callback como promesas.
contextBridge.exposeInMainWorld('api', Object.freeze({
    registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
    loginUser: (userData) => ipcRenderer.invoke('login-user', userData),
    logoutUser: () => ipcRenderer.invoke('logout-user'),
    verifySessionPassword: (email, password) => ipcRenderer.invoke('verify-session-password', { email, password }),
    getAuthState: () => ipcRenderer.invoke('get-auth-state'),
    openView: (viewName) => ipcRenderer.invoke('open-view', viewName),
    getUserProfile: (params) => ipcRenderer.invoke('get-user-profile', params),
    updateUserProfile: (userData) => ipcRenderer.invoke('update-user-profile', userData),
    // Google OAuth
    googleOAuthAuthenticate: (mode) => ipcRenderer.invoke('google-oauth-authenticate', mode),
    getPendingOAuthRegistration: () => ipcRenderer.invoke('get-pending-oauth-registration'),
    clearPendingOAuthRegistration: () => ipcRenderer.invoke('clear-pending-oauth-registration'),
    completeOAuthRegistration: (payload) => ipcRenderer.invoke('complete-oauth-registration', payload || {}),
    db: legacyDbApi,
    // Password Recovery
    requestPasswordReset: (email) => ipcRenderer.invoke('request-password-reset', email),
    validateResetToken: (token) => ipcRenderer.invoke('validate-reset-token', token),
    resetPassword: (token, newPassword) => ipcRenderer.invoke('reset-password', { token, newPassword }),
    // Appointment Notifications
    sendAppointmentNotification: (data) => ipcRenderer.invoke('send-appointment-notification', data),
    // Backup (S10)
    backupRunManual: () => ipcRenderer.invoke('backup-run-manual'),
    backupList: () => ipcRenderer.invoke('backup-list'),
    updates: updatesApi,
    patients: patientsApi,
    appointments: appointmentsApi,
    specialists: specialistsApi,
    catalog: catalogApi,
    clinical: clinicalApi,
    crm: crmApi,
    finance: financeApi,
    odontogram: odontogramApi,
    clinicConfig: clinicConfigApi,
    cash: cashApi,
    cajasReport: cajasReportApi,
}));

// API de Electron para IPC (email, etc.)
// ⚠️ SECURITY: Solo canales explícitamente permitidos pueden ser invocados.
// Cualquier canal fuera de esta lista será bloqueado.
const ALLOWED_INVOKE_CHANNELS = new Set([
    'gmail-has-token',
    'gmail-send',
    'send-bulk-email',
    'send-appointment-notification',
    'google-oauth-authenticate',
    'google-oauth-logout',
    'complete-oauth-registration',
    'open-external',
]);

const ALLOWED_SEND_CHANNELS = new Set([
    'renderer-log',
]);

const ALLOWED_ON_CHANNELS = new Set([
    'email-progress',
    'updates-status',
]);

contextBridge.exposeInMainWorld('electronAPI', Object.freeze({
    invoke: (channel, data) => {
        if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
            throw new Error(`Canal IPC no autorizado: "${channel}"`);
        }
        return ipcRenderer.invoke(channel, data);
    },
    send: (channel, data) => {
        if (!ALLOWED_SEND_CHANNELS.has(channel)) {
            throw new Error(`Canal IPC send no autorizado: "${channel}"`);
        }
        ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
        if (!ALLOWED_ON_CHANNELS.has(channel)) {
            throw new Error(`Canal IPC on no autorizado: "${channel}"`);
        }
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
}));

// util para enviar logs desde renderer al proceso main (aparecerán en la terminal)
contextBridge.exposeInMainWorld('logToMain', Object.freeze({
    log: (msg) => ipcRenderer.send('renderer-log', msg)
}));
