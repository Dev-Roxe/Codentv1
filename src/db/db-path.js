const path = require('path');
const os = require('os');
const fs = require('fs');

const DEFAULT_APP_NAME = 'Codent';
const DB_FILE_NAME = 'consultorio.db';
const SEED_DB_PATH = path.join(__dirname, 'seed', DB_FILE_NAME);

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
  const primary = path.join(userData, DB_FILE_NAME);

  const legacyNames = new Set();
  const cwdName = path.basename(process.cwd() || '').trim();
  if (cwdName) legacyNames.add(cwdName);
  legacyNames.add('codentv1');
  legacyNames.add('Codent');

  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const candidates = [primary];
  for (const name of legacyNames) {
    const legacyPath = path.join(base, name, DB_FILE_NAME);
    if (legacyPath !== primary) candidates.push(legacyPath);
  }

  const existing = candidates
    .filter((candidatePath, index, list) => list.indexOf(candidatePath) === index)
    .filter(candidatePath => fs.existsSync(candidatePath));

  if (existing.length === 0) {
    copySeedDatabaseIfAvailable(primary);
    return primary;
  }
  if (!fs.existsSync(primary)) return existing[0];

  const primaryFootprint = getDbFootprint(primary);
  const richerLegacy = existing
    .filter(candidatePath => candidatePath !== primary)
    .map(candidatePath => ({ path: candidatePath, footprint: getDbFootprint(candidatePath) }))
    .filter(candidate => candidate.footprint > Math.max(primaryFootprint * 2, primaryFootprint + 512 * 1024))
    .sort((a, b) => b.footprint - a.footprint)[0];

  if (richerLegacy) {
    console.warn(
      `Usando DB legacy con mas datos: ${richerLegacy.path}. DB primaria detectada: ${primary}`
    );
    return richerLegacy.path;
  }

  return primary;
}

function getDbFootprint(dbFilePath) {
  return [dbFilePath, `${dbFilePath}-wal`].reduce((total, filePath) => {
    try {
      return total + fs.statSync(filePath).size;
    } catch (err) {
      return total;
    }
  }, 0);
}

function copySeedDatabaseIfAvailable(targetPath) {
  if (!fs.existsSync(SEED_DB_PATH) || fs.existsSync(targetPath)) return false;

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(SEED_DB_PATH, targetPath, fs.constants.COPYFILE_EXCL);
    console.log(`Base de datos inicial instalada en: ${targetPath}`);
    return true;
  } catch (err) {
    console.warn('No se pudo instalar la base de datos inicial:', err && err.message);
    return false;
  }
}

module.exports = {
  resolveDbPath,
  resolveUserDataPath
};
