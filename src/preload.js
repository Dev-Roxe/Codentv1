const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    registerUser: (userData) => ipcRenderer.invoke('register-user', userData),
    loginUser: (userData) => ipcRenderer.invoke('login-user', userData)
    ,
    openView: (viewName) => ipcRenderer.invoke('open-view', viewName)
});

// util para enviar logs desde renderer al proceso main (aparecerán en la terminal)
contextBridge.exposeInMainWorld('logToMain', {
    log: (msg) => ipcRenderer.send('renderer-log', msg)
});
