const { createDbHelpers } = require('./db-helpers');

const GENERAL_SETTINGS_KEY = 'app_settings';

const ALLOWED_CLINIC_KEYS = new Set([
  'clinica_nombre',
  'clinica_titular',
  'clinica_direccion',
  'clinica_telefono',
  'clinica_email',
  'clinica_cedula',
  'clinica_especialidad',
  'clinica_logo',
  'clinica_rfc',
]);

const APP_SETTINGS_DEFAULTS = Object.freeze({
  theme: 'auto',
  fontSize: 'medium',
  compactMode: false,
  notifCitas: true,
  notifEmail: true,
  notifSound: true,
  reminderTime: '15',
  workStart: '08:00',
  workEnd: '18:00',
  lunchStart: '14:00',
  lunchEnd: '15:00',
  defaultDuration: '30',
  workDays: [1, 2, 3, 4, 5],
  appointmentInterval: '10',
  autoConfirm: false,
  weeklyView: false,
  autoSave: true,
  dateFormat: 'dd/mm/yyyy',
  twoFactor: false,
  autoLock: '15',
  currency: 'MXN',
  timeFormat: '24h',
  firstDayWeek: '1',
});

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeText(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

function normalizeBoolean(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }
  return !!value;
}

function normalizeChoice(value, allowedValues, fallback) {
  const normalized = String(value ?? '').trim();
  return allowedValues.has(normalized) ? normalized : fallback;
}

function normalizePositiveIntegerString(value, fallback, { allowNever = false } = {}) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (allowNever && raw === 'never') return 'never';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : fallback;
}

