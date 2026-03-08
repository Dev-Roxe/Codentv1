const path = require('path');
const os = require('os');
const fs = require('fs');

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
  const primary = path.join(userData, 'consultorio.db');

  if (fs.existsSync(primary)) return primary;

  const legacyNames = new Set();
  const cwdName = path.basename(process.cwd() || '').trim();
  if (cwdName) legacyNames.add(cwdName);
  legacyNames.add('codentv1');
  legacyNames.add('Codent');

  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  for (const name of legacyNames) {
    const legacyPath = path.join(base, name, 'consultorio.db');
    if (legacyPath !== primary && fs.existsSync(legacyPath)) return legacyPath;
  }

  return primary;
}

module.exports = {
  resolveDbPath,
  resolveUserDataPath
};
