require('dotenv').config({ quiet: true });

const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const db = require('./db/database');
const bcrypt = require('bcryptjs');
const financeService = require('./main/finance-service');
const odontogramService = require('./main/odontogram-service');
const cashService = require('./main/cash-service');
const crmService = require('./main/crm-service');
const cajasReportService = require('./main/cajas-report-service');
const patientService = require('./main/patient-service');
const appointmentService = require('./main/appointment-service');
const specialistService = require('./main/specialist-service');
const catalogService = require('./main/catalog-service');
const clinicalService = require('./main/clinical-service');
const { assertSafeSql } = require('./main/sql-guard');
const backupService = require('./main/backup-service');
const { registerAccountingHandlers } = require('./main/accounting-service');

const {
  DEFAULT_MIN_WIDTH,
  DEFAULT_MIN_HEIGHT,
  resolveInitialWindowState,
  serializeWindowState,
} = require('./main/window-state');
const {
  GOOGLE_AUTH_MODES,
  hasGoogleLinkedAccount,
  hasLocalPassword,
  normalizeEmail,
  normalizeRole,
  isValidEmail,
  isProfileComplete,
  isAuthorizedUser,
  mapUserRow,
  resolveGoogleAuthDecision,
} = require('./main/auth-policy');

// -------------------------------------------------------------
// SETUP APP ID (Required for Windows Notifications & Taskbar Icon)
// -------------------------------------------------------------
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nerick.sonalia.app');
}

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
const rendererRoot = path.normalize(path.join(__dirname, 'renderer'));
const MAIN_WINDOW_STATE_FILE = 'main-window-state.json';

function getSecureWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  };
}

function isSafeAppUrl(targetUrl) {
  try {
    if (!targetUrl) return false;
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'file:') return false;
    const targetPath = path.normalize(fileURLToPath(parsed));
    return targetPath.startsWith(`${rendererRoot}${path.sep}`);
  } catch (error) {
    return false;
  }
}

function assertTrustedRenderer(event) {
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  if (!isSafeAppUrl(senderUrl)) {
    throw new Error('Renderer no autorizado');
  }
}

function parseGoogleAuthRequest(request) {
  const payload =
    request && typeof request === 'object' && !Array.isArray(request)
      ? request
      : { mode: request };

  const mode =
    payload.mode === GOOGLE_AUTH_MODES.REGISTER ? GOOGLE_AUTH_MODES.REGISTER : GOOGLE_AUTH_MODES.LOGIN;
  const normalizedHint = normalizeEmail(payload.loginHint);

  return {
    mode,
    loginHint: isValidEmail(normalizedHint) ? normalizedHint : '',
  };
}

function getMainWindowStatePath() {
  return path.join(app.getPath('userData'), MAIN_WINDOW_STATE_FILE);
}

function loadMainWindowState() {
  try {
    const statePath = getMainWindowStatePath();
    if (!fs.existsSync(statePath)) return null;
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (error) {
    console.warn('No se pudo cargar el estado de la ventana principal', error && error.message);
    return null;
  }
}

function saveMainWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    const serialized = serializeWindowState({
      bounds,
      isMaximized: win.isMaximized(),
    });
    fs.mkdirSync(path.dirname(getMainWindowStatePath()), { recursive: true });
    fs.writeFileSync(getMainWindowStatePath(), JSON.stringify(serialized, null, 2));
  } catch (error) {
    console.warn('No se pudo guardar el estado de la ventana principal', error && error.message);
  }
}

const createWindow = () => {
  const iconPath = path.join(__dirname, 'renderer', 'assets', 'icons', 'app.ico');
  const display = screen.getPrimaryDisplay();
  const windowState = resolveInitialWindowState({
    savedState: loadMainWindowState(),
    workArea: display?.workArea || display?.bounds || {},
  });
  const win = new BrowserWindow({
    x: windowState.bounds.x,
    y: windowState.bounds.y,
    width: windowState.bounds.width,
    height: windowState.bounds.height,
    minWidth: DEFAULT_MIN_WIDTH,
    minHeight: DEFAULT_MIN_HEIGHT,
    show: false,
    backgroundColor: '#F8F7F7',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : null, // Fallback check
    webPreferences: getSecureWebPreferences(),
  });

  if (windowState.maximize) {
    win.maximize();
  }

  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (isSafeAppUrl(targetUrl)) return;
    event.preventDefault();
    if (/^https?:/i.test(targetUrl)) {
      shell.openExternal(targetUrl).catch(() => { });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeAppUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          icon: fs.existsSync(iconPath) ? iconPath : null,
          webPreferences: getSecureWebPreferences(),
        },
      };
    }

    if (/^https?:/i.test(url)) {
      shell.openExternal(url).catch(() => { });
    }
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => {
    if (windowState.maximize && !win.isMaximized()) {
      win.maximize();
    }
    win.show();
  });

  win.on('close', () => {
    saveMainWindowState(win);
  });

  mainWindow = win;
  win.loadFile(path.join(__dirname, 'renderer', 'views', 'login.html'));
};

// -------------------------------------------------------------
// PASSWORD POLICY HELPER (S11)
// Returns null if password is strong enough, or an error string.
// Rules: â‰¥8 chars, uppercase, lowercase, digit, special char.
// -------------------------------------------------------------
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return 'La contraseña es requerida';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'Debe contener al menos una letra mayúscula';
  if (!/[a-z]/.test(password)) return 'Debe contener al menos una letra minúscula';
  if (!/[0-9]/.test(password)) return 'Debe contener al menos un número';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Debe contener al menos un carácter especial (!@#$%...)';
  return null;
}

function dbGetAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbRunAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

const { authenticateWithGoogle, logoutOAuthUser } = require('./main/google/google-oauth-service');

let authSession = null;
let pendingOAuthRegistration = null;

function setAuthSession(user) {
  const mappedUser = mapUserRow(user);
  authSession = {
    user: mappedUser,
    authorized: isAuthorizedUser(mappedUser),
    createdAt: new Date().toISOString(),
  };
  return authSession;
}

function clearAuthSession() {
  authSession = null;
}

function clearPendingOAuthRegistration() {
  pendingOAuthRegistration = null;
}

