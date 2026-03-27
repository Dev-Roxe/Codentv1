const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const MailComposer = require('nodemailer/lib/mail-composer');

const {
  evaluateFixedSenderStatus,
  resolveConfiguredSenderEmail,
  validateAuthorizedSender,
} = require('./fixed-sender-policy');

const DEFAULT_TOKEN_PATH = path.resolve(process.cwd(), '.sonalia-user-data', 'official-mail-token.json');
const DEFAULT_BUNDLED_TOKEN_PATH = path.join(__dirname, 'official-mail-token.json');
const CREDENTIALS_PATH = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');
const AUTH_CALLBACK_PATH = '/oauth/system-mail/callback';
const AUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function resolveSystemMailTokenPath() {
  const configuredPath = String(process.env.SYSTEM_MAIL_TOKEN_PATH || '').trim();
  const tokenPath = configuredPath
    ? (path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath))
    : DEFAULT_TOKEN_PATH;

  ensureDir(path.dirname(tokenPath));
  return tokenPath;
}

function resolveBundledSystemMailTokenPath() {
  const configuredPath = String(process.env.SYSTEM_MAIL_BUNDLED_TOKEN_PATH || '').trim();
  if (!configuredPath) {
    return DEFAULT_BUNDLED_TOKEN_PATH;
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
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
    clientId: config.client_id,
    clientSecret: config.client_secret,
    redirectUris: Array.isArray(config.redirect_uris) ? config.redirect_uris : [],
  };
}

