const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db/database');
const bcrypt = require('bcryptjs');

// -------------------------------------------------------------
// DEV-ONLY: AUTO-RELOAD
// -------------------------------------------------------------
// if (process.env.NODE_ENV !== 'production') {
//   require('electron-reload')(__dirname, {
//     electron: path.join(__dirname, '../node_modules/.bin/electron'),
//     hardResetMethod: 'exit',
//   });
// }

// -------------------------------------------------------------
// MAIN WINDOW
// -------------------------------------------------------------
let mainWindow = null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow = win;
  win.loadFile(path.join(__dirname, 'renderer', 'views', 'login.html'));
};

// -------------------------------------------------------------
// USER REGISTRATION
// -------------------------------------------------------------
ipcMain.handle('register-user', async (event, userData) => {
  const hashedPassword = bcrypt.hashSync(userData.password, 10);

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)`,
      [userData.nombre, userData.email, hashedPassword, userData.rol],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

// -------------------------------------------------------------
// USER LOGIN
// -------------------------------------------------------------
ipcMain.handle('login-user', async (event, userData) => {
  return new Promise((resolve, reject) => {
    const lookup = userData.email;

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

// -------------------------------------------------------------
// GET USER PROFILE
// -------------------------------------------------------------
ipcMain.handle('get-user-profile', async (event, params) => {
  return new Promise((resolve, reject) => {
    if (!params.id) return reject(new Error('ID de usuario requerido'));

    db.get(
      `
      SELECT
        id,
        nombre,
        COALESCE(apellido, apellidos, '') AS apellido,
        email,
        telefono,
        fecha_nacimiento AS nacimiento,
        direccion,
        rol,
        fecha_creacion,
        foto_perfil
      FROM usuarios
      WHERE id = ?
      `,
      [params.id],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Usuario no encontrado'));

        resolve(row);
      }
    );
  });
});

// -------------------------------------------------------------
// UPDATE USER PROFILE
// -------------------------------------------------------------
ipcMain.handle('update-user-profile', async (event, userData) => {
  return new Promise((resolve, reject) => {
    if (!userData.id) return reject(new Error('ID de usuario requerido'));

    const {
      id,
      nombre,
      apellido,
      email,
      telefono,
      nacimiento,
      direccion,
      foto_perfil,
    } = userData;

    db.run(
      `
      UPDATE usuarios
      SET
        nombre = ?,
        apellido = ?,
        apellidos = ?, 
        email = ?,
        telefono = ?,
        fecha_nacimiento = ?,
        direccion = ?,
        foto_perfil = ?
      WHERE id = ?
      `,
      [
        nombre || '',
        apellido || '',
        apellido || '',
        email || '',
        telefono || '',
        nacimiento || null,
        direccion || '',
        foto_perfil || null,
        id,
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ ok: true, message: 'Perfil actualizado correctamente' });
      }
    );
  });
});

// -------------------------------------------------------------
// OPEN VIEW (NAVIGATION)
// -------------------------------------------------------------
ipcMain.handle('open-view', async (event, viewName) => {
  if (!mainWindow) throw new Error('Main window no disponible');

  const views = {
    pacientes: path.join(__dirname, 'renderer', 'views', 'pacientes.html'),
    login: path.join(__dirname, 'renderer', 'views', 'login.html'),
    register: path.join(__dirname, 'renderer', 'views', 'register.html'),
    index: path.join(__dirname, 'renderer', 'views', 'index.html'),
    perfil: path.join(__dirname, 'renderer', 'views', 'perfil.html'),
    crm: path.join(__dirname, 'renderer', 'views', 'crm.html')
  };

  const target = views[viewName];
  if (!target) throw new Error('Vista no permitida: ' + String(viewName));

  await mainWindow.loadFile(target);
  return { ok: true, view: viewName };
});

// -------------------------------------------------------------
// GENERIC DB HANDLERS
// -------------------------------------------------------------
ipcMain.handle('db-all', async (event, sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
});

ipcMain.handle('db-get', async (event, sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params || [], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
});

ipcMain.handle('db-run', async (event, sql, params) => {
  return new Promise((resolve, reject) => {
    console.log('[IPC db-run] SQL:', sql, 'params:', params);

    db.run(sql, params || [], function (err) {
      if (err) {
        console.error('[IPC db-run] Error:', err.message);
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
});

// -------------------------------------------------------------
// GET PATIENTS (used by CRM)
// -------------------------------------------------------------
ipcMain.handle('get-patients', async (event, params = {}) => {
  return new Promise((resolve, reject) => {
    let query =
      `SELECT id, nombre, email FROM pacientes WHERE email IS NOT NULL AND email != ''`;

    if (params.group === 'active') query += ` AND id > 0`;
    if (params.group === 'inactive') query += ` AND id > 0`;

    query += ` LIMIT 500`;

    db.all(query, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
});

// -------------------------------------------------------------
// APP LIFECYCLE
// -------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Log desde renderer
ipcMain.on('renderer-log', (event, msg) => {
  console.log('[renderer]', msg);
});

// -------------------------------------------------------------
// GMAIL API HANDLERS (OAuth2)
// -------------------------------------------------------------
const {
  generateAuthUrl,
  saveToken,
  sendEmail,
} = require('./main/google/gmail-service');

ipcMain.handle('gmail-get-auth-url', async () => {
  try {
    const url = await generateAuthUrl();
    return { success: true, url };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gmail-save-token', async (event, code) => {
  try {
    await saveToken(code);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('gmail-send', async (event, { to, subject, html, attachments }) => {
  try {
    await sendEmail({ to, subject, html, attachments });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("open-external", async (event, url) => {
  const { shell } = require("electron");
  await shell.openExternal(url);
  return true;
});