function setPendingOAuthRegistration(payload = {}) {
  pendingOAuthRegistration = {
    ...payload,
    email: normalizeEmail(payload.email),
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return pendingOAuthRegistration;
}

function getPendingOAuthRegistration() {
  if (!pendingOAuthRegistration) return null;
  if (pendingOAuthRegistration.expiresAt && pendingOAuthRegistration.expiresAt < Date.now()) {
    pendingOAuthRegistration = null;
    return null;
  }
  return pendingOAuthRegistration;
}

function getAuthStateSnapshot() {
  if (!authSession?.user?.id) {
    return { authenticated: false, authorized: false, user: null };
  }

  return {
    authenticated: true,
    authorized: !!authSession.authorized,
    user: authSession.user,
  };
}

function assertAuthorizedAppSession(event) {
  assertTrustedRenderer(event);
  if (!authSession?.user?.id) {
    throw new Error('Debes iniciar sesiÃƒÂ³n para continuar');
  }
  if (!authSession.authorized) {
    throw new Error('Debes completar tu registro antes de entrar a la aplicaciÃƒÂ³n');
  }
  return authSession;
}

function buildPendingOAuthPayload({ googleProfile, existingUser = null, sourceMode }) {
  const mappedExistingUser = mapUserRow(existingUser);

  return {
    sourceMode: sourceMode === GOOGLE_AUTH_MODES.REGISTER ? GOOGLE_AUTH_MODES.REGISTER : GOOGLE_AUTH_MODES.LOGIN,
    userId: mappedExistingUser?.id || null,
    email: googleProfile.email,
    googleId: googleProfile.googleId,
    nombre: mappedExistingUser?.nombre || googleProfile.nombre || '',
    apellido: mappedExistingUser?.apellido || googleProfile.apellido || '',
    fotoPerfil: googleProfile.fotoPerfil || mappedExistingUser?.fotoPerfil || null,
    emailVerified: !!googleProfile.emailVerified,
    role: mappedExistingUser?.rol || '',
    acceptedTerms: mappedExistingUser?.acceptedTerms || false,
  };
}

async function updateLastLoginAt(userId) {
  if (!userId) return;
  await dbRunAsync('UPDATE usuarios SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

// -------------------------------------------------------------
// USER REGISTRATION
// -------------------------------------------------------------
ipcMain.handle('register-user', async (event, userData) => {
  // âš ï¸ SECURITY S11: Validate password strength server-side before hashing
  const pwError = validatePasswordStrength(userData.password);
  if (pwError) throw new Error(pwError);

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
      `SELECT
          id,
          nombre,
          COALESCE(apellido, apellidos, '') AS apellido,
          rol,
          password,
          auth_provider,
          email
        FROM usuarios
        WHERE email = ? OR nombre = ?`,
      [lookup, lookup],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Usuario no encontrado'));

        // OAuth users must authenticate through Google Sign-In.
        if (row.auth_provider === 'google') {
          return reject(new Error('Esta cuenta solo puede iniciar sesion con Google.'));
        }

        // For local users, verify password
        const match = bcrypt.compareSync(userData.password, row.password);
        if (match) resolve({ id: row.id, nombre: row.nombre, apellido: row.apellido, rol: row.rol, email: row.email });
        else reject(new Error('Contraseña incorrecta'));
      }
    );
  });
});


// -------------------------------------------------------------
// GOOGLE OAUTH
// -------------------------------------------------------------

