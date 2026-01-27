const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { resolveDbPath } = require('../src/db/db-path');

const dbPath = resolveDbPath();
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Error al conectar a la DB', err.message);
  console.log('Conectado a SQLite:', dbPath);
});

const patients = [
  { nombre: 'Ana', apellido: 'Gomez', telefono: '555-1234', email: 'ana@example.com' },
  { nombre: 'Luis', apellido: 'Perez', telefono: '555-5678', email: 'luis@example.com' },
  { nombre: 'Maria', apellido: 'Lopez', telefono: '555-9012', email: 'maria@example.com' }
];

const stmt = db.prepare('INSERT INTO pacientes (nombre, apellido, telefono, email) VALUES (?, ?, ?, ?)');
patients.forEach(p => stmt.run(p.nombre, p.apellido, p.telefono, p.email));
stmt.finalize(() => {
  console.log('Pacientes de prueba insertados.');
  db.close();
});