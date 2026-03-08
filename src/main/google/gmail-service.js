const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const {
  createOAuthClient,
  getUserDataDir,
  readJsonIfExists,
  runLoopbackOAuthFlow,
  secureWriteJson
} = require('./oauth-loopback-helper');

const GMAIL_CALLBACK_PATH = '/oauth/gmail/callback';
const TOKEN_PATH = path.join(getUserDataDir(), 'gmail-fixed-sender-token.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

function saveTokenData(tokens) {
  secureWriteJson(TOKEN_PATH, tokens);
}

function loadToken() {
  return readJsonIfExists(TOKEN_PATH);
}

function hasFixedSenderToken() {
  return fs.existsSync(TOKEN_PATH);
}

async function connectFixedSenderAccount() {
  const { client, tokens } = await runLoopbackOAuthFlow({
    callbackPath: GMAIL_CALLBACK_PATH,
    scopes: SCOPES,
    prompt: 'consent',
    includeGrantedScopes: true
  });

  if (!tokens?.refresh_token) {
    throw new Error('Google no devolvio refresh_token. Revoca el acceso previo y vuelve a autorizar con prompt=consent.');
  }

  saveTokenData(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  return {
    email: data.email || null,
    nombre: data.name || '',
    connected: true
  };
}

async function authorizeFixedSender() {
  const token = loadToken();
  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const { client } = createOAuthClient({ callbackPath: GMAIL_CALLBACK_PATH });
  client.setCredentials(token);

  client.on('tokens', (newTokens) => {
    const merged = {
      ...loadToken(),
      ...newTokens
    };
    saveTokenData(merged);
  });

  return client;
}

async function sendEmail({ to, subject, html, attachments }) {
  const auth = await authorizeFixedSender();
  const gmail = google.gmail({ version: 'v1', auth });

  let message = '';

  if (Array.isArray(attachments) && attachments.length) {
    const boundary = `----=_Part_${Date.now()}`;
    const parts = [];
    parts.push(`To: ${to}`);
    parts.push(`Subject: ${subject}`);
    parts.push('MIME-Version: 1.0');
    parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    parts.push('');
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/html; charset="UTF-8"');
    parts.push('Content-Transfer-Encoding: 7bit');
    parts.push('');
    parts.push(html);

    for (const att of attachments) {
      parts.push('');
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      parts.push('');
      parts.push(String(att.dataBase64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\r?\n/g, ''));
    }

    parts.push(`--${boundary}--`);
    message = parts.join('\r\n');
  } else {
    message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html
    ].join('\r\n');
  }

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });

  return true;
}

module.exports = {
  SCOPES,
  TOKEN_PATH,
  authorizeFixedSender,
  connectFixedSenderAccount,
  hasFixedSenderToken,
  loadToken,
  saveTokenData,
  sendEmail
};
