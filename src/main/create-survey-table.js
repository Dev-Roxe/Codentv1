const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'consultorio.db');
console.log('Conectando a:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error conectando a la BD:', err);
        process.exit(1);
    }
    console.log('Conectado a consultorio.db');
});

db.serialize(() => {
    // Crear tabla
    db.run(`CREATE TABLE IF NOT EXISTS crm_encuestas_plantillas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    titulo TEXT NOT NULL,
    link TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME
  )`, (err) => {
        if (err) {
            console.error('Error creando tabla:', err);
        } else {
            console.log('✓ Tabla crm_encuestas_plantillas creada exitosamente');
        }
    });

    // Crear índice
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_encuestas_plantillas_activo ON crm_encuestas_plantillas(activo)`, (err) => {
        if (err) {
            console.error('Error creando índice:', err);
        } else {
            console.log('✓ Índice creado exitosamente');
        }
    });

    // Verificar que la tabla existe
    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='crm_encuestas_plantillas'`, (err, rows) => {
        if (err) {
            console.error('Error verificando tabla:', err);
        } else if (rows.length > 0) {
            console.log('✓ Tabla verificada en la base de datos');
        } else {
            console.error('✗ Tabla no encontrada después de crearla');
        }
        db.close();
    });
});
