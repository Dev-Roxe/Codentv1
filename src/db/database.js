const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'consultorio.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Error al conectar a la DB', err);
    console.log('Conectado a SQLite');
});

// Crear tablas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT,
        email TEXT UNIQUE NOT NULL,
        telefono TEXT,
        fecha_nacimiento DATE,
        direccion TEXT,
        password TEXT NOT NULL,
        rol TEXT NOT NULL,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Asegurar columnas adicionales que pueden ser necesarias para el perfil
    // Si la columna no existe, la añadimos. SQLite no soporta DROP/ADD IF NOT EXISTS
    // directamente, por lo que comprobamos con PRAGMA table_info.
    db.all("PRAGMA table_info(usuarios)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla usuarios', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('apellido')) toAdd.push("apellido TEXT");
        if (!cols.includes('telefono')) toAdd.push("telefono TEXT");
        if (!cols.includes('fecha_nacimiento')) toAdd.push("fecha_nacimiento DATE");
        if (!cols.includes('direccion')) toAdd.push("direccion TEXT");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE usuarios ADD COLUMN ${colDef}`);
                console.log('Added column to usuarios:', colDef);
            } catch (e) {
                // No fatal: continuar
                console.warn('Could not add column', colDef, e.message);
            }
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        fecha_nacimiento DATE,
        telefono TEXT,
        email TEXT,
        direccion TEXT,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Asegurar columna `meta` para almacenar campos adicionales en formato JSON
    db.all("PRAGMA table_info(pacientes)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla pacientes', err);
        const cols = (rows || []).map(r => r.name);
        if (!cols.includes('meta')) {
            try {
                db.run(`ALTER TABLE pacientes ADD COLUMN meta TEXT`);
                console.log('Added column to pacientes: meta');
            } catch (e) {
                console.warn('Could not add column meta to pacientes', e && e.message);
            }
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        fecha_hora DATETIME NOT NULL,
        motivo TEXT,
        estado TEXT DEFAULT 'pendiente',
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        monto REAL NOT NULL,
        descripcion TEXT,
        metodo TEXT,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT UNIQUE,
        valor TEXT
    )`);

    // Tabla de Antecedentes Clínicos
    db.run(`CREATE TABLE IF NOT EXISTS antecedentes_clinicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER UNIQUE NOT NULL,
        alergias TEXT,
        enfermedades TEXT,
        medicamentos TEXT,
        tipo_sangre TEXT,
        observaciones TEXT,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
    )`);

    // Tabla de Tratamientos / Historial
    db.run(`CREATE TABLE IF NOT EXISTS tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        diente TEXT,
        procedimiento TEXT NOT NULL,
        costo REAL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        notas TEXT,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
    )`);
});

module.exports = db;
