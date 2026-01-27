const sqlite3 = require('sqlite3').verbose();
const { resolveDbPath } = require('../db/db-path');

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la DB', err.message);
    process.exit(1);
  }
  console.log('Conectado a consultorio.db:', dbPath);
});

// Crear tabla de encuestas (si no existe)
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS crm_encuestas_plantillas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    titulo TEXT NOT NULL,
    link TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME
  )
`;

db.run(createTableQuery, (err) => {
  if (err) {
    console.error('Error creando tabla:', err.message);
    db.close();
    return;
  }

  db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='crm_encuestas_plantillas'`, (err, rows) => {
    if (err) {
      console.error('Error verificando tabla:', err.message);
    } else {
      console.log('Tabla crm_encuestas_plantillas verificada:', rows.length > 0 ? 'OK' : 'NO EXISTE');
    }
    db.close();
  });
});