ipcMain.handle('google-oauth-authenticate', async () => {
  try {
    const userInfo = await authenticateWithGoogle();

    // Check if user exists
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM usuarios WHERE email = ? OR google_id = ?',
        [userInfo.email, userInfo.googleId],
        (err, existingUser) => {
          if (err) return reject(err);

          if (existingUser) {
            // Update Google ID if not set
            if (!existingUser.google_id) {
              db.run(
                'UPDATE usuarios SET google_id = ?, auth_provider = ?, email_verified = ? WHERE id = ?',
                [userInfo.googleId, 'google', userInfo.emailVerified ? 1 : 0, existingUser.id],
                (err) => {
                  if (err) console.error('Error updating user with Google ID:', err);
                }
              );
            }

            return resolve({
              success: true,
              isNewUser: false,
              user: { id: existingUser.id, nombre: existingUser.nombre, apellido: (existingUser.apellido || existingUser.apellidos || ''), rol: existingUser.rol, email: existingUser.email }
            });
          }

          // New user - needs to select role
          return resolve({
            success: true,
            isNewUser: true,
            needsRole: true,
            userInfo: userInfo // Return user info to use after role selection
          });
        }
      );
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Logout from Google OAuth
ipcMain.handle('google-oauth-logout', async () => {
  try {
    const success = logoutOAuthUser();
    return { success, message: success ? 'Sesión cerrada correctamente' : 'Error al cerrar sesión' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Complete OAuth registration with selected role
ipcMain.handle('complete-oauth-registration', async (event, { userInfo, role }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO usuarios (nombre, apellido, email, password, rol, google_id, auth_provider, email_verified, foto_perfil) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userInfo.nombre,
        userInfo.apellido,
        userInfo.email,
        '',
        role,
        userInfo.googleId,
        nextAuthProvider,
        userInfo.emailVerified ? 1 : 0,
        userInfo.fotoPerfil
      ],
      function (err) {
        if (err) return reject(err);
        resolve({
          success: true,
          user: { id: this.lastID, nombre: userInfo.nombre, apellido: userInfo.apellido || '', rol: role, email: userInfo.email }
        });
      }
    );
  });
});

ipcMain.removeHandler('register-user');
ipcMain.handle('register-user', async (event, userData = {}) => {
  assertTrustedRenderer(event);

  const nombre = String(userData.nombre || '').trim();
  const apellido = String(userData.apellido || '').trim();
  const telefono = String(userData.telefono || '').trim();
  const email = normalizeEmail(userData.email);
  const role = normalizeRole(userData.rol);
  const acceptedTerms = !!userData.acceptedTerms;

  if (!nombre) throw new Error('El nombre es requerido');
  if (!apellido) throw new Error('El apellido es requerido');
  if (!isValidEmail(email)) throw new Error('Debes ingresar un correo electrÃƒÂ³nico vÃƒ¡lido');
  if (!role) throw new Error('Debes seleccionar un rol vÃƒ¡lido');
  if (!acceptedTerms) throw new Error('Debes aceptar los tÃƒ©rminos y condiciones');

  const pwError = validatePasswordStrength(userData.password);
  if (pwError) throw new Error(pwError);

  const existingUser = await dbGetAsync('SELECT id FROM usuarios WHERE lower(email) = ? LIMIT 1', [email]);
  if (existingUser) {
    throw new Error('Ya existe una cuenta registrada con ese correo');
  }

  const hashedPassword = bcrypt.hashSync(userData.password, 10);
  const profileCompleted = isProfileComplete({ nombre, apellido }) ? 1 : 0;

  const result = await dbRunAsync(
    `INSERT INTO usuarios (
      nombre,
      apellido,
      email,
      telefono,
      password,
      rol,
      auth_provider,
      email_verified,
      accepted_terms,
      registration_completed,
      profile_completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nombre, apellido, email, telefono, hashedPassword, role, 'local', 0, 1, 1, profileCompleted]
  );

  return { id: result.lastID };
});

ipcMain.removeHandler('login-user');
ipcMain.handle('login-user', async (event, userData = {}) => {
  assertTrustedRenderer(event);

  const email = normalizeEmail(userData.email);
  const password = String(userData.password || '');

  if (!isValidEmail(email)) throw new Error('Debes ingresar un correo electrÃƒÂ³nico vÃƒ¡lido');
  if (!password) throw new Error('La contraseÃƒÂ±a es requerida');

  const row = await dbGetAsync(
    `SELECT
      id,
      nombre,
      COALESCE(apellido, apellidos, '') AS apellido,
      rol,
      password,
      auth_provider,
      email,
      google_id,
      email_verified,
      accepted_terms,
      registration_completed,
      profile_completed,
      foto_perfil,
      last_login_at
    FROM usuarios
    WHERE lower(email) = ?
    LIMIT 1`,
    [email]
  );

  if (!row) throw new Error('Usuario no encontrado');

  if (!hasLocalPassword(row)) {
    if (hasGoogleLinkedAccount(row)) {
      throw new Error('Esta cuenta aun no tiene contrasena local. Entra con Google o crea una desde "Olvide mi contrasena".');
    }
    throw new Error('Esta cuenta no tiene una contrasena configurada.');
  }

  /* Legacy google-only guard disabled:
    throw new Error('Esta cuenta solo puede iniciar sesiÃƒÂ³n con Google.');
  }

  */

  const match = bcrypt.compareSync(password, row.password);
  if (!match) throw new Error('ContraseÃƒÂ±a incorrecta');

  const user = mapUserRow(row);
  if (!isAuthorizedUser(user)) {
    throw new Error('Tu cuenta no ha completado el registro obligatorio.');
  }

  await updateLastLoginAt(user.id);
  const finalUser = { ...user, lastLoginAt: new Date().toISOString() };
  setAuthSession(finalUser);
  clearPendingOAuthRegistration();

  return finalUser;
});

ipcMain.removeHandler('google-oauth-authenticate');
ipcMain.handle('google-oauth-authenticate', async (event, request = GOOGLE_AUTH_MODES.LOGIN) => {
  assertTrustedRenderer(event);

  const { mode: authMode, loginHint } = parseGoogleAuthRequest(request);

  try {
    const userInfo = await authenticateWithGoogle({ loginHint });
    const googleProfile = {
      ...userInfo,
      email: normalizeEmail(userInfo.email),
    };

    const userByGoogleId = await dbGetAsync(
      'SELECT * FROM usuarios WHERE google_id = ? LIMIT 1',
      [googleProfile.googleId]
    );
    const userByEmail = await dbGetAsync(
      'SELECT * FROM usuarios WHERE lower(email) = ? LIMIT 1',
      [googleProfile.email]
    );

    const decision = resolveGoogleAuthDecision({
      mode: authMode,
      googleProfile,
      userByGoogleId,
      userByEmail,
    });

    if (decision.kind === 'error') {
      clearAuthSession();
      clearPendingOAuthRegistration();
      return { success: false, code: decision.code, error: decision.message };
    }

    if (decision.kind === 'attach-google-id-and-login' || decision.kind === 'attach-google-id-and-complete') {
      await dbRunAsync(
        'UPDATE usuarios SET google_id = ?, email_verified = ? WHERE id = ?',
        [googleProfile.googleId, googleProfile.emailVerified ? 1 : 0, decision.user.id]
      );
      decision.user.google_id = googleProfile.googleId;
      decision.user.email_verified = googleProfile.emailVerified ? 1 : 0;
    }

    if (decision.kind === 'login-existing-google' || decision.kind === 'attach-google-id-and-login') {
      const user = mapUserRow(decision.user);
      await updateLastLoginAt(user.id);
      setAuthSession({ ...user, lastLoginAt: new Date().toISOString() });
      clearPendingOAuthRegistration();

      return {
        success: true,
        isNewUser: false,
        needsRegistrationCompletion: false,
        user,
      };
    }

    if (decision.kind === 'complete-existing-google' || decision.kind === 'attach-google-id-and-complete') {
      clearAuthSession();
      setPendingOAuthRegistration(
        buildPendingOAuthPayload({
          googleProfile,
          existingUser: decision.user,
          sourceMode: authMode,
        })
      );

      return {
        success: true,
        isNewUser: false,
        needsRegistrationCompletion: true,
        nextView: 'register',
      };
    }

    clearAuthSession();
    setPendingOAuthRegistration(
      buildPendingOAuthPayload({
        googleProfile,
        sourceMode: authMode,
      })
    );

    return {
      success: true,
      isNewUser: true,
      needsRegistrationCompletion: true,
      nextView: authMode === GOOGLE_AUTH_MODES.LOGIN ? 'register' : null,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.removeHandler('get-pending-oauth-registration');
ipcMain.handle('get-pending-oauth-registration', async (event) => {
  assertTrustedRenderer(event);
  const pending = getPendingOAuthRegistration();
  if (!pending) {
    return { pending: false };
  }

  return {
    pending: true,
    profile: {
      nombre: pending.nombre || '',
      apellido: pending.apellido || '',
      email: pending.email || '',
      fotoPerfil: pending.fotoPerfil || null,
      role: pending.role || '',
      acceptedTerms: !!pending.acceptedTerms,
      sourceMode: pending.sourceMode || GOOGLE_AUTH_MODES.REGISTER,
    },
  };
});

ipcMain.removeHandler('clear-pending-oauth-registration');
ipcMain.handle('clear-pending-oauth-registration', async (event) => {
  assertTrustedRenderer(event);
  clearPendingOAuthRegistration();
  return { success: true };
});

ipcMain.removeHandler('get-auth-state');
ipcMain.handle('get-auth-state', async (event) => {
  assertTrustedRenderer(event);
  return getAuthStateSnapshot();
});

ipcMain.removeHandler('logout-user');
ipcMain.handle('logout-user', async (event) => {
  assertTrustedRenderer(event);
  clearAuthSession();
  clearPendingOAuthRegistration();
  logoutOAuthUser();
  return { success: true };
});

// -------------------------------------------------------------
// SESSION LOCK SCREEN: verify password only (no auth-status checks)
// Used by session-timeout.js when the screen is locked.
// -------------------------------------------------------------
ipcMain.removeHandler('verify-session-password');
ipcMain.handle('verify-session-password', async (event, { email, password } = {}) => {
  assertTrustedRenderer(event);

  if (!email || !password) throw new Error('Datos incompletos');

  const row = await dbGetAsync(
    'SELECT password, auth_provider FROM usuarios WHERE lower(email) = lower(?) LIMIT 1',
    [String(email).trim()]
  );

  if (!row) throw new Error('Usuario no encontrado');
  if (row.auth_provider === 'google') throw new Error('Esta cuenta usa Google Sign-In');
  if (!row.password) throw new Error('Esta cuenta no tiene contrase\u00f1a local');

  const match = bcrypt.compareSync(String(password), row.password);
  if (!match) throw new Error('Contrase\u00f1a incorrecta');

  return { success: true };
});

ipcMain.removeHandler('google-oauth-logout');
ipcMain.handle('google-oauth-logout', async (event) => {
  assertTrustedRenderer(event);
  try {
    const success = logoutOAuthUser();
    clearAuthSession();
    clearPendingOAuthRegistration();
    return { success, message: success ? 'SesiÃƒÂ³n cerrada correctamente' : 'Error al cerrar sesiÃƒÂ³n' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.removeHandler('complete-oauth-registration');
ipcMain.handle('complete-oauth-registration', async (event, payload = {}) => {
  assertTrustedRenderer(event);

  const pending = getPendingOAuthRegistration();
  if (!pending) {
    return { success: false, error: 'No hay un registro de Google pendiente' };
  }

  const nombre = String(payload.nombre || pending.nombre || '').trim();
  const apellido = String(payload.apellido || pending.apellido || '').trim();
  const role = normalizeRole(payload.role || pending.role);
  const acceptedTerms = !!payload.acceptedTerms;
  const email = normalizeEmail(pending.email);
  const googleId = String(pending.googleId || '').trim();

  if (!nombre) return { success: false, error: 'El nombre es requerido' };
  if (!apellido) return { success: false, error: 'El apellido es requerido' };
  if (!isValidEmail(email)) return { success: false, error: 'El correo de Google no es vÃƒ¡lido' };
  if (!googleId) return { success: false, error: 'No se pudo validar la identidad de Google' };
  if (!role) return { success: false, error: 'Debes seleccionar un rol vÃƒ¡lido' };
  if (!acceptedTerms) return { success: false, error: 'Debes aceptar los tÃƒ©rminos y condiciones' };

  const existingByGoogleId = await dbGetAsync(
    'SELECT * FROM usuarios WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  const existingByEmail = await dbGetAsync(
    'SELECT * FROM usuarios WHERE lower(email) = ? LIMIT 1',
    [email]
  );

  if (existingByGoogleId && pending.userId && Number(existingByGoogleId.id) !== Number(pending.userId)) {
    return { success: false, error: 'Ese Google ID ya estÃƒ¡ vinculado a otra cuenta' };
  }

  if (existingByEmail && pending.userId && Number(existingByEmail.id) !== Number(pending.userId)) {
    return { success: false, error: 'Ese correo ya estÃƒ¡ asociado a otra cuenta distinta' };
  }

  const existingAccount = existingByGoogleId || existingByEmail || null;

  /* Legacy local-email collision guard disabled:
    existingByEmail &&
    !pending.userId &&
    false
  ) {
    return {
      success: false,
      error:
        'Ya existe una cuenta local con ese correo. Inicia sesiÃƒÂ³n con tu contraseÃƒÂ±a y vincula Google desde una sesiÃƒÂ³n autenticada.',
    };
  */

  let userId = pending.userId || existingByEmail?.id || existingByGoogleId?.id || null;
  const nextAuthProvider = hasLocalPassword(existingAccount) ? 'hybrid' : 'google';

  if (userId) {
    await dbRunAsync(
      `UPDATE usuarios
       SET nombre = ?,
           apellido = ?,
           email = ?,
           rol = ?,
           google_id = ?,
           auth_provider = ?,
           email_verified = ?,
           accepted_terms = ?,
           registration_completed = ?,
           profile_completed = ?,
           foto_perfil = ?
       WHERE id = ?`,
      [
        nombre,
        apellido,
        email,
        role,
        googleId,
        nextAuthProvider,
        pending.emailVerified ? 1 : 0,
        1,
        1,
        isProfileComplete({ nombre, apellido }) ? 1 : 0,
        pending.fotoPerfil || null,
        userId,
      ]
    );
  } else {
    const result = await dbRunAsync(
      `INSERT INTO usuarios (
        nombre,
        apellido,
        email,
        password,
        rol,
        google_id,
        auth_provider,
        email_verified,
        accepted_terms,
        registration_completed,
        profile_completed,
        foto_perfil
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        apellido,
        email,
        '',
        role,
        googleId,
        nextAuthProvider,
        pending.emailVerified ? 1 : 0,
        1,
        1,
        isProfileComplete({ nombre, apellido }) ? 1 : 0,
        pending.fotoPerfil || null,
      ]
    );
    userId = result.lastID;
  }

  await updateLastLoginAt(userId);

  const row = await dbGetAsync(
    `SELECT
      id,
      nombre,
      COALESCE(apellido, apellidos, '') AS apellido,
      email,
      rol,
      google_id,
      auth_provider,
      CASE WHEN COALESCE(password, '') <> '' THEN 1 ELSE 0 END AS has_password,
      email_verified,
      accepted_terms,
      registration_completed,
      profile_completed,
      foto_perfil,
      last_login_at
    FROM usuarios
    WHERE id = ?`,
    [userId]
  );

  const user = mapUserRow(row);
  setAuthSession({ ...user, lastLoginAt: new Date().toISOString() });
  clearPendingOAuthRegistration();

  return { success: true, user };
});

// -------------------------------------------------------------
// PASSWORD RECOVERY
// -------------------------------------------------------------
const {
  requestPasswordReset,
  validateResetToken,
  resetPassword
} = require('./main/password-recovery-service');

ipcMain.handle('request-password-reset', async (event, email) => {
  try {
    const result = await requestPasswordReset(email);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('validate-reset-token', async (event, token) => {
  try {
    const result = await validateResetToken(token);
    return result;
  } catch (e) {
    return { valid: false, error: e.message };
  }
});

ipcMain.handle('reset-password', async (event, { token, newPassword }) => {
  try {
    const result = await resetPassword(token, newPassword);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
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
      rol,
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
        email = ?,
        rol = ?,
        telefono = ?,
        fecha_nacimiento = ?,
        direccion = ?,
        foto_perfil = ?
      WHERE id = ?
      `,
      [
        nombre || '',
        apellido || '',
        email || '',
        rol || '',
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
    index: path.join(__dirname, 'renderer', 'views', 'login.html'),
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
  assertTrustedRenderer(event);
  const query = assertSafeSql('db-all', sql, params);
  return new Promise((resolve, reject) => {
    db.all(query.sql, query.params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
});

ipcMain.handle('db-get', async (event, sql, params) => {
  assertTrustedRenderer(event);
  const query = assertSafeSql('db-get', sql, params);
  return new Promise((resolve, reject) => {
    db.get(query.sql, query.params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
});

ipcMain.handle('db-run', async (event, sql, params) => {
  assertTrustedRenderer(event);
  const query = assertSafeSql('db-run', sql, params);
  return new Promise((resolve, reject) => {
    db.run(query.sql, query.params, function (err) {
      if (err) {
        console.error('[IPC db-run] Error:', err.message);
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
});

// -------------------------------------------------------------
// FINANCE HANDLERS
// -------------------------------------------------------------
ipcMain.handle('finance-save-treatment-plan', async (event, payload) => {
  assertTrustedRenderer(event);
  return financeService.saveTreatmentPlan(db, payload || {});
});

ipcMain.handle('finance-get-treatment-plan-detail', async (event, planId) => {
  assertTrustedRenderer(event);
  return financeService.getTreatmentPlanDetail(db, planId);
});

ipcMain.handle('finance-get-patient-summary', async (event, patientId) => {
  assertTrustedRenderer(event);
  return financeService.getPatientFinancialSummary(db, patientId);
});

ipcMain.handle('finance-update-treatment-plan-progress', async (event, payload) => {
  assertTrustedRenderer(event);
  return financeService.updateTreatmentPlanProgress(db, payload || {});
});

ipcMain.handle('finance-set-treatment-plan-status', async (event, payload) => {
  assertTrustedRenderer(event);
  return financeService.setTreatmentPlanStatus(db, payload || {});
});

ipcMain.handle('finance-register-payment', async (event, payload) => {
  assertTrustedRenderer(event);
  return financeService.registerPayment(db, payload || {});
});

ipcMain.handle('finance-register-refund', async (event, payload) => {
  assertTrustedRenderer(event);
  return financeService.registerRefund(db, payload || {});
});

ipcMain.handle('finance-generate-simulated-invoice', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return financeService.generateSimulatedInvoice(db, payload);
});

ipcMain.handle('finance-get-simulated-invoices', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return financeService.getSimulatedInvoices(db, payload);
});

ipcMain.handle('finance-get-overdue-accounts', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return financeService.getOverdueAccounts(db, payload || {});
});

ipcMain.handle('finance-get-report', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return financeService.getFinanceReport(db, payload || {});
});

ipcMain.handle('finance-send-collection-reminder', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return financeService.sendCollectionReminder(db, payload);
});

// -------------------------------------------------------------
// CAJAS REPORT HANDLERS
// -------------------------------------------------------------
ipcMain.handle('cajas-get-movimientos-avanzado', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return cajasReportService.getMovimientosAvanzado(db, payload || {});
});

ipcMain.handle('cajas-get-resumen-contable', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return cajasReportService.getResumenContable(db, payload || {});
});

ipcMain.handle('cajas-get-saldos-metodo', async (event, payload = {}) => {
  assertTrustedRenderer(event);
  return cajasReportService.getSaldosPorMetodo(db, payload || {});
});

// -------------------------------------------------------------
// CLINIC IDENTITY HANDLERS
// -------------------------------------------------------------
const clinicConfigService = require('./main/clinic-config-service');

ipcMain.removeHandler('clinic-get-config');
ipcMain.handle('clinic-get-config', async (event) => {
  assertAuthorizedAppSession(event);
  return clinicConfigService.getClinicConfig(db);
});

ipcMain.removeHandler('clinic-save-config');
ipcMain.handle('clinic-save-config', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return clinicConfigService.saveClinicConfig(db, payload);
});

ipcMain.removeHandler('clinic-get-settings');
ipcMain.handle('clinic-get-settings', async (event) => {
  assertAuthorizedAppSession(event);
  return clinicConfigService.getAppSettings(db);
});

ipcMain.removeHandler('clinic-save-settings');
ipcMain.handle('clinic-save-settings', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return clinicConfigService.saveAppSettings(db, payload);
});

ipcMain.removeHandler('clinic-get-system-config');
ipcMain.handle('clinic-get-system-config', async (event) => {
  assertAuthorizedAppSession(event);
  return clinicConfigService.getSystemConfig(db);
});

ipcMain.removeHandler('clinic-save-system-config');
ipcMain.handle('clinic-save-system-config', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return clinicConfigService.saveSystemConfig(db, payload);
});

// -------------------------------------------------------------
// APP LIFECYCLE
// -------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  crmService.seedDefaultTemplates(db).catch(err => console.error('[CRM] Fallo al sembrar plantillas:', err));

  // âš ï¸ SECURITY S10: Start auto-backup (daily, keeps last 30 copies)
  backupService.startAutoBackup();
  console.log('[MAIL] Remitente oficial configurado: softwaresonalia@gmail.com');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    backupService.stopAutoBackup();
    app.quit();
  }
});

// Log desde renderer
ipcMain.on('renderer-log', (event, msg) => {
  console.log('[renderer]', msg);
});

// -------------------------------------------------------------
// BACKUP HANDLERS (S10)
// -------------------------------------------------------------
ipcMain.handle('backup-run-manual', async (event) => {
  assertTrustedRenderer(event);
  return backupService.runManualBackup();
});

ipcMain.handle('backup-list', async (event) => {
  assertTrustedRenderer(event);
  return backupService.listBackups();
});

// -------------------------------------------------------------
// MAIL DELIVERY HANDLERS
// -------------------------------------------------------------
const {
  getDeliveryStatus,
  sendEmail,
} = require('./main/google/gmail-service');

ipcMain.handle('gmail-has-token', async () => {
  try {
    return { success: true, ...(await getDeliveryStatus()) };
  } catch (e) {
    return { success: false, connected: false, error: e.message };
  }
});

function replaceTemplateVars(text, data) {
  const safeText = String(text || '');
  const map = {
    '{nombre}': data?.nombre || '',
    '{apellido}': data?.apellido || '',
    '{telefono}': data?.telefono || '',
    '{email}': data?.email || '',
    '{fecha_cita}': data?.fecha_cita || '',
    '{doctor}': data?.doctor || '',
  };
  return Object.keys(map).reduce((acc, key) => acc.split(key).join(map[key]), safeText);
}

function toHtmlBody(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const withBreaks = escaped.replace(/\r?\n/g, '<br>');
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${withBreaks}</div>`;
}

ipcMain.handle('send-bulk-email', async (event, payload = {}) => {
  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const subject = payload.subject || '';
  const body = payload.body || '';
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const throttleMs = Number(payload.throttleMs || 0);
  const delayMs = Number.isFinite(throttleMs) ? Math.max(0, throttleMs) : 0;

  if (!recipients.length) {
    return { success: false, sent: 0, failed: 0, error: 'No recipients provided' };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += 1) {
    const recipient = recipients[i] || {};
    const personalizedSubject = replaceTemplateVars(subject, recipient);
    const personalizedBody = replaceTemplateVars(body, recipient);

    try {
      await sendEmail({
        to: recipient.email,
        subject: personalizedSubject,
        html: toHtmlBody(personalizedBody),
        attachments,
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      errors.push({ email: recipient.email || '', error: e.message || 'send failed' });
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('email-progress', {
        current: i + 1,
        total: recipients.length,
      });
    }

    if (delayMs && i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
    error: failed ? 'Some emails failed' : null,
  };
});

ipcMain.handle('gmail-send', async (event, { to, subject, html, attachments }) => {
  try {
    await sendEmail({ to, subject, html, attachments });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// -------------------------------------------------------------
// APPOINTMENT NOTIFICATIONS
// -------------------------------------------------------------
const { sendAppointmentNotification } = require('./main/appointment-notification');

ipcMain.handle('send-appointment-notification', async (event, appointmentData) => {
  try {
    const success = await sendAppointmentNotification(appointmentData);
    return { success };
  } catch (e) {
    console.error('[IPC] Error sending appointment notification:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.removeHandler('get-user-profile');
ipcMain.handle('get-user-profile', async (event, params = {}) => {
  const session = assertAuthorizedAppSession(event);
  const requestedId = Number(params.id || 0);

  if (!requestedId || requestedId !== Number(session.user.id)) {
    throw new Error('No autorizado para consultar otro perfil');
  }

  const row = await dbGetAsync(
    `SELECT
      id,
      nombre,
      COALESCE(apellido, apellidos, '') AS apellido,
      email,
      telefono,
      fecha_nacimiento AS nacimiento,
      direccion,
      rol,
      fecha_creacion,
      foto_perfil,
      auth_provider,
      last_login_at
    FROM usuarios
    WHERE id = ?`,
    [requestedId]
  );

  if (!row) throw new Error('Usuario no encontrado');
  return row;
});

ipcMain.removeHandler('update-user-profile');
ipcMain.handle('update-user-profile', async (event, userData = {}) => {
  const session = assertAuthorizedAppSession(event);
  const targetId = Number(userData.id || 0);

  if (!targetId || targetId !== Number(session.user.id)) {
    throw new Error('No autorizado para actualizar otro perfil');
  }

  const currentUser = await dbGetAsync(
    'SELECT id, email, auth_provider, google_id, rol FROM usuarios WHERE id = ? LIMIT 1',
    [targetId]
  );
  if (!currentUser) throw new Error('Usuario no encontrado');

  const nombre = String(userData.nombre || '').trim();
  const apellido = String(userData.apellido || '').trim();
  const email = normalizeEmail(userData.email);
  const rol = normalizeRole(userData.rol || currentUser.rol);
  const telefono = String(userData.telefono || '').trim();
  const nacimiento = userData.nacimiento || null;
  const direccion = String(userData.direccion || '').trim();
  const fotoPerfil = userData.foto_perfil || null;

  if (!nombre) throw new Error('El nombre es requerido');
  if (!apellido) throw new Error('El apellido es requerido');
  if (!isValidEmail(email)) throw new Error('Debes ingresar un correo electrÃƒÂ³nico vÃƒ¡lido');

  if (!rol) throw new Error('Debes seleccionar un rol válido');

  const hasGoogleLinked = hasGoogleLinkedAccount(currentUser);
  if (hasGoogleLinked && email !== normalizeEmail(currentUser.email)) {
    throw new Error('No puedes cambiar el correo principal de una cuenta Google desde el perfil');
  }

  const existingUser = await dbGetAsync(
    'SELECT id FROM usuarios WHERE lower(email) = ? AND id <> ? LIMIT 1',
    [email, targetId]
  );
  if (existingUser) {
    throw new Error('Ese correo ya estÃƒ¡ siendo usado por otra cuenta');
  }

  const profileCompleted = isProfileComplete({ nombre, apellido }) ? 1 : 0;
  await dbRunAsync(
    `UPDATE usuarios
     SET nombre = ?,
         apellido = ?,
         email = ?,
         rol = ?,
         telefono = ?,
         fecha_nacimiento = ?,
         direccion = ?,
         foto_perfil = ?,
         profile_completed = ?
     WHERE id = ?`,
    [nombre, apellido, email, rol, telefono, nacimiento, direccion, fotoPerfil, profileCompleted, targetId]
  );

  const refreshedUser = await dbGetAsync(
    `SELECT
      id,
      nombre,
      COALESCE(apellido, apellidos, '') AS apellido,
      email,
      rol,
      google_id,
      auth_provider,
      CASE WHEN COALESCE(password, '') <> '' THEN 1 ELSE 0 END AS has_password,
      email_verified,
      accepted_terms,
      registration_completed,
      profile_completed,
      foto_perfil,
      last_login_at
    FROM usuarios
    WHERE id = ?`,
    [targetId]
  );

  setAuthSession(mapUserRow(refreshedUser));
  return { ok: true, message: 'Perfil actualizado correctamente' };
});

ipcMain.removeHandler('open-view');
ipcMain.handle('open-view', async (event, viewName) => {
  assertTrustedRenderer(event);
  if (!mainWindow) throw new Error('Main window no disponible');

  const views = {
    pacientes: path.join(__dirname, 'renderer', 'views', 'pacientes.html'),
    login: path.join(__dirname, 'renderer', 'views', 'login.html'),
    register: path.join(__dirname, 'renderer', 'views', 'register.html'),
    index: path.join(__dirname, 'renderer', 'views', 'login.html'),
    perfil: path.join(__dirname, 'renderer', 'views', 'perfil.html'),
    crm: path.join(__dirname, 'renderer', 'views', 'crm.html')
  };
  const publicViews = new Set(['login', 'register']);

  const target = views[viewName];
  if (!target) throw new Error('Vista no permitida: ' + String(viewName));
  if (!publicViews.has(viewName)) {
    assertAuthorizedAppSession(event);
  }

  await mainWindow.loadFile(target);
  return { ok: true, view: viewName };
});

ipcMain.removeHandler('db-all');
ipcMain.handle('db-all', async (event, sql, params) => {
  assertAuthorizedAppSession(event);
  const query = assertSafeSql('db-all', sql, params);
  return new Promise((resolve, reject) => {
    db.all(query.sql, query.params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
});

ipcMain.removeHandler('db-get');
ipcMain.handle('db-get', async (event, sql, params) => {
  assertAuthorizedAppSession(event);
  const query = assertSafeSql('db-get', sql, params);
  return new Promise((resolve, reject) => {
    db.get(query.sql, query.params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
});

ipcMain.removeHandler('db-run');
ipcMain.handle('db-run', async (event, sql, params) => {
  assertAuthorizedAppSession(event);
  const query = assertSafeSql('db-run', sql, params);
  return new Promise((resolve, reject) => {
    db.run(query.sql, query.params, function (err) {
      if (err) {
        console.error('[IPC db-run] Error:', err.message);
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
});

ipcMain.removeHandler('patients-get-field-config');
ipcMain.handle('patients-get-field-config', async (event) => {
  assertAuthorizedAppSession(event);
  return patientService.getFieldConfig(db);
});

ipcMain.removeHandler('patients-save-field-config');
ipcMain.handle('patients-save-field-config', async (event, config) => {
  assertAuthorizedAppSession(event);
  return patientService.saveFieldConfig(db, config || {});
});

ipcMain.removeHandler('patients-list');
ipcMain.handle('patients-list', async (event) => {
  assertAuthorizedAppSession(event);
  return patientService.listPatients(db);
});

ipcMain.removeHandler('patients-list-basic');
ipcMain.handle('patients-list-basic', async (event) => {
  assertAuthorizedAppSession(event);
  return patientService.listBasicPatients(db);
});

ipcMain.removeHandler('patients-get-by-id');
ipcMain.handle('patients-get-by-id', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return patientService.getPatientById(db, patientId);
});

ipcMain.removeHandler('patients-save');
ipcMain.handle('patients-save', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return patientService.savePatient(db, payload || {});
});

ipcMain.removeHandler('patients-remove');
ipcMain.handle('patients-remove', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return patientService.removePatient(db, patientId);
});

ipcMain.removeHandler('appointments-list-professionals');
ipcMain.handle('appointments-list-professionals', async (event) => {
  assertAuthorizedAppSession(event);
  return appointmentService.listProfessionals(db);
});

ipcMain.removeHandler('appointments-list-specialists');
ipcMain.handle('appointments-list-specialists', async (event) => {
  assertAuthorizedAppSession(event);
  return appointmentService.listSpecialists(db);
});

ipcMain.removeHandler('appointments-list-patients');
ipcMain.handle('appointments-list-patients', async (event) => {
  assertAuthorizedAppSession(event);
  return appointmentService.listPatients(db);
});

ipcMain.removeHandler('appointments-list-daily');
ipcMain.handle('appointments-list-daily', async (event, dateValue) => {
  assertAuthorizedAppSession(event);
  return appointmentService.listDailyAppointments(db, dateValue);
});

ipcMain.removeHandler('appointments-list-range');
ipcMain.handle('appointments-list-range', async (event, filters) => {
  assertAuthorizedAppSession(event);
  return appointmentService.listAppointmentsInRange(db, filters || {});
});

ipcMain.removeHandler('appointments-create');
ipcMain.handle('appointments-create', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return appointmentService.createAppointment(db, payload || {});
});

ipcMain.removeHandler('appointments-update');
ipcMain.handle('appointments-update', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return appointmentService.updateAppointment(db, payload || {});
});

ipcMain.removeHandler('appointments-update-status');
ipcMain.handle('appointments-update-status', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return appointmentService.updateAppointmentStatus(db, payload || {});
});

ipcMain.removeHandler('appointments-move');
ipcMain.handle('appointments-move', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return appointmentService.moveAppointment(db, payload || {});
});

ipcMain.removeHandler('appointments-remove');
ipcMain.handle('appointments-remove', async (event, appointmentId) => {
  assertAuthorizedAppSession(event);
  return appointmentService.deleteAppointment(db, appointmentId);
});

ipcMain.removeHandler('appointments-get-notification-details');
ipcMain.handle('appointments-get-notification-details', async (event, appointmentId) => {
  assertAuthorizedAppSession(event);
  return appointmentService.getNotificationDetails(db, appointmentId);
});

ipcMain.removeHandler('appointments-list-upcoming');
ipcMain.handle('appointments-list-upcoming', async (event, filters) => {
  assertAuthorizedAppSession(event);
  return appointmentService.listUpcomingAppointments(db, filters || {});
});

ipcMain.removeHandler('specialists-list');
ipcMain.handle('specialists-list', async (event) => {
  assertAuthorizedAppSession(event);
  return specialistService.listSpecialists(db);
});

ipcMain.removeHandler('specialists-get-by-id');
ipcMain.handle('specialists-get-by-id', async (event, specialistId) => {
  assertAuthorizedAppSession(event);
  return specialistService.getSpecialistById(db, specialistId);
});

ipcMain.removeHandler('specialists-save');
ipcMain.handle('specialists-save', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return specialistService.saveSpecialist(db, payload || {});
});

ipcMain.removeHandler('specialists-remove');
ipcMain.handle('specialists-remove', async (event, specialistId) => {
  assertAuthorizedAppSession(event);
  return specialistService.deleteSpecialist(db, specialistId);
});

ipcMain.removeHandler('catalog-list-treatments');
ipcMain.handle('catalog-list-treatments', async (event, filters) => {
  assertAuthorizedAppSession(event);
  return catalogService.listTreatments(db, filters || {});
});

ipcMain.removeHandler('catalog-get-treatment-by-id');
ipcMain.handle('catalog-get-treatment-by-id', async (event, treatmentId) => {
  assertAuthorizedAppSession(event);
  return catalogService.getTreatmentById(db, treatmentId);
});

ipcMain.removeHandler('catalog-save-treatment');
ipcMain.handle('catalog-save-treatment', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return catalogService.saveTreatment(db, payload || {});
});

ipcMain.removeHandler('catalog-remove-treatment');
ipcMain.handle('catalog-remove-treatment', async (event, treatmentId) => {
  assertAuthorizedAppSession(event);
  return catalogService.deleteTreatment(db, treatmentId);
});

ipcMain.removeHandler('catalog-list-medicines');
ipcMain.handle('catalog-list-medicines', async (event) => {
  assertAuthorizedAppSession(event);
  return catalogService.listMedicines(db);
});

ipcMain.removeHandler('catalog-get-medicine-by-id');
ipcMain.handle('catalog-get-medicine-by-id', async (event, medicineId) => {
  assertAuthorizedAppSession(event);
  return catalogService.getMedicineById(db, medicineId);
});

ipcMain.removeHandler('catalog-save-medicine');
ipcMain.handle('catalog-save-medicine', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return catalogService.saveMedicine(db, payload || {});
});

ipcMain.removeHandler('catalog-remove-medicine');
ipcMain.handle('catalog-remove-medicine', async (event, medicineId) => {
  assertAuthorizedAppSession(event);
  return catalogService.deleteMedicine(db, medicineId);
});

ipcMain.removeHandler('catalog-list-supplies');
ipcMain.handle('catalog-list-supplies', async (event, filters) => {
  assertAuthorizedAppSession(event);
  return catalogService.listSupplies(db, filters || {});
});

ipcMain.removeHandler('catalog-get-supply-by-id');
ipcMain.handle('catalog-get-supply-by-id', async (event, supplyId) => {
  assertAuthorizedAppSession(event);
  return catalogService.getSupplyById(db, supplyId);
});

ipcMain.removeHandler('catalog-save-supply');
ipcMain.handle('catalog-save-supply', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return catalogService.saveSupply(db, payload || {});
});

ipcMain.removeHandler('catalog-remove-supply');
ipcMain.handle('catalog-remove-supply', async (event, supplyId) => {
  assertAuthorizedAppSession(event);
  return catalogService.deleteSupply(db, supplyId);
});

ipcMain.removeHandler('clinical-get-antecedentes');
ipcMain.handle('clinical-get-antecedentes', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return clinicalService.getAntecedentes(db, patientId);
});

ipcMain.removeHandler('clinical-save-antecedentes');
ipcMain.handle('clinical-save-antecedentes', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return clinicalService.saveAntecedentes(db, payload || {});
});

ipcMain.removeHandler('clinical-list-default-conditions');
ipcMain.handle('clinical-list-default-conditions', async (event) => {
  assertAuthorizedAppSession(event);
  return clinicalService.listDefaultConditions(db);
});

ipcMain.removeHandler('clinical-add-default-condition');
ipcMain.handle('clinical-add-default-condition', async (event, name) => {
  assertAuthorizedAppSession(event);
  return clinicalService.addDefaultCondition(db, name);
});

ipcMain.removeHandler('clinical-remove-default-condition');
ipcMain.handle('clinical-remove-default-condition', async (event, conditionId) => {
  assertAuthorizedAppSession(event);
  return clinicalService.removeDefaultCondition(db, conditionId);
});

ipcMain.removeHandler('clinical-list-radiographs');
ipcMain.handle('clinical-list-radiographs', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return clinicalService.listRadiographs(db, patientId);
});

ipcMain.removeHandler('clinical-save-radiograph');
ipcMain.handle('clinical-save-radiograph', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return clinicalService.saveRadiograph(db, payload || {});
});

ipcMain.removeHandler('clinical-remove-radiograph');
ipcMain.handle('clinical-remove-radiograph', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return clinicalService.removeRadiograph(db, payload || {});
});

ipcMain.removeHandler('clinical-get-periodontogram');
ipcMain.handle('clinical-get-periodontogram', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return clinicalService.getPeriodontogram(db, patientId);
});

ipcMain.removeHandler('clinical-save-periodontogram');
ipcMain.handle('clinical-save-periodontogram', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return clinicalService.savePeriodontogram(db, payload || {});
});

ipcMain.removeHandler('clinical-save-treatment-record');
ipcMain.handle('clinical-save-treatment-record', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return clinicalService.saveTreatmentRecord(db, payload || {});
});

ipcMain.removeHandler('clinical-list-treatment-history');
ipcMain.handle('clinical-list-treatment-history', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return clinicalService.listTreatmentHistory(db, patientId);
});

ipcMain.removeHandler('clinical-list-prescriptions');
ipcMain.handle('clinical-list-prescriptions', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return clinicalService.listPrescriptions(db, patientId);
});

ipcMain.removeHandler('crm-save-template');
ipcMain.handle('crm-save-template', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return crmService.saveTemplate(db, payload || {});
});

ipcMain.removeHandler('crm-archive-template');
ipcMain.handle('crm-archive-template', async (event, templateId) => {
  assertAuthorizedAppSession(event);
  return crmService.archiveTemplate(db, templateId);
});

ipcMain.removeHandler('crm-restore-template');
ipcMain.handle('crm-restore-template', async (event, templateId) => {
  assertAuthorizedAppSession(event);
  return crmService.restoreTemplate(db, templateId);
});

ipcMain.removeHandler('crm-duplicate-template');
ipcMain.handle('crm-duplicate-template', async (event, templateId) => {
  assertAuthorizedAppSession(event);
  return crmService.duplicateTemplate(db, templateId);
});

ipcMain.removeHandler('crm-set-default-reminder-template');
ipcMain.handle('crm-set-default-reminder-template', async (event, templateId) => {
  assertAuthorizedAppSession(event);
  return crmService.setDefaultReminderTemplate(db, templateId);
});

ipcMain.removeHandler('crm-save-campaign');
ipcMain.handle('crm-save-campaign', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return crmService.saveCampaign(db, payload || {});
});

ipcMain.removeHandler('crm-delete-campaign');
ipcMain.handle('crm-delete-campaign', async (event, campaignId) => {
  assertAuthorizedAppSession(event);
  return crmService.deleteCampaign(db, campaignId);
});

ipcMain.removeHandler('crm-log-survey-dispatch');
ipcMain.handle('crm-log-survey-dispatch', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return crmService.logSurveyDispatch(db, payload || {});
});

ipcMain.removeHandler('crm-record-reminder-deliveries');
ipcMain.handle('crm-record-reminder-deliveries', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return crmService.recordReminderDeliveries(db, payload || {});
});

ipcMain.removeHandler('crm-save-survey-template');
ipcMain.handle('crm-save-survey-template', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return crmService.saveSurveyTemplate(db, payload || {});
});

ipcMain.removeHandler('crm-archive-survey-template');
ipcMain.handle('crm-archive-survey-template', async (event, templateId) => {
  assertAuthorizedAppSession(event);
  return crmService.archiveSurveyTemplate(db, templateId);
});

ipcMain.removeHandler('finance-save-treatment-plan');
ipcMain.handle('finance-save-treatment-plan', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.saveTreatmentPlan(db, payload || {});
});