function readAuthorizationFromPath(filePath, label) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${label}: ${error.message}`);
  }
}

function readStoredAuthorization() {
  return readAuthorizationFromPath(resolveSystemMailTokenPath(), 'el token oficial del sistema');
}

function readBundledAuthorization() {
  return readAuthorizationFromPath(resolveBundledSystemMailTokenPath(), 'el token oficial empaquetado');
}

function writeJsonSecure(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o600);
    } catch (error) {
      // ignore chmod failures on unsupported filesystems
    }
  }
}

function writeStoredAuthorization(payload) {
  writeJsonSecure(resolveSystemMailTokenPath(), payload);
}

function writeBundledAuthorization(payload) {
  writeJsonSecure(resolveBundledSystemMailTokenPath(), payload);
}

function clearStoredAuthorization() {
  const tokenPath = resolveSystemMailTokenPath();
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }
}

function ensureStoredAuthorization() {
  const storedAuthorization = readStoredAuthorization();
  if (storedAuthorization?.refresh_token) {
    return storedAuthorization;
  }

  const bundledAuthorization = readBundledAuthorization();
  if (bundledAuthorization?.refresh_token) {
    const seededAuthorization = {
      ...bundledAuthorization,
      seededFromBundleAt: new Date().toISOString(),
    };
    writeStoredAuthorization(seededAuthorization);
    return readStoredAuthorization();
  }

  return null;
}

function buildAuthorizationRequiredMessage() {
  const expectedEmail = resolveConfiguredSenderEmail();
  return `La cuenta oficial del sistema no esta autorizada en esta instalacion. Debes generar y empaquetar el token oficial de ${expectedEmail} antes de instalar la app.`;
}

function buildAuthRevokedMessage() {
  return 'La autorizacion de la cuenta oficial del sistema expiro o fue revocada. Debes regenerar y reempaquetar el token oficial de correo.';
}

function isGoogleAuthFailure(error) {
  const message = String(error?.message || '');
  return Boolean(
    error?.code === 401
    || /invalid_grant/i.test(message)
    || /unauthorized/i.test(message)
    || /invalid_client/i.test(message)
    || /No refresh token/i.test(message)
    || /Login Required/i.test(message)
    || /insufficient authentication scopes/i.test(message)
  );
}

function createOAuthClient(storedAuthorization = ensureStoredAuthorization()) {
  if (!storedAuthorization?.refresh_token) {
    return null;
  }

  const credentials = loadGoogleCredentials();
  const client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
  let currentAuthorization = { ...storedAuthorization };

  client.on('tokens', (tokens = {}) => {
    currentAuthorization = {
      ...currentAuthorization,
      ...tokens,
      refresh_token: tokens.refresh_token || currentAuthorization.refresh_token,
      updatedAt: new Date().toISOString(),
    };
    writeStoredAuthorization(currentAuthorization);
  });

  client.setCredentials(currentAuthorization);
  return { client, credentials, storedAuthorization: currentAuthorization };
}

async function resolveAuthorizedSenderEmail(client, fallbackEmail = null) {
  const gmail = google.gmail({ version: 'v1', auth: client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return profile?.data?.emailAddress || fallbackEmail || '';
}

function buildAuthorizationPayload({ tokens, authorizedSenderEmail, redirectUri }) {
  return {
    ...tokens,
    authorizedSenderEmail,
    redirectUri,
    scope: tokens.scope || AUTH_SCOPES.join(' '),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function authorizeOfficialSender() {
  const { runLoopbackOAuthFlow } = require('./oauth-loopback-helper');
  const expectedEmail = resolveConfiguredSenderEmail();
  const credentials = loadGoogleCredentials();

  const { client, tokens, redirectUri } = await runLoopbackOAuthFlow({
    callbackPath: AUTH_CALLBACK_PATH,
    scopes: AUTH_SCOPES,
    prompt: 'consent',
    accessType: 'offline',
    includeGrantedScopes: true,
    loginHint: expectedEmail,
  });

  if (!tokens?.refresh_token) {
    throw new Error('Google no devolvio refresh_token. Revoca el acceso anterior y ejecuta "npm run mail:bootstrap" otra vez.');
  }

  let authorizedSenderEmail = '';
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: credentials.clientId,
    });
    authorizedSenderEmail = ticket.getPayload()?.email || '';
  }

  if (!authorizedSenderEmail) {
    authorizedSenderEmail = await resolveAuthorizedSenderEmail(client, expectedEmail);
  }

  validateAuthorizedSender({ authorizedSenderEmail });

  const authorizationPayload = buildAuthorizationPayload({
    tokens,
    authorizedSenderEmail,
    redirectUri,
  });

  writeStoredAuthorization(authorizationPayload);
  writeBundledAuthorization(authorizationPayload);

  return getOfficialMailStatus();
}

async function getOfficialMailStatus() {
  const expectedEmail = resolveConfiguredSenderEmail();
  const storedAuthorization = ensureStoredAuthorization();

  if (!storedAuthorization?.refresh_token) {
    return {
      ...evaluateFixedSenderStatus({
        connected: false,
        email: expectedEmail,
        error: buildAuthorizationRequiredMessage(),
      }),
      managedBy: 'system_google_oauth',
      requiresBootstrap: true,
      tokenPath: resolveSystemMailTokenPath(),
      bundledTokenPath: resolveBundledSystemMailTokenPath(),
    };
  }

  try {
    const auth = createOAuthClient(storedAuthorization);
    const actualEmail = await resolveAuthorizedSenderEmail(
      auth.client,
      storedAuthorization.authorizedSenderEmail || expectedEmail
    );

    validateAuthorizedSender({ authorizedSenderEmail: actualEmail });

    return {
      ...evaluateFixedSenderStatus({
        connected: true,
        email: actualEmail,
      }),
      managedBy: 'system_google_oauth',
      requiresBootstrap: false,
      tokenPath: resolveSystemMailTokenPath(),
      bundledTokenPath: resolveBundledSystemMailTokenPath(),
    };
  } catch (error) {
    const message = isGoogleAuthFailure(error)
      ? buildAuthRevokedMessage()
      : `No se pudo validar la cuenta oficial del sistema: ${error.message}`;

    return {
      ...evaluateFixedSenderStatus({
        connected: false,
        email: storedAuthorization.authorizedSenderEmail || expectedEmail,
        error: message,
      }),
      managedBy: 'system_google_oauth',
      requiresBootstrap: true,
      tokenPath: resolveSystemMailTokenPath(),
      bundledTokenPath: resolveBundledSystemMailTokenPath(),
    };
  }
}

function encodeBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .filter((attachment) => attachment && attachment.filename && attachment.dataBase64)
    .map((attachment) => ({
      filename: String(attachment.filename),
      contentType: String(attachment.mimeType || 'application/octet-stream'),
      content: Buffer.from(String(attachment.dataBase64), 'base64'),
    }));
}

async function buildRawMimeMessage({ to, subject, html, attachments }) {
  const message = new MailComposer({
    from: `Sonalia <${resolveConfiguredSenderEmail()}>`,
    to,
    subject,
    html,
    attachments: normalizeAttachments(attachments),
  });

  const rawMessage = await new Promise((resolve, reject) => {
    message.compile().build((error, payload) => {
      if (error) return reject(error);
      resolve(payload);
    });
  });

  return encodeBase64Url(rawMessage);
}

function buildMailUnavailableError(message) {
  const error = new Error(message || buildAuthorizationRequiredMessage());
  error.code = 'MAIL_SERVICE_UNAVAILABLE';
  return error;
}

async function sendOfficialEmail({ to, subject, html, attachments }) {
  const storedAuthorization = ensureStoredAuthorization();
  const auth = createOAuthClient(storedAuthorization);

  if (!auth) {
    throw buildMailUnavailableError();
  }

  try {
    const actualEmail = await resolveAuthorizedSenderEmail(
      auth.client,
      storedAuthorization.authorizedSenderEmail || resolveConfiguredSenderEmail()
    );

    validateAuthorizedSender({ authorizedSenderEmail: actualEmail });

    const gmail = google.gmail({ version: 'v1', auth: auth.client });
    const raw = await buildRawMimeMessage({ to, subject, html, attachments });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return true;
  } catch (error) {
    if (isGoogleAuthFailure(error)) {
      throw buildMailUnavailableError(buildAuthRevokedMessage());
    }
    throw error;
  }
}

module.exports = {
  AUTH_CALLBACK_PATH,
  AUTH_SCOPES,
  authorizeOfficialSender,
  buildAuthorizationRequiredMessage,
  clearStoredAuthorization,
  getOfficialMailStatus,
  resolveBundledSystemMailTokenPath,
  resolveSystemMailTokenPath,
  sendOfficialEmail,
};
