const path = require('path');
const os = require('os');

const DEFAULT_APP_NAME = 'Codent';

function resolveUserDataPath() {
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch (err) {
    // ignore
  }

  const appName = process.env.CODENT_APP_NAME || DEFAULT_APP_NAME;
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, appName);
}

function resolveDbPath() {
  if (process.env.CODEX_DB_PATH) return process.env.CODEX_DB_PATH;
  const userData = resolveUserDataPath();
  return path.join(userData, 'consultorio.db');
}

module.exports = {
  resolveDbPath,
  resolveUserDataPath
};