ipcMain.removeHandler('finance-get-treatment-plan-detail');
ipcMain.handle('finance-get-treatment-plan-detail', async (event, planId) => {
  assertAuthorizedAppSession(event);
  return financeService.getTreatmentPlanDetail(db, planId);
});

ipcMain.removeHandler('finance-get-patient-summary');
ipcMain.handle('finance-get-patient-summary', async (event, patientId) => {
  assertAuthorizedAppSession(event);
  return financeService.getPatientFinancialSummary(db, patientId);
});

ipcMain.removeHandler('finance-update-treatment-plan-progress');
ipcMain.handle('finance-update-treatment-plan-progress', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.updateTreatmentPlanProgress(db, payload || {});
});

ipcMain.removeHandler('finance-set-treatment-plan-status');
ipcMain.handle('finance-set-treatment-plan-status', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.setTreatmentPlanStatus(db, payload || {});
});

ipcMain.removeHandler('finance-cancel-treatment-plan');
ipcMain.handle('finance-cancel-treatment-plan', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.cancelTreatmentPlan(db, payload || {});
});

ipcMain.removeHandler('finance-delete-treatment-plan');
ipcMain.handle('finance-delete-treatment-plan', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.deleteTreatmentPlan(db, payload || {});
});

ipcMain.removeHandler('finance-register-payment');
ipcMain.handle('finance-register-payment', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.registerPayment(db, payload || {});
});

