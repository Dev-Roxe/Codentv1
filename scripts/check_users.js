const sqlite3 = require('sqlite3').verbose();
const { resolveDbPath } = require('../src/db/db-path');

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Error al conectar a la DB', err.message);
  console.log('Conectado a SQLite:', dbPath);
});

db.all('SELECT id, nombre, email, password, rol, fecha_creacion FROM usuarios', (err, rows) => {
  if (err) {
    console.error('Error consultando usuarios:', err.message);
  } else if (!rows || rows.length === 0) {
    console.log('No hay usuarios en la tabla usuarios.');
  } else {
    console.log('Usuarios encontrados:');
    rows.forEach((row) => {
      console.log(`- id=${row.id} nombre=${row.nombre} email=${row.email} rol=${row.rol} passwordHash=${row.password}`);
    });
  }
  db.close();
});