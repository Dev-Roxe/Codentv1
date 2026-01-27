const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { BrowserWindow } = require('electron');

/* ============================================================
   RUTAS
============================================================ */
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/* ============================================================
   SCOPES PARA OAUTH (PERFIL Y EMAIL)
============================================================ */
const OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

/* ============================================================
   CARGAR CLIENTE OAUTH PARA LOGIN
============================================================ */
function getOAuthClient() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error('No existe credentials.json en /src/main/google/');
    }

    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(content).installed;

    // Use localhost redirect URI (configured in Google Cloud Console)
    return new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        'http://localhost'
    );
}

/* ============================================================
   GENERAR URL PARA LOGIN CON GOOGLE Y OBTENER CÓDIGO
============================================================ */
async function authenticateWithGoogle() {
    return new Promise((resolve, reject) => {
        const client = getOAuthClient();

        // Generate auth URL
        const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            scope: OAUTH_SCOPES,
            prompt: 'select_account',
            include_granted_scopes: true,
        });

        // Use an isolated in-memory session to avoid reusing cookies
        const oauthPartition = `oauth-${Date.now()}`;

        // Create a window to handle OAuth
        const authWindow = new BrowserWindow({
            width: 500,
            height: 700,
            show: true,
            modal: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                partition: oauthPartition
            },
            title: 'Iniciar sesión con Google'
        });

        let isAuthComplete = false;

        authWindow.loadURL(authUrl);

        // Handle navigation - check for localhost redirect
        authWindow.webContents.on('will-navigate', async (event, url) => {
            await handleRedirect(url);
        });

        authWindow.webContents.on('did-navigate', async (event, url) => {
            await handleRedirect(url);
        });

        // Also check on redirect
        authWindow.webContents.on('will-redirect', async (event, url) => {
            await handleRedirect(url);
        });

        async function handleRedirect(url) {
            console.log('OAuth redirect URL:', url);

            if (url.startsWith('http://localhost')) {
                isAuthComplete = true;

                try {
                    // Extract code from URL
                    const urlObj = new URL(url);
                    const code = urlObj.searchParams.get('code');
                    const error = urlObj.searchParams.get('error');

                    if (error) {
                        authWindow.close();
                        return reject(new Error(`Error de Google: ${error}`));
                    }

                    if (code) {
                        console.log('OAuth code received, exchanging for tokens...');

                        // Exchange code for tokens
                        const { tokens } = await client.getToken(code);
                        client.setCredentials(tokens);

                        // Get user info
                        const oauth2 = google.oauth2({ version: 'v2', auth: client });
                        const { data } = await oauth2.userinfo.get();

                        authWindow.close();

                        resolve({
                            googleId: data.id,
                            email: data.email,
                            nombre: data.given_name || data.name || '',
                            apellido: data.family_name || '',
                            emailVerified: data.verified_email || false,
                            fotoPerfil: data.picture || null
                        });
                    } else {
                        authWindow.close();
                        reject(new Error('No se recibió código de autorización'));
                    }
                } catch (error) {
                    authWindow.close();
                    reject(error);
                }
            }
        }

        // Handle window close
        authWindow.on('closed', () => {
            if (!isAuthComplete) {
                reject(new Error('Ventana de autenticación cerrada por el usuario'));
            }
        });

        // Handle any load errors
        authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('OAuth window failed to load:', errorCode, errorDescription);
        });
    });
}

module.exports = {
    authenticateWithGoogle
};