function normalizeTimeString(value, fallback) {
  const raw = String(value ?? '').trim();
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

function normalizeWorkDays(value) {
  if (!Array.isArray(value)) {
    return [...APP_SETTINGS_DEFAULTS.workDays];
  }

  const normalized = value
    .map((day) => parseInt(day, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return [...new Set(normalized)];
}

function normalizeAppSettingsPayload(payload = {}) {
  const normalized = {};

  if (hasOwn(payload, 'theme')) {
    normalized.theme = normalizeChoice(payload.theme, new Set(['light', 'dark', 'auto']), APP_SETTINGS_DEFAULTS.theme);
  }
  if (hasOwn(payload, 'fontSize')) {
    normalized.fontSize = normalizeChoice(payload.fontSize, new Set(['small', 'medium', 'large']), APP_SETTINGS_DEFAULTS.fontSize);
  }
  if (hasOwn(payload, 'compactMode')) {
    normalized.compactMode = normalizeBoolean(payload.compactMode);
  }
  if (hasOwn(payload, 'notifCitas')) {
    normalized.notifCitas = normalizeBoolean(payload.notifCitas);
  }
  if (hasOwn(payload, 'notifEmail')) {
    normalized.notifEmail = normalizeBoolean(payload.notifEmail);
  }
  if (hasOwn(payload, 'notifSound')) {
    normalized.notifSound = normalizeBoolean(payload.notifSound);
  }
  if (hasOwn(payload, 'reminderTime')) {
    normalized.reminderTime = normalizePositiveIntegerString(payload.reminderTime, APP_SETTINGS_DEFAULTS.reminderTime);
  }
  if (hasOwn(payload, 'workStart')) {
    normalized.workStart = normalizeTimeString(payload.workStart, APP_SETTINGS_DEFAULTS.workStart);
  }
  if (hasOwn(payload, 'workEnd')) {
    normalized.workEnd = normalizeTimeString(payload.workEnd, APP_SETTINGS_DEFAULTS.workEnd);
  }
  if (hasOwn(payload, 'lunchStart')) {
    normalized.lunchStart = normalizeTimeString(payload.lunchStart, APP_SETTINGS_DEFAULTS.lunchStart);
  }
  if (hasOwn(payload, 'lunchEnd')) {
    normalized.lunchEnd = normalizeTimeString(payload.lunchEnd, APP_SETTINGS_DEFAULTS.lunchEnd);
  }
  if (hasOwn(payload, 'defaultDuration')) {
    normalized.defaultDuration = normalizePositiveIntegerString(payload.defaultDuration, APP_SETTINGS_DEFAULTS.defaultDuration);
  }
  if (hasOwn(payload, 'workDays')) {
    normalized.workDays = normalizeWorkDays(payload.workDays);
  }
  if (hasOwn(payload, 'appointmentInterval')) {
    normalized.appointmentInterval = normalizePositiveIntegerString(payload.appointmentInterval, APP_SETTINGS_DEFAULTS.appointmentInterval);
  }
  if (hasOwn(payload, 'autoConfirm')) {
    normalized.autoConfirm = normalizeBoolean(payload.autoConfirm);
  }
  if (hasOwn(payload, 'weeklyView')) {
    normalized.weeklyView = normalizeBoolean(payload.weeklyView);
  }
  if (hasOwn(payload, 'autoSave')) {
    normalized.autoSave = normalizeBoolean(payload.autoSave);
  }
  if (hasOwn(payload, 'dateFormat')) {
    normalized.dateFormat = normalizeChoice(
      payload.dateFormat,
      new Set(['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd']),
      APP_SETTINGS_DEFAULTS.dateFormat
    );
  }
  if (hasOwn(payload, 'twoFactor')) {
    normalized.twoFactor = normalizeBoolean(payload.twoFactor);
  }
  if (hasOwn(payload, 'autoLock')) {
    normalized.autoLock = normalizePositiveIntegerString(
      payload.autoLock,
      APP_SETTINGS_DEFAULTS.autoLock,
      { allowNever: true }
    );
  }
  if (hasOwn(payload, 'currency')) {
    normalized.currency = normalizeChoice(payload.currency, new Set(['MXN', 'USD', 'EUR', 'COP']), APP_SETTINGS_DEFAULTS.currency);
  }
  if (hasOwn(payload, 'timeFormat')) {
    normalized.timeFormat = normalizeChoice(payload.timeFormat, new Set(['12h', '24h']), APP_SETTINGS_DEFAULTS.timeFormat);
  }
  if (hasOwn(payload, 'firstDayWeek')) {
    normalized.firstDayWeek = normalizeChoice(payload.firstDayWeek, new Set(['0', '1', '6']), APP_SETTINGS_DEFAULTS.firstDayWeek);
  }

  return normalized;
}

function parseStoredSettings(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return normalizeAppSettingsPayload(parsed);
  } catch (error) {
    return {};
  }
}

async function ensureAdminConfigTable(dbHelpers) {
  await dbHelpers.run(`
    CREATE TABLE IF NOT EXISTS admin_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE,
      valor TEXT
    )
  `);
}

async function getStoredSettingsRow(dbHelpers) {
  return dbHelpers.get(
    'SELECT valor FROM admin_config WHERE clave = ? LIMIT 1',
    [GENERAL_SETTINGS_KEY]
  );
}

async function getAppSettings(db) {
  const dbHelpers = createDbHelpers(db);
  await ensureAdminConfigTable(dbHelpers);
  const row = await getStoredSettingsRow(dbHelpers);
  return parseStoredSettings(row?.valor);
}

async function saveAppSettings(db, payload = {}) {
  const dbHelpers = createDbHelpers(db);
  await ensureAdminConfigTable(dbHelpers);

  const existing = await getAppSettings(db);
  const incoming = normalizeAppSettingsPayload(payload);
  const merged = { ...existing, ...incoming };

  await dbHelpers.run(
    'INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)',
    [GENERAL_SETTINGS_KEY, JSON.stringify(merged)]
  );

  return merged;
}

async function getClinicConfig(db) {
  const dbHelpers = createDbHelpers(db);
  await ensureAdminConfigTable(dbHelpers);
  const rows = await dbHelpers.all(
    `SELECT clave, valor FROM admin_config WHERE clave LIKE 'clinica_%'`
  );
  const result = {};
  (rows || []).forEach((row) => {
    if (ALLOWED_CLINIC_KEYS.has(row.clave)) {
      result[row.clave] = row.valor ?? '';
    }
  });
  return result;
}

async function saveClinicConfig(db, payload = {}) {
  const dbHelpers = createDbHelpers(db);
  await ensureAdminConfigTable(dbHelpers);

  const entries = Object.entries(payload || {}).filter(([key]) =>
    ALLOWED_CLINIC_KEYS.has(key)
  );

  if (!entries.length) {
    return { ok: true, saved: 0, clinicIdentity: await getClinicConfig(db) };
  }

  let saved = 0;
  for (const [clave, rawValue] of entries) {
    const valor = normalizeText(rawValue);
    await dbHelpers.run(
      'INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)',
      [clave, valor ?? '']
    );
    saved += 1;
  }

  return { ok: true, saved, clinicIdentity: await getClinicConfig(db) };
}

async function getSystemConfig(db) {
  const [settings, clinicIdentity] = await Promise.all([
    getAppSettings(db),
    getClinicConfig(db),
  ]);

  return { settings, clinicIdentity };
}

async function saveSystemConfig(db, payload = {}) {
  const dbHelpers = createDbHelpers(db);
  await ensureAdminConfigTable(dbHelpers);

  const settingsPayload = payload?.settings || {};
  const clinicIdentityPayload = payload?.clinicIdentity || {};

  await dbHelpers.run('BEGIN IMMEDIATE TRANSACTION');
  try {
    if (settingsPayload && typeof settingsPayload === 'object' && !Array.isArray(settingsPayload)) {
      const existing = parseStoredSettings((await getStoredSettingsRow(dbHelpers))?.valor);
      const mergedSettings = {
        ...existing,
        ...normalizeAppSettingsPayload(settingsPayload),
      };
      await dbHelpers.run(
        'INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)',
        [GENERAL_SETTINGS_KEY, JSON.stringify(mergedSettings)]
      );
    }

    const clinicEntries = Object.entries(clinicIdentityPayload || {}).filter(([key]) =>
      ALLOWED_CLINIC_KEYS.has(key)
    );

    for (const [clave, rawValue] of clinicEntries) {
      const valor = normalizeText(rawValue);
      await dbHelpers.run(
        'INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)',
        [clave, valor ?? '']
      );
    }

    await dbHelpers.run('COMMIT');
  } catch (error) {
    try {
      await dbHelpers.run('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors and surface the original failure.
    }
    throw error;
  }

  return getSystemConfig(db);
}

module.exports = {
  APP_SETTINGS_DEFAULTS,
  GENERAL_SETTINGS_KEY,
  getAppSettings,
  getClinicConfig,
  getSystemConfig,
  saveAppSettings,
  saveClinicConfig,
  saveSystemConfig,
};
