require('dotenv').config({ quiet: true });
process.env.GOOGLE_OAUTH_TIMEOUT_MS = process.env.GOOGLE_OAUTH_TIMEOUT_MS || '600000';

const {
  authorizeOfficialSender,
  resolveBundledSystemMailTokenPath,
  resolveSystemMailTokenPath,
} = require('../src/main/google/system-mail-auth');

async function main() {
  console.log('Iniciando autorizacion del correo oficial del sistema...');
  console.log(`Token local esperado en: ${resolveSystemMailTokenPath()}`);
  console.log(`Token empaquetable esperado en: ${resolveBundledSystemMailTokenPath()}`);
  console.log('Este comando se ejecuta una sola vez antes de generar el instalador.');

  try {
    const status = await authorizeOfficialSender();
    console.log(JSON.stringify({
      success: true,
      tokenPath: resolveSystemMailTokenPath(),
      status,
    }, null, 2));
    process.exitCode = 0;
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      tokenPath: resolveSystemMailTokenPath(),
    }, null, 2));
    process.exitCode = 1;
  }
}

main();
