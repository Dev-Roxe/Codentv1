const { contextBridge, ipcRenderer } = require('electron');

// No requerimos la DB directamente aquí (evita problemas con empaquetadores).
// En su lugar, exponemos funciones que usan IPC para pedir al proceso main
// que ejecute las consultas. Para compatibilidad con el código existente
// que usa callbacks, la API soporta tanto callback como promesas.
contextBridge.exposeInMainWorld('api', {
    registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
    loginUser: (userData) => ipcRenderer.invoke('login-user', userData),
    openView: (viewName) => ipcRenderer.invoke('open-view', viewName),
    getUserProfile: (params) => ipcRenderer.invoke('get-user-profile', params),
    updateUserProfile: (userData) => ipcRenderer.invoke('update-user-profile', userData),
    db: {
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
    }
});

// API de Electron para IPC (email, etc.)
contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

// util para enviar logs desde renderer al proceso main (aparecerán en la terminal)
contextBridge.exposeInMainWorld('logToMain', {
    log: (msg) => ipcRenderer.send('renderer-log', msg)
});
