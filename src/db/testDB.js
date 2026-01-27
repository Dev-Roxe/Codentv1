const sqlite3 = require('sqlite3').verbose();
const { resolveDbPath } = require('../src/db/db-path');

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Error al conectar a la DB', err.message);
  console.log('Conectado a SQLite:', dbPath);
});

db.each("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
  if (err) {
    console.error('Error consultando tablas:', err.message);
  } else {
    console.log(row.name);
  }
}, () => db.close());