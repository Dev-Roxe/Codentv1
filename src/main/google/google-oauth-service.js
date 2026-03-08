const fs = require('fs');
const path = require('path');
const {
  getUserDataDir,
  loadGoogleCredentials,
  readJsonIfExists,
  runLoopbackOAuthFlow,
  secureWriteJson
} = require('./oauth-loopback-helper');

const LOGIN_CALLBACK_PATH = '/oauth/google/callback';
const LOGIN_USER_DATA_PATH = path.join(getUserDataDir(), 'google-login-user.json');

const OAUTH_SCOPES = ['openid', 'email', 'profile'];

function saveOAuthUserData(userData) {
  try {
    secureWriteJson(LOGIN_USER_DATA_PATH, userData);
  } catch (error) {
    console.error('Error guardando datos de usuario OAuth:', error);
  }
}

function loadOAuthUserData() {
  try {
    return readJsonIfExists(LOGIN_USER_DATA_PATH);
  } catch (error) {
    console.error('Error cargando datos de usuario OAuth:', error);
    return null;
  }
}

function getLoggedInUser() {
  return loadOAuthUserData();
}

function logoutOAuthUser() {
  try {
    if (fs.existsSync(LOGIN_USER_DATA_PATH)) {
      fs.unlinkSync(LOGIN_USER_DATA_PATH);
    }
    return true;
  } catch (error) {
    console.error('Error cerrando sesion OAuth:', error);
    return false;
  }
}

async function authenticateWithGoogle() {
  const credentials = loadGoogleCredentials();
  const { client, tokens, redirectUri } = await runLoopbackOAuthFlow({
    callbackPath: LOGIN_CALLBACK_PATH,
    scopes: OAUTH_SCOPES,
    prompt: 'select_account',
    includeGrantedScopes: true
  });

  if (!tokens?.id_token) {
    throw new Error('Google no devolvio id_token. Verifica los scopes openid, email y profile.');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: credentials.clientId
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error('No se pudo obtener el email del usuario desde id_token.');
  }

  const userData = {
    googleId: payload.sub,
    email: payload.email,
    nombre: payload.given_name || payload.name || '',
    apellido: payload.family_name || '',
    emailVerified: !!payload.email_verified,
    fotoPerfil: payload.picture || null,
    redirectUri,
    timestamp: new Date().toISOString()
  };

  saveOAuthUserData(userData);
  return userData;
}

module.exports = {
  authenticateWithGoogle,
  getLoggedInUser,
  loadOAuthUserData,
  logoutOAuthUser,
  saveOAuthUserData
};
