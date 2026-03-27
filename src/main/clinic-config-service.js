const { createDbHelpers } = require('./db-helpers');

// Claves permitidas para la identidad clínica (whitelist de seguridad)
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

function normalizeText(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

/**
 * Devuelve un objeto { clave: valor } con todos los valores de identidad clínica.
 * @param {import('better-sqlite3').Database} db
 * @returns {Promise<Record<string, string>>}
 */
async function getClinicConfig(db) {
  const dbHelpers = createDbHelpers(db);
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

/**
 * Guarda un conjunto de pares clave/valor de identidad clínica.
 * Solo se persisten las claves de la whitelist.
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, string>} payload
 * @returns {Promise<{ ok: boolean, saved: number }>}
 */
async function saveClinicConfig(db, payload = {}) {
  const dbHelpers = createDbHelpers(db);

  const entries = Object.entries(payload || {}).filter(([key]) =>
    ALLOWED_CLINIC_KEYS.has(key)
  );

  if (!entries.length) {
    return { ok: true, saved: 0 };
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

  return { ok: true, saved };
}

module.exports = { getClinicConfig, saveClinicConfig };