ipcMain.removeHandler('finance-register-refund');
ipcMain.handle('finance-register-refund', async (event, payload) => {
  assertAuthorizedAppSession(event);
  return financeService.registerRefund(db, payload || {});
});

ipcMain.removeHandler('finance-generate-simulated-invoice');
ipcMain.handle('finance-generate-simulated-invoice', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return financeService.generateSimulatedInvoice(db, payload || {});
});

ipcMain.removeHandler('finance-get-simulated-invoices');
ipcMain.handle('finance-get-simulated-invoices', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return financeService.getSimulatedInvoices(db, payload || {});
});

ipcMain.removeHandler('finance-get-overdue-accounts');
ipcMain.handle('finance-get-overdue-accounts', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return financeService.getOverdueAccounts(db, payload || {});
});

ipcMain.removeHandler('finance-get-report');
ipcMain.handle('finance-get-report', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return financeService.getFinanceReport(db, payload || {});
});

ipcMain.removeHandler('finance-send-collection-reminder');
ipcMain.handle('finance-send-collection-reminder', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return financeService.sendCollectionReminder(db, payload || {});
});

ipcMain.removeHandler('cash-open-box');
ipcMain.handle('cash-open-box', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return cashService.openCashBox(db, payload || {});
});

ipcMain.removeHandler('cash-close-box');
ipcMain.handle('cash-close-box', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return cashService.closeCashBox(db, payload || {});
});

