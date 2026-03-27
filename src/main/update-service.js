'use strict';

const https = require('https');
const { app, BrowserWindow, ipcMain } = require('electron');
const packageJson = require('../../package.json');

const RELEASE_HISTORY_TTL_MS = 5 * 60 * 1000;

let isInitialized = false;
let startupCheckStarted = false;
let activeCheckPromise = null;
let activeDownloadPromise = null;
let lastLoggedProgressBucket = -1;
let cachedAutoUpdater = null;

const releaseHistoryCache = {
  fetchedAt: 0,
  releases: [],
};

const updateState = {
  status: 'idle',
  currentVersion: packageJson.version,
  availableUpdate: null,
  downloadedUpdate: null,
  downloadProgress: null,
  lastCheckedAt: null,
  error: null,
};

function getAppVersion() {
  if (app && typeof app.getVersion === 'function') {
    return app.getVersion();
  }
  return packageJson.version;
}

function getAutoUpdater() {
  if (cachedAutoUpdater) return cachedAutoUpdater;

  const updaterModule = require('electron-updater');
  cachedAutoUpdater = updaterModule.autoUpdater;
  return cachedAutoUpdater;
}

function getGithubPublishConfig() {
  const publishConfig = packageJson?.build?.publish;
  if (Array.isArray(publishConfig)) {
    return publishConfig.find((entry) => entry && entry.provider === 'github') || null;
  }

  if (publishConfig && publishConfig.provider === 'github') {
    return publishConfig;
  }

  return null;
}

function hasValidGithubPublishConfig() {
  const config = getGithubPublishConfig();
  const owner = String(config?.owner || '').trim();
  const repo = String(config?.repo || '').trim();

  if (!owner || !repo) return false;
  if (owner.startsWith('TU_') || repo.startsWith('TU_')) return false;
  return true;
}

function normalizeReleaseNotes(releaseNotes) {
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        if (typeof entry.note === 'string') return entry.note;
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return typeof releaseNotes === 'string' ? releaseNotes : '';
}

function sanitizeReleaseInfo(info = {}) {
  return {
    version: String(info.version || ''),
    releaseName: String(info.releaseName || info.version || ''),
    releaseDate: info.releaseDate || null,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
  };
}

function getSerializableState() {
  return {
    status: updateState.status,
    currentVersion: getAppVersion(),
    availableUpdate: updateState.availableUpdate,
    downloadedUpdate: updateState.downloadedUpdate,
    downloadProgress: updateState.downloadProgress,
    lastCheckedAt: updateState.lastCheckedAt,
    error: updateState.error,
    githubConfigured: hasValidGithubPublishConfig(),
  };
}

function broadcastUpdateState() {
  const payload = getSerializableState();

  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send('updates-status', payload);
    } catch (error) {
      // Ignore windows that are still loading or closing.
    }
  });
}

function setUpdateState(patch = {}) {
  Object.assign(updateState, patch);
  updateState.currentVersion = getAppVersion();
  broadcastUpdateState();
}

function isConnectivityError(error) {
  const rawMessage = error && (error.stack || error.message || String(error));
  const message = String(rawMessage || '').toLowerCase();

  return [
    'net::err_internet_disconnected',
    'net::err_name_not_resolved',
    'net::err_connection_refused',
    'net::err_connection_reset',
    'net::err_connection_aborted',
    'net::err_timed_out',
    'econnrefused',
    'econnreset',
    'enotfound',
    'etimedout',
    'unable to connect',
    'socket hang up',
  ].some((token) => message.includes(token));
}

function logUpdaterError(error) {
  const message = error && error.message ? error.message : String(error || 'Error desconocido');

  if (isConnectivityError(error)) {
    console.warn('[updater] No fue posible buscar actualizaciones porque no hay conexion a internet.');
    setUpdateState({
      status: 'offline',
      error: { message: 'No hay conexion a internet para revisar actualizaciones.' },
    });
    return;
  }

  console.error('[updater] Error durante la actualizacion:', message);
  setUpdateState({
    status: 'error',
    error: { message },
  });
}

function configureAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    lastLoggedProgressBucket = -1;
    console.log('[updater] Buscando actualizaciones...');
    setUpdateState({
      status: 'checking',
      error: null,
      downloadProgress: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('update-available', (info) => {
    const release = sanitizeReleaseInfo(info);

    console.log(`[updater] Nueva version detectada: ${release.version}. Esperando confirmacion para descargar.`);
    setUpdateState({
      status: 'available',
      availableUpdate: release,
      downloadedUpdate: null,
      downloadProgress: null,
      error: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No hay actualizaciones disponibles.');
    setUpdateState({
      status: 'not-available',
      availableUpdate: null,
      downloadedUpdate: null,
      downloadProgress: null,
      error: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Number(progress?.percent || 0);
    const bucket = Math.floor(percent / 10);

    if (bucket !== lastLoggedProgressBucket) {
      lastLoggedProgressBucket = bucket;
      console.log(`[updater] Descarga en progreso: ${Math.round(percent)}%`);
    }

    setUpdateState({
      status: 'downloading',
      downloadProgress: {
        percent,
        bytesPerSecond: Number(progress?.bytesPerSecond || 0),
        transferred: Number(progress?.transferred || 0),
        total: Number(progress?.total || 0),
      },
      error: null,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    const release = sanitizeReleaseInfo(info);

    console.log(`[updater] Actualizacion ${release.version} descargada y lista para instalar.`);
    activeDownloadPromise = null;
    setUpdateState({
      status: 'downloaded',
      availableUpdate: release,
      downloadedUpdate: release,
      downloadProgress: {
        percent: 100,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      },
      error: null,
    });
  });

  autoUpdater.on('error', (error) => {
    activeCheckPromise = null;
    activeDownloadPromise = null;
    logUpdaterError(error);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `${packageJson.name}/${packageJson.version}`,
        },
      },
      (response) => {
        let raw = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub API respondio con ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error('No se pudo interpretar la respuesta de GitHub Releases.'));
          }
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error('Tiempo de espera agotado al consultar GitHub Releases.'));
    });
  });
}

async function getReleaseHistory({ force = false } = {}) {
  if (!hasValidGithubPublishConfig()) {
    return {
      success: false,
      error: 'Configura build.publish.owner y build.publish.repo con tu repositorio real de GitHub.',
      releases: [],
    };
  }

  if (!force && releaseHistoryCache.fetchedAt && (Date.now() - releaseHistoryCache.fetchedAt) < RELEASE_HISTORY_TTL_MS) {
    return {
      success: true,
      releases: releaseHistoryCache.releases,
      cached: true,
    };
  }

  const config = getGithubPublishConfig();
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/releases?per_page=10`;

  try {
    const response = await fetchJson(url);
    const releases = Array.isArray(response)
      ? response
        .filter((release) => release && !release.draft)
        .map((release) => ({
          id: release.id,
          version: String(release.tag_name || release.name || ''),
          title: String(release.name || release.tag_name || ''),
          publishedAt: release.published_at || null,
          notes: String(release.body || ''),
          prerelease: !!release.prerelease,
          htmlUrl: String(release.html_url || ''),
        }))
      : [];

    releaseHistoryCache.fetchedAt = Date.now();
    releaseHistoryCache.releases = releases;

    return {
      success: true,
      releases,
      cached: false,
    };
  } catch (error) {
    if (isConnectivityError(error)) {
      return {
        success: false,
        error: 'No hay conexion a internet para consultar el historial.',
        releases: [],
      };
    }

    return {
      success: false,
      error: error.message || 'No se pudo consultar el historial de actualizaciones.',
      releases: [],
    };
  }
}

async function checkForUpdates({ manual = false } = {}) {
  const autoUpdater = getAutoUpdater();

  if (process.platform !== 'win32') {
    setUpdateState({
      status: 'unsupported-platform',
      error: { message: 'Las actualizaciones automaticas estan habilitadas solo para Windows.' },
    });
    return {
      success: false,
      error: 'Las actualizaciones automaticas estan habilitadas solo para Windows.',
      state: getSerializableState(),
    };
  }

  if (!app.isPackaged) {
    setUpdateState({
      status: 'development-mode',
      error: { message: 'La verificacion de updates solo funciona en la app instalada.' },
    });
    return {
      success: false,
      error: 'La verificacion de updates solo funciona en la app instalada.',
      state: getSerializableState(),
    };
  }

  if (activeCheckPromise) {
    return activeCheckPromise;
  }

  activeCheckPromise = autoUpdater.checkForUpdates()
    .then(() => ({
      success: true,
      state: getSerializableState(),
      manual,
    }))
    .catch((error) => {
      logUpdaterError(error);
      return {
        success: false,
        error: isConnectivityError(error)
          ? 'No hay conexion a internet para revisar actualizaciones.'
          : (error.message || 'No se pudo revisar actualizaciones.'),
        state: getSerializableState(),
        manual,
      };
    })
    .finally(() => {
      activeCheckPromise = null;
    });

  return activeCheckPromise;
}

async function downloadUpdate() {
  const autoUpdater = getAutoUpdater();

  if (process.platform !== 'win32') {
    return {
      success: false,
      error: 'La descarga automatica solo esta habilitada en Windows.',
      state: getSerializableState(),
    };
  }

  if (!app.isPackaged) {
    return {
      success: false,
      error: 'La descarga automatica solo funciona en la app instalada.',
      state: getSerializableState(),
    };
  }

  if (updateState.status === 'downloaded') {
    return {
      success: true,
      state: getSerializableState(),
    };
  }

  if (!updateState.availableUpdate) {
    return {
      success: false,
      error: 'No hay una actualizacion pendiente para descargar.',
      state: getSerializableState(),
    };
  }

  if (activeDownloadPromise) {
    return activeDownloadPromise;
  }

  console.log(`[updater] Iniciando descarga manual de la version ${updateState.availableUpdate.version}.`);

  activeDownloadPromise = autoUpdater.downloadUpdate()
    .then(() => ({
      success: true,
      state: getSerializableState(),
    }))
    .catch((error) => {
      activeDownloadPromise = null;
      logUpdaterError(error);
      return {
        success: false,
        error: isConnectivityError(error)
          ? 'No hay conexion a internet para descargar la actualizacion.'
          : (error.message || 'No se pudo descargar la actualizacion.'),
        state: getSerializableState(),
      };
    });

  return activeDownloadPromise;
}

function installUpdate() {
  const autoUpdater = getAutoUpdater();

  if (updateState.status !== 'downloaded') {
    return {
      success: false,
      error: 'No hay una actualizacion descargada lista para instalar.',
      state: getSerializableState(),
    };
  }

  console.log('[updater] Cerrando la aplicacion para instalar la actualizacion descargada.');
  setImmediate(() => autoUpdater.quitAndInstall(false, true));

  return {
    success: true,
    state: getSerializableState(),
  };
}

function registerIpcHandlers() {
  ipcMain.removeHandler('updates-get-state');
  ipcMain.handle('updates-get-state', async () => getSerializableState());

  ipcMain.removeHandler('updates-check');
  ipcMain.handle('updates-check', async () => checkForUpdates({ manual: true }));

  ipcMain.removeHandler('updates-download');
  ipcMain.handle('updates-download', async () => downloadUpdate());

  ipcMain.removeHandler('updates-install');
  ipcMain.handle('updates-install', async () => installUpdate());

  ipcMain.removeHandler('updates-get-history');
  ipcMain.handle('updates-get-history', async (_event, options = {}) => {
    return getReleaseHistory({ force: !!options.force });
  });
}

function initialize() {
  if (isInitialized) return;

  configureAutoUpdater();
  registerIpcHandlers();
  isInitialized = true;
}

function checkForUpdatesOnStartup() {
  if (startupCheckStarted) return;
  startupCheckStarted = true;
  checkForUpdates({ manual: false }).catch(() => {
    // Errors are already normalized into updateState.
  });
}

module.exports = {
  initialize,
  checkForUpdatesOnStartup,
};
