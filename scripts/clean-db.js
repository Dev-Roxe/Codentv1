const fs = require('fs');
const path = require('path');

let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  console.warn('[clean-db] sqlite3 no disponible, se eliminara el archivo DB directamente.');
}

const dbPath = path.join(__dirname, '..', 'src', 'db', 'consultorio.db');

if (!fs.existsSync(dbPath)) {
  console.log('[clean-db] No se encontro consultorio.db, nada que limpiar.');
  process.exit(0);
}

if (!sqlite3) {
  try {
    fs.unlinkSync(dbPath);
    console.log('[clean-db] DB eliminada para limpieza completa.');
    process.exit(0);
  } catch (err) {
    console.error('[clean-db] No se pudo eliminar la DB:', err.message);
    process.exit(1);
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[clean-db] Error al abrir la DB:', err.message);
    process.exit(1);
  }
});

const tablesToClear = [
  'movimientos_caja',
  'cajas',
  'pagos',
  'citas',
  'planes_tratamiento_medicinas',
  'planes_tratamiento_historial',
  'planes_tratamiento',
  'tratamientos',
  'antecedentes_clinicos',
  'comunicacion_especialistas',
  'crm_recordatorios',
  'crm_campaigns',
  'crm_encuestas',
  'pacientes',
  'usuarios'
];

const resetSequences = [
  'movimientos_caja',
  'cajas',
  'pagos',
  'citas',
  'planes_tratamiento_medicinas',
  'planes_tratamiento_historial',
  'planes_tratamiento',
  'tratamientos',
  'antecedentes_clinicos',
  'comunicacion_especialistas',
  'crm_recordatorios',
  'crm_campaigns',
  'crm_encuestas',
  'pacientes',
  'usuarios'
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

(async () => {
  try {
    await run('PRAGMA foreign_keys = OFF');
    for (const table of tablesToClear) {
      await run(`DELETE FROM ${table}`);
    }
    const seqList = resetSequences.map(() => '?').join(',');
    await run(`DELETE FROM sqlite_sequence WHERE name IN (${seqList})`, resetSequences);
    await run('PRAGMA foreign_keys = ON');
    console.log('[clean-db] Datos de usuarios y pacientes eliminados.');
  } catch (err) {
    console.error('[clean-db] Error limpiando la DB:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();