ipcMain.removeHandler('cash-record-movement');
ipcMain.handle('cash-record-movement', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return cashService.recordMovement(db, payload || {});
});

ipcMain.removeHandler('print-preview-current-page');
ipcMain.handle('print-preview-current-page', async (event, options = {}) => {
  assertAuthorizedAppSession(event);
  assertTrustedRenderer(event);

  const sender = event.sender;
  const fileName = String(options.fileName || 'vista-previa.pdf')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .slice(0, 120) || 'vista-previa.pdf';
  const previewDir = path.join(app.getPath('temp'), 'sonalia-print-preview');
  const previewPath = path.join(previewDir, fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`);

  fs.mkdirSync(previewDir, { recursive: true });
  const pdfBuffer = await sender.printToPDF({
    printBackground: true,
    landscape: false,
    pageSize: 'A4',
    margins: { marginType: 'none' },
  });
  fs.writeFileSync(previewPath, pdfBuffer);

  const openError = await shell.openPath(previewPath);
  if (openError) {
    throw new Error(openError);
  }

  return { ok: true, path: previewPath };
});

ipcMain.removeHandler('odontogram-save-diagnosis');
ipcMain.handle('odontogram-save-diagnosis', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return odontogramService.saveOdontogramDiagnosis(db, payload || {});
});

ipcMain.removeHandler('odontogram-clear-diagnosis');
ipcMain.handle('odontogram-clear-diagnosis', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return odontogramService.clearOdontogramDiagnosis(db, payload || {});
});

ipcMain.removeHandler('cajas-get-movimientos-avanzado');
ipcMain.handle('cajas-get-movimientos-avanzado', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return cajasReportService.getMovimientosAvanzado(db, payload || {});
});

ipcMain.removeHandler('cajas-get-resumen-contable');
ipcMain.handle('cajas-get-resumen-contable', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return cajasReportService.getResumenContable(db, payload || {});
});

ipcMain.removeHandler('cajas-get-saldos-metodo');
ipcMain.handle('cajas-get-saldos-metodo', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);
  return cajasReportService.getSaldosPorMetodo(db, payload || {});
});

ipcMain.removeHandler('backup-run-manual');
ipcMain.handle('backup-run-manual', async (event) => {
  assertAuthorizedAppSession(event);
  return backupService.runManualBackup();
});

ipcMain.removeHandler('backup-list');
ipcMain.handle('backup-list', async (event) => {
  assertAuthorizedAppSession(event);
  return backupService.listBackups();
});

ipcMain.removeHandler('send-bulk-email');
ipcMain.handle('send-bulk-email', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);

  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const subject = payload.subject || '';
  const body = payload.body || '';
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const throttleMs = Number(payload.throttleMs || 0);
  const delayMs = Number.isFinite(throttleMs) ? Math.max(0, throttleMs) : 0;

  if (!recipients.length) {
    return { success: false, sent: 0, failed: 0, error: 'No recipients provided' };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += 1) {
    const recipient = recipients[i] || {};
    const personalizedSubject = replaceTemplateVars(subject, recipient);
    const personalizedBody = replaceTemplateVars(body, recipient);

    try {
      await sendEmail({
        to: recipient.email,
        subject: personalizedSubject,
        html: toHtmlBody(personalizedBody),
        attachments,
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      errors.push({ email: recipient.email || '', error: e.message || 'send failed' });
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('email-progress', {
        current: i + 1,
        total: recipients.length,
      });
    }

    if (delayMs && i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
    error: failed ? 'Some emails failed' : null,
  };
});

ipcMain.removeHandler('gmail-send');
ipcMain.handle('gmail-send', async (event, { to, subject, html, attachments }) => {
  assertAuthorizedAppSession(event);
  try {
    await sendEmail({ to, subject, html, attachments });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.removeHandler('send-appointment-notification');
ipcMain.handle('send-appointment-notification', async (event, appointmentData) => {
  assertAuthorizedAppSession(event);
  try {
    const success = await sendAppointmentNotification(appointmentData);
    return { success };
  } catch (e) {
    console.error('[IPC] Error sending appointment notification:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.removeHandler('backup-run-manual');
ipcMain.handle('backup-run-manual', async (event) => {
  assertAuthorizedAppSession(event);
  return backupService.runManualBackup();
});

ipcMain.removeHandler('backup-list');
ipcMain.handle('backup-list', async (event) => {
  assertAuthorizedAppSession(event);
  return backupService.listBackups();
});

ipcMain.removeHandler('send-bulk-email');
ipcMain.handle('send-bulk-email', async (event, payload = {}) => {
  assertAuthorizedAppSession(event);

  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const subject = payload.subject || '';
  const body = payload.body || '';
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const throttleMs = Number(payload.throttleMs || 0);
  const delayMs = Number.isFinite(throttleMs) ? Math.max(0, throttleMs) : 0;

  if (!recipients.length) {
    return { success: false, sent: 0, failed: 0, error: 'No recipients provided' };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += 1) {
    const recipient = recipients[i] || {};
    const personalizedSubject = replaceTemplateVars(subject, recipient);
    const personalizedBody = replaceTemplateVars(body, recipient);

    try {
      await sendEmail({
        to: recipient.email,
        subject: personalizedSubject,
        html: toHtmlBody(personalizedBody),
        attachments,
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      errors.push({ email: recipient.email || '', error: e.message || 'send failed' });
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('email-progress', {
        current: i + 1,
        total: recipients.length,
      });
    }

    if (delayMs && i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
    error: failed ? 'Some emails failed' : null,
  };
});

ipcMain.removeHandler('gmail-send');
ipcMain.handle('gmail-send', async (event, { to, subject, html, attachments }) => {
  assertAuthorizedAppSession(event);
  try {
    await sendEmail({ to, subject, html, attachments });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.removeHandler('send-appointment-notification');
ipcMain.handle('send-appointment-notification', async (event, appointmentData) => {
  assertAuthorizedAppSession(event);
  try {
    const success = await sendAppointmentNotification(appointmentData);
    return { success };
  } catch (e) {
    console.error('[IPC] Error sending appointment notification:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle("open-external", async (event, url) => {
  const { shell } = require("electron");
  await shell.openExternal(url);
  return true;
});

// -------------------------------------------------------------
// ACCOUNTING HANDLERS
// -------------------------------------------------------------
registerAccountingHandlers(ipcMain, db, assertAuthorizedAppSession);
