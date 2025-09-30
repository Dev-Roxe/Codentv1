const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'db', 'consultorio.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error abriendo la DB:', err.message);
    process.exit(1);
  }
});

db.all('SELECT id, nombre, email, password, rol, fecha_creacion FROM usuarios', (err, rows) => {
  if (err) {
    console.error('Error consultando usuarios:', err.message);
    db.close();
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('No hay usuarios en la tabla usuarios.');
  } else {
    console.log('Usuarios encontrados:');
    rows.forEach(r => {
      console.log(`- id=${r.id} nombre=${r.nombre} email=${r.email} rol=${r.rol} passwordHash=${r.password}`);
    });
  }
  db.close();
});
