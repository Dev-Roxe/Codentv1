const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

/* ============================================================
   RUTAS
============================================================ */
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

/* ============================================================
   SCOPES PERMITIDOS
============================================================ */
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

/* ============================================================
   CARGAR CLIENTE OAUTH
============================================================ */
function getOAuthClient() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error("No existe credentials.json en /src/main/google/");
    }

    const content = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    const credentials = JSON.parse(content).installed;

    return new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        "urn:ietf:wg:oauth:2.0:oob"
    );
}

/* ============================================================
   GENERAR URL PARA AUTORIZAR APP
============================================================ */
async function generateAuthUrl() {
    const client = getOAuthClient();
    return client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
    });
}

/* ============================================================
   GUARDAR TOKEN (DESDE EL CÓDIGO DE GOOGLE)
============================================================ */
async function saveToken(code) {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log("Token guardado correctamente");

    return true;
}

/* ============================================================
   CARGAR TOKEN LOCAL
============================================================ */
function loadToken() {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
}

/* ============================================================
   AUTORIZACIÓN CON REFRESH AUTOMÁTICO
============================================================ */
async function authorize() {
    const token = loadToken();
    if (!token) throw new Error("NO_TOKEN");

    const client = getOAuthClient();
    client.setCredentials(token);

    // Si Google devuelve un nuevo refresh token, lo guardamos
    client.on("tokens", (tokens) => {
        if (tokens.refresh_token) {
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log("Token actualizado automaticamente");
        }
    });

    return client;
}

/* ============================================================
   ENVIAR EMAIL HTML (GMAIL API)
============================================================ */
async function sendEmail({ to, subject, html, attachments }) {
    const auth = await authorize();
    const gmail = google.gmail({ version: "v1", auth });

    // If attachments provided, build multipart/mixed MIME message
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
            // att: { filename, mimeType, dataBase64 }
            parts.push('');
            parts.push(`--${boundary}`);
            parts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
            parts.push('Content-Transfer-Encoding: base64');
            parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
            parts.push('');
            // ensure dataBase64 has no data: prefix and no newlines problems
            const base = (att.dataBase64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\r?\n/g, '');
            parts.push(base);
        }

        parts.push(`--${boundary}--`);

        message = parts.join('\r\n');
    } else {
        // simple html-only message
        const parts = [];
        parts.push(`To: ${to}`);
        parts.push(`Subject: ${subject}`);
        parts.push('MIME-Version: 1.0');
        parts.push('Content-Type: text/html; charset=UTF-8');
        parts.push('');
        parts.push(html);
        message = parts.join('\r\n');
    }

    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
    });

    console.log(`Email enviado a ${to}`);
    return true;
}

/* ============================================================
   EXPORTS
============================================================ */
module.exports = {
    generateAuthUrl,
    saveToken,
    sendEmail,
};
