/**
 * Script para insertar datos de prueba en la BD
 * Ejecutar: node scripts/seed-patients.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../src/db/consultorio.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error conectando a BD:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a BD');
});

const patientsData = [
  { nombre: 'María González', apellido: 'López', email: 'maria@gmail.com', telefono: '5551234567' },
  { nombre: 'Juan', apellido: 'Pérez', email: 'juan@gmail.com', telefono: '5552345678' },
  { nombre: 'Carlos', apellido: 'Ruiz', email: 'carlos@gmail.com', telefono: '5553456789' },
  { nombre: 'Ana', apellido: 'Martínez', email: 'ana@gmail.com', telefono: '5554567890' },
  { nombre: 'Luis', apellido: 'Hernández', email: 'luis@gmail.com', telefono: '5555678901' },
  { nombre: 'Sofia', apellido: 'Rodríguez', email: 'sofia@gmail.com', telefono: '5556789012' },
  { nombre: 'Roberto', apellido: 'Díaz', email: 'roberto@gmail.com', telefono: '5557890123' },
  { nombre: 'Isabel', apellido: 'López', email: 'isabel@gmail.com', telefono: '5558901234' },
];

db.serialize(() => {
  // Limpiar pacientes previos (opcional)
  db.run(`DELETE FROM pacientes`);

  // Insertar nuevos pacientes
  let inserted = 0;
  patientsData.forEach((patient) => {
    db.run(
      `INSERT INTO pacientes (nombre, apellido, email, telefono) VALUES (?, ?, ?, ?)`,
      [patient.nombre, patient.apellido, patient.email, patient.telefono],
      function (err) {
        if (err) {
          console.error(`❌ Error insertando ${patient.nombre}:`, err.message);
        } else {
          inserted++;
          console.log(`✓ Insertado: ${patient.nombre} ${patient.apellido} (${patient.email})`);
        }
      }
    );
  });

  setTimeout(() => {
    db.all(`SELECT COUNT(*) as total FROM pacientes`, (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log(`\n✅ Total de pacientes en BD: ${rows[0].total}`);
      }
      db.close();
    });
  }, 500);
});
