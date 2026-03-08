const { contextBridge, ipcRenderer } = require('electron');

const financeApi = Object.freeze({
    saveTreatmentPlan: (data) => ipcRenderer.invoke('finance-save-treatment-plan', data),
    getTreatmentPlanDetail: (planId) => ipcRenderer.invoke('finance-get-treatment-plan-detail', planId),
    getPatientSummary: (patientId) => ipcRenderer.invoke('finance-get-patient-summary', patientId),
    registerPayment: (data) => ipcRenderer.invoke('finance-register-payment', data),
    registerRefund: (data) => ipcRenderer.invoke('finance-register-refund', data),
    generateSimulatedInvoice: (data) => ipcRenderer.invoke('finance-generate-simulated-invoice', data),
    getSimulatedInvoices: (filters) => ipcRenderer.invoke('finance-get-simulated-invoices', filters),
    getOverdueAccounts: () => ipcRenderer.invoke('finance-get-overdue-accounts'),
    getReport: (filters) => ipcRenderer.invoke('finance-get-report', filters),
    sendCollectionReminder: (data) => ipcRenderer.invoke('finance-send-collection-reminder', data),
});

const cajasReportApi = Object.freeze({
    getMovimientosAvanzado: (filters) => ipcRenderer.invoke('cajas-get-movimientos-avanzado', filters || {}),
    getResumenContable: (filters) => ipcRenderer.invoke('cajas-get-resumen-contable', filters || {}),
    getSaldosMetodo: (filters) => ipcRenderer.invoke('cajas-get-saldos-metodo', filters || {}),
});

const dbApi = Object.freeze({
    all: (sql, params, cb) => {
        const p = ipcRenderer.invoke('db-all', sql, params || []);
        if (typeof cb === 'function') {
            p.then(rows => cb(null, rows)).catch(err => cb(err));
            return;
        }
        return p;
    },
    get: (sql, params, cb) => {
        const p = ipcRenderer.invoke('db-get', sql, params || []);
        if (typeof cb === 'function') {
            p.then(row => cb(null, row)).catch(err => cb(err));
            return;
        }
        return p;
    },
    run: (sql, params, cb) => {
        const p = ipcRenderer.invoke('db-run', sql, params || []);
        if (typeof cb === 'function') {
            p.then(res => cb(null, res)).catch(err => cb(err));
            return;
        }
        return p;
    }
});

// No requerimos la DB directamente aquí (evita problemas con empaquetadores).
// En su lugar, exponemos funciones que usan IPC para pedir al proceso main
// que ejecute las consultas. Para compatibilidad con el código existente
// que usa callbacks, la API soporta tanto callback como promesas.
contextBridge.exposeInMainWorld('api', Object.freeze({
    registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
    loginUser: (userData) => ipcRenderer.invoke('login-user', userData),
    openView: (viewName) => ipcRenderer.invoke('open-view', viewName),
    getUserProfile: (params) => ipcRenderer.invoke('get-user-profile', params),
    updateUserProfile: (userData) => ipcRenderer.invoke('update-user-profile', userData),
    // Google OAuth
    googleOAuthAuthenticate: () => ipcRenderer.invoke('google-oauth-authenticate'),
    completeOAuthRegistration: (userInfo, role) => ipcRenderer.invoke('complete-oauth-registration', { userInfo, role }),
    // Password Recovery
    requestPasswordReset: (email) => ipcRenderer.invoke('request-password-reset', email),
    validateResetToken: (token) => ipcRenderer.invoke('validate-reset-token', token),
    resetPassword: (token, newPassword) => ipcRenderer.invoke('reset-password', { token, newPassword }),
    // Appointment Notifications
    sendAppointmentNotification: (data) => ipcRenderer.invoke('send-appointment-notification', data),
    // Backup (S10)
    backupRunManual: () => ipcRenderer.invoke('backup-run-manual'),
    backupList: () => ipcRenderer.invoke('backup-list'),
    finance: financeApi,
    cajasReport: cajasReportApi,
    db: dbApi
}));

// API de Electron para IPC (email, etc.)
// ⚠️ SECURITY: Solo canales explícitamente permitidos pueden ser invocados.
// Cualquier canal fuera de esta lista será bloqueado.
const ALLOWED_INVOKE_CHANNELS = new Set([
    'gmail-connect-fixed-account',
    'gmail-get-auth-url',
    'gmail-save-token',
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
