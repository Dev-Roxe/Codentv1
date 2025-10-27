const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db/database'); // Asegúrate de tener database.js
const bcrypt = require('bcryptjs');


// Solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '../node_modules/.bin/electron'),
    hardResetMethod: 'exit'
  });
}

// Función para crear la ventana
let mainWindow = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Guarda la referencia para usarla desde IPC handlers
  mainWindow = win;

  // Carga la vista inicial
  win.loadFile(path.join(__dirname, 'renderer', 'views', 'login.html'));
};

// Manejo del registro de usuario
ipcMain.handle('register-user', async (event, userData) => {
  const hashedPassword = bcrypt.hashSync(userData.password, 10);
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`,
      [userData.nombre, userData.email, hashedPassword, userData.rol],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

// Manejo del login de usuario
ipcMain.handle('login-user', async (event, userData) => {
  return new Promise((resolve, reject) => {
          // Permitimos buscar por email o por nombre de usuario (campo nombre)
          const lookup = userData.email; // puede ser email o nombre de usuario según el frontend
          db.get(
            `SELECT * FROM usuarios WHERE email = ? OR nombre = ?`,
            [lookup, lookup],
            (err, row) => {
              if (err) return reject(err);
              if (!row) return reject(new Error('Usuario no encontrado'));

              const match = bcrypt.compareSync(userData.password, row.password);
              if (match) resolve({ id: row.id, nombre: row.nombre, rol: row.rol });
              else reject(new Error('Contraseña incorrecta'));
            }
          );
  });
});

// Handler para pedir al proceso principal que cargue otra vista (navegación segura)
ipcMain.handle('open-view', async (event, viewName) => {
  if (!mainWindow) throw new Error('Main window no disponible');

  // Lista blanca de vistas permitidas para evitar carga arbitraria
  const views = {
    pacientes: path.join(__dirname, 'renderer', 'views', 'pacientes.html'),
    login: path.join(__dirname, 'renderer', 'views', 'login.html'),
    register: path.join(__dirname, 'renderer', 'views', 'register.html'),
    index: path.join(__dirname, 'renderer', 'views', 'index.html')
  };

  const target = views[viewName];
  if (!target) throw new Error('Vista no permitida: ' + String(viewName));

  await mainWindow.loadFile(target);
  return { ok: true, view: viewName };
});

// Eventos de app
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Listener para logs enviados desde renderer (útil en desarrollo)
ipcMain.on('renderer-log', (event, msg) => {
  console.log('[renderer]', msg);
});
