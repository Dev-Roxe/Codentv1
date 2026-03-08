const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { app, shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');

const DEFAULT_HOST = process.env.GOOGLE_OAUTH_LOOPBACK_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.GOOGLE_OAUTH_LOOPBACK_PORT || 3000);
const DEFAULT_TIMEOUT_MS = Number(process.env.GOOGLE_OAUTH_TIMEOUT_MS || 180000);
const CREDENTIALS_PATH = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function getUserDataDir() {
  try {
    if (app && typeof app.getPath === 'function') {
      return ensureDir(app.getPath('userData'));
    }
  } catch (error) {
    // fallback below
  }

  return ensureDir(path.join(process.cwd(), '.sonalia-user-data'));
}

function secureWriteJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');

  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o600);
    } catch (error) {
      // ignore chmod failures on unsupported filesystems
    }
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadGoogleCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`No existe credentials.json en ${CREDENTIALS_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const config = raw.installed || raw.web;

  if (!config?.client_id || !config?.client_secret) {
    throw new Error('credentials.json no contiene un cliente OAuth valido');
  }

  return {
    clientType: raw.installed ? 'desktop' : raw.web ? 'web' : 'unknown',
    clientId: config.client_id,
    clientSecret: config.client_secret,
    redirectUris: Array.isArray(config.redirect_uris) ? config.redirect_uris : [],
    authUri: config.auth_uri || 'https://accounts.google.com/o/oauth2/auth',
    tokenUri: config.token_uri || 'https://oauth2.googleapis.com/token'
  };
}

function buildLoopbackRedirectUri(callbackPath, port = DEFAULT_PORT, host = DEFAULT_HOST) {
  return `http://${host}:${port}${callbackPath}`;
}

function createOAuthClient({ callbackPath, port = DEFAULT_PORT, host = DEFAULT_HOST }) {
  const credentials = loadGoogleCredentials();
  const redirectUri = buildLoopbackRedirectUri(callbackPath, port, host);

  if (credentials.clientType === 'web' && !credentials.redirectUris.includes(redirectUri)) {
    const error = new Error(`redirect_uri_mismatch: agrega ${redirectUri} a los URIs autorizados del cliente OAuth en Google Cloud`);
    error.code = 'redirect_uri_mismatch';
    throw error;
  }

  return {
    client: new OAuth2Client(credentials.clientId, credentials.clientSecret, redirectUri),
    redirectUri,
    credentials
  };
}

function buildResultHtml({ title, message, success }) {
  const accent = success ? '#0F9D58' : '#DB4437';
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #f8fafc, #e2e8f0);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0f172a;
      }
      .card {
        width: min(480px, calc(100vw - 32px));
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
        padding: 32px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: ${success ? '#ecfdf3' : '#fef2f2'};
        color: ${accent};
        font-size: 13px;
        font-weight: 700;
      }
      h1 {
        margin: 16px 0 8px;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        color: #475569;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge">${success ? 'Autorizacion completada' : 'Autorizacion fallida'}</div>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
}

function normalizeOAuthError(error) {
  if (!error) return new Error('Error OAuth desconocido');
  if (error.code === 'redirect_uri_mismatch') return error;

  if (error.code === 'EADDRINUSE') {
    const friendly = new Error(`El puerto ${DEFAULT_PORT} ya esta en uso. Cierra el proceso que lo ocupa o cambia GOOGLE_OAUTH_LOOPBACK_PORT.`);
    friendly.code = error.code;
    return friendly;
  }

  if (String(error.message || '').includes('invalid_grant')) {
    const friendly = new Error('Google rechazo el codigo de autorizacion. Intenta iniciar el flujo otra vez.');
    friendly.code = 'invalid_grant';
    return friendly;
  }

  return error;
}

async function runLoopbackOAuthFlow({
  callbackPath,
  scopes,
  prompt = 'consent',
  accessType = 'offline',
  includeGrantedScopes = true,
  loginHint,
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const { client, redirectUri, credentials } = createOAuthClient({ callbackPath, host, port });
  const state = crypto.randomUUID();

  const appExpress = express();
  let server;
  let timeoutId;
  let settled = false;

  const resultPromise = new Promise((resolve, reject) => {
    const finish = (error, value) => {
      if (settled) return;
      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (server) {
        server.close(() => { });
        server = null;
      }

      if (error) reject(normalizeOAuthError(error));
      else resolve(value);
    };

    appExpress.get(callbackPath, async (req, res) => {
      const returnedState = req.query.state;
      const error = req.query.error;
      const errorDescription = req.query.error_description;
      const code = req.query.code;

      if (returnedState !== state) {
        res.status(400).send(buildResultHtml({
          title: 'Solicitud invalida',
          message: 'El estado OAuth no coincide. Vuelve a iniciar el proceso desde la app.',
          success: false
        }));
        finish(Object.assign(new Error('Estado OAuth invalido'), { code: 'oauth_state_mismatch' }));
        return;
      }

      if (error) {
        const message = errorDescription ? `${error}: ${errorDescription}` : error;
        res.status(400).send(buildResultHtml({
          title: 'Autorizacion cancelada',
          message,
          success: false
        }));
        finish(Object.assign(new Error(message), { code: error }));
        return;
      }

      if (!code) {
        res.status(400).send(buildResultHtml({
          title: 'Codigo no recibido',
          message: 'Google no devolvio el codigo de autorizacion.',
          success: false
        }));
        finish(new Error('Google no devolvio el codigo de autorizacion'));
        return;
      }

      try {
        const tokenResponse = await client.getToken(String(code));
        const tokens = tokenResponse.tokens || {};
        client.setCredentials(tokens);

        res.status(200).send(buildResultHtml({
          title: 'Cuenta conectada',
          message: 'Ya puedes volver a Sonalia y continuar.',
          success: true
        }));

        finish(null, { client, tokens, redirectUri, credentials });
      } catch (exchangeError) {
        res.status(500).send(buildResultHtml({
          title: 'No se pudo completar el login',
          message: exchangeError.message || 'Fallo el intercambio del codigo por tokens.',
          success: false
        }));
        finish(exchangeError);
      }
    });

    server = appExpress.listen(port, host, async () => {
      timeoutId = setTimeout(() => {
        finish(Object.assign(new Error('Tiempo agotado esperando la autorizacion de Google.'), { code: 'oauth_timeout' }));
      }, timeoutMs);

      try {
        const authUrl = client.generateAuthUrl({
          access_type: accessType,
          scope: scopes,
          prompt,
          include_granted_scopes: includeGrantedScopes,
          state,
          ...(loginHint ? { login_hint: loginHint } : {})
        });

        await shell.openExternal(authUrl);
      } catch (browserError) {
        finish(browserError);
      }
    });

    server.once('error', (listenError) => finish(listenError));
  });

  return resultPromise;
}

module.exports = {
  CREDENTIALS_PATH,
  DEFAULT_HOST,
  DEFAULT_PORT,
  buildLoopbackRedirectUri,
  createOAuthClient,
  getUserDataDir,
  loadGoogleCredentials,
  readJsonIfExists,
  runLoopbackOAuthFlow,
  secureWriteJson
};
