const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { resolveDbPath } = require('./db-path');

const dbPath = resolveDbPath();
try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (e) {
    console.warn('No se pudo crear el directorio de la DB:', e && e.message);
}
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Error al conectar a la DB', err);
    console.log('Conectado a SQLite');
});

// Habilitar WAL mode para mejorar rendimiento en lecturas concurrentes
db.run(`PRAGMA journal_mode = WAL`, (err) => {
    if (!err) console.log('WAL mode enabled');
});
// synchronous=NORMAL es seguro para apps desktop y ~3x más rápido que FULL
db.run(`PRAGMA synchronous = NORMAL`, (err) => {
    if (!err) console.log('synchronous=NORMAL set');
});

// Crear tablas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT,
        apellidos TEXT,
        email TEXT UNIQUE NOT NULL,
        telefono TEXT,
        fecha_nacimiento DATE,
        direccion TEXT,
        password TEXT NOT NULL,
        rol TEXT NOT NULL,
        foto_perfil TEXT,
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
        if (!cols.includes('apellidos')) toAdd.push("apellidos TEXT");
        if (!cols.includes('telefono')) toAdd.push("telefono TEXT");
        if (!cols.includes('fecha_nacimiento')) toAdd.push("fecha_nacimiento DATE");
        if (!cols.includes('direccion')) toAdd.push("direccion TEXT");
        if (!cols.includes('foto_perfil')) toAdd.push("foto_perfil TEXT");
        // OAuth columns (UNIQUE constraint cannot be added via ALTER TABLE in SQLite)
        if (!cols.includes('google_id')) toAdd.push("google_id TEXT");
        if (!cols.includes('auth_provider')) toAdd.push("auth_provider TEXT DEFAULT 'local'");
        if (!cols.includes('email_verified')) toAdd.push("email_verified INTEGER DEFAULT 0");

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

    // Password reset tokens table
    db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS especialistas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        especialidad TEXT NOT NULL,
        telefono TEXT,
        email TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Asegurar columnas adicionales en `especialistas`
    db.all("PRAGMA table_info(especialistas)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla especialistas', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('telefono')) toAdd.push("telefono TEXT");
        if (!cols.includes('email')) toAdd.push("email TEXT");
        if (!cols.includes('activo')) toAdd.push("activo INTEGER DEFAULT 1");
        if (!cols.includes('fecha_creacion')) toAdd.push("fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE especialistas ADD COLUMN ${colDef}`);
                console.log('Added column to especialistas:', colDef);
            } catch (e) {
                console.warn('Could not add column to especialistas', colDef, e && e.message);
            }
        });
    });
    // Asegurar columnas adicionales en `pacientes`
    db.all("PRAGMA table_info(pacientes)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla pacientes', err);
        const cols = (rows || []).map(r => r.name);

        // Agregar columna created_at si no existe
        if (!cols.includes('created_at')) {
            try {
                db.run(`ALTER TABLE pacientes ADD COLUMN created_at DATETIME`);
                console.log('Added column to pacientes: created_at');

                // Migrar datos de fecha_registro a created_at
                db.run(
                    `UPDATE pacientes SET created_at = COALESCE(fecha_registro, datetime('now')) WHERE created_at IS NULL`,
                    (err) => {
                        if (!err) console.log('Migrated fecha_registro to created_at');
                    }
                );
            } catch (e) {
                console.warn('Could not add column created_at to pacientes', e && e.message);
            }
        }

        // Agregar columnas explicitas nuevas
        const newCols = [
            'nombre_social TEXT',
            'curp TEXT',
            'convenio TEXT',
            'numero_interno TEXT',
            'sexo TEXT',
            'ciudad TEXT',
            'delegacion TEXT',
            'actividad TEXT',
            'profesion TEXT',
            'empleador TEXT',
            'observaciones TEXT',
            'apoderado TEXT'
        ];

        let addedAny = false;
        newCols.forEach(colDef => {
            const colName = colDef.split(' ')[0];
            if (!cols.includes(colName)) {
                try {
                    db.run(`ALTER TABLE pacientes ADD COLUMN ${colDef}`);
                    console.log(`Added column to pacientes: ${colName}`);
                    addedAny = true;
                } catch (e) {
                    console.warn(`Could not add column ${colName} to pacientes`, e && e.message);
                }
            }
        });

        // Solo corremos la migración de meta si agregamos columnas nuevas
        if (cols.includes('meta')) {
            try {
                db.run(`
                    UPDATE pacientes 
                    SET 
                        nombre_social  = COALESCE(nombre_social,  json_extract(meta, '$.nombre_social')),
                        curp           = COALESCE(curp,           json_extract(meta, '$.curp'), json_extract(meta, '$.rfc')),
                        convenio       = COALESCE(convenio,       json_extract(meta, '$.convenio')),
                        numero_interno = COALESCE(numero_interno, json_extract(meta, '$.numero_interno')),
                        sexo           = COALESCE(sexo,           json_extract(meta, '$.sexo')),
                        ciudad         = COALESCE(ciudad,         json_extract(meta, '$.ciudad')),
                        delegacion     = COALESCE(delegacion,     json_extract(meta, '$.delegacion')),
                        actividad      = COALESCE(actividad,      json_extract(meta, '$.actividad')),
                        profesion      = COALESCE(profesion,      json_extract(meta, '$.profesion')),
                        empleador      = COALESCE(empleador,      json_extract(meta, '$.empleador')),
                        observaciones  = COALESCE(observaciones,  json_extract(meta, '$.observaciones')),
                        apoderado      = COALESCE(apoderado,      json_extract(meta, '$.apoderado'))
                    WHERE meta IS NOT NULL AND meta != '{}'
                `, (err) => {
                    if (!err) console.log('Migrated JSON meta fields to explicit columns in pacientes');
                    if (err) console.warn('Could not migrate meta fields:', err.message);
                });
            } catch (e) {
                 console.warn('Could not execute migration update', e && e.message);
            }
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        fecha_hora DATETIME NOT NULL,
        duracion_minutos INTEGER DEFAULT 30,
        motivo TEXT,
        estado TEXT DEFAULT 'pendiente',
        monto REAL DEFAULT 0.0,
        dentista_id INTEGER REFERENCES usuarios(id),
        especialista_id INTEGER REFERENCES especialistas(id),
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
        FOREIGN KEY(especialista_id) REFERENCES especialistas(id)
    )`);

    // Agregar columna dentista_id a citas si no existe
    db.all("PRAGMA table_info(citas)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla citas', err);
        const cols = (rows || []).map(r => r.name);
        if (!cols.includes('dentista_id')) {
            try {
                db.run(`ALTER TABLE citas ADD COLUMN dentista_id INTEGER REFERENCES usuarios(id)`);
                console.log('Added column to citas: dentista_id');
            } catch (e) {
                console.warn('Could not add column dentista_id to citas', e && e.message);
            }
        }
        if (!cols.includes('especialista_id')) {
            try {
                db.run(`ALTER TABLE citas ADD COLUMN especialista_id INTEGER REFERENCES especialistas(id)`);
                console.log('Added column to citas: especialista_id');
            } catch (e) {
                console.warn('Could not add column especialista_id to citas', e && e.message);
            }
        }
        if (!cols.includes('monto')) {
            try {
                db.run(`ALTER TABLE citas ADD COLUMN monto REAL DEFAULT 0.0`);
                console.log('Added column to citas: monto');
            } catch (e) {
                console.warn('Could not add column monto to citas', e && e.message);
            }
        }
        if (!cols.includes('duracion_minutos')) {
            try {
                db.run(`ALTER TABLE citas ADD COLUMN duracion_minutos INTEGER DEFAULT 30`);
                console.log('Added column to citas: duracion_minutos');
            } catch (e) {
                console.warn('Could not add column duracion_minutos to citas', e && e.message);
            }
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        monto REAL NOT NULL,
        descripcion TEXT,
        metodo TEXT,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cajas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_cierre DATETIME,
        saldo_inicial REAL DEFAULT 0.0,
        saldo_final REAL,
        estado TEXT DEFAULT 'abierta',
        notas TEXT,
        arqueo TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS movimientos_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caja_id INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        monto REAL NOT NULL,
        concepto TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        pago_id INTEGER REFERENCES pagos(id),
        paciente_id INTEGER REFERENCES pacientes(id),
        metodo TEXT,
        origen TEXT DEFAULT 'manual',
        FOREIGN KEY(caja_id) REFERENCES cajas(id) ON DELETE CASCADE,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    // Asegurar columnas contables en `movimientos_caja`
    db.all("PRAGMA table_info(movimientos_caja)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla movimientos_caja', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('pago_id')) toAdd.push("pago_id INTEGER REFERENCES pagos(id)");
        if (!cols.includes('paciente_id')) toAdd.push("paciente_id INTEGER REFERENCES pacientes(id)");
        if (!cols.includes('metodo')) toAdd.push("metodo TEXT");
        if (!cols.includes('origen')) toAdd.push("origen TEXT DEFAULT 'manual'");

        toAdd.forEach(colDef => {
            db.run(`ALTER TABLE movimientos_caja ADD COLUMN ${colDef}`, (alterErr) => {
                if (alterErr) {
                    console.warn('Could not add column to movimientos_caja', colDef, alterErr && alterErr.message);
                    return;
                }
                console.log('Added column to movimientos_caja:', colDef);
            });
        });
    });

    // Agregar columna plan_tratamiento_id a pagos si no existe
    db.all("PRAGMA table_info(pagos)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla pagos', err);
        const cols = (rows || []).map(r => r.name);
        if (!cols.includes('plan_tratamiento_id')) {
            try {
                db.run(`ALTER TABLE pagos ADD COLUMN plan_tratamiento_id INTEGER REFERENCES planes_tratamiento(id)`);
                console.log('Added column to pagos: plan_tratamiento_id');
            } catch (e) {
                console.warn('Could not add column plan_tratamiento_id to pagos', e && e.message);
            }
        }
        const pagosToAdd = [];
        if (!cols.includes('tipo')) pagosToAdd.push("tipo TEXT DEFAULT 'pago'");
        if (!cols.includes('estado')) pagosToAdd.push("estado TEXT DEFAULT 'aplicado'");
        if (!cols.includes('usuario_id')) pagosToAdd.push("usuario_id INTEGER REFERENCES usuarios(id)");
        if (!cols.includes('caja_id')) pagosToAdd.push("caja_id INTEGER REFERENCES cajas(id)");
        if (!cols.includes('moneda')) pagosToAdd.push("moneda TEXT DEFAULT 'MXN'");
        if (!cols.includes('referencia_externa')) pagosToAdd.push("referencia_externa TEXT");

        pagosToAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE pagos ADD COLUMN ${colDef}`);
                console.log('Added column to pagos:', colDef);
            } catch (e) {
                console.warn('Could not add column to pagos', colDef, e && e.message);
            }
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS pagos_aplicaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pago_id INTEGER NOT NULL,
        cuota_financiamiento_id INTEGER NOT NULL,
        monto_aplicado REAL NOT NULL,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
        FOREIGN KEY(cuota_financiamiento_id) REFERENCES cuotas_financiamiento(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS auditoria_financiera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        accion TEXT NOT NULL,
        entidad TEXT NOT NULL,
        entidad_id INTEGER,
        payload TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cobranza_recordatorios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        plan_tratamiento_id INTEGER,
        cuota_financiamiento_id INTEGER,
        canal TEXT DEFAULT 'email',
        destinatario TEXT,
        estado TEXT DEFAULT 'pendiente',
        error TEXT,
        fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY(plan_tratamiento_id) REFERENCES planes_tratamiento(id),
        FOREIGN KEY(cuota_financiamiento_id) REFERENCES cuotas_financiamiento(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS facturas_simuladas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT NOT NULL UNIQUE,
        fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
        paciente_id INTEGER NOT NULL,
        plan_tratamiento_id INTEGER,
        pago_id INTEGER,
        tipo TEXT NOT NULL DEFAULT 'comprobante_pago',
        estado TEXT NOT NULL DEFAULT 'emitida',
        moneda TEXT NOT NULL DEFAULT 'MXN',
        subtotal REAL NOT NULL DEFAULT 0.0,
        descuento REAL NOT NULL DEFAULT 0.0,
        impuesto REAL NOT NULL DEFAULT 0.0,
        total REAL NOT NULL DEFAULT 0.0,
        metodo_pago TEXT,
        concepto TEXT NOT NULL,
        observaciones TEXT,
        creado_por INTEGER,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY(plan_tratamiento_id) REFERENCES planes_tratamiento(id),
        FOREIGN KEY(pago_id) REFERENCES pagos(id),
        FOREIGN KEY(creado_por) REFERENCES usuarios(id)
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
        cirugias TEXT,
        antecedentes_familiares TEXT,
        tipo_sangre TEXT,
        observaciones TEXT,
        padecimientos TEXT,
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

    // Tabla de Inventario / Medicamentos
    db.run(`CREATE TABLE IF NOT EXISTS medicamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        stock INTEGER DEFAULT 0,
        precio REAL DEFAULT 0.0,
        fecha_vencimiento DATE,
        lote TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) return;
        db.get("SELECT count(*) as count FROM medicamentos", (err, row) => {
            if (err || !row || row.count !== 0) return;
            const defaults = [
                ['Amoxicilina 500 mg', 'Capsulas', 20, 95.00, '2028-12-31'],
                ['Ibuprofeno 400 mg', 'Tabletas', 30, 70.00, '2028-12-31'],
                ['Paracetamol 500 mg', 'Tabletas', 40, 45.00, '2028-12-31'],
                ['Clindamicina 300 mg', 'Capsulas', 15, 130.00, '2028-12-31'],
                ['Metronidazol 500 mg', 'Tabletas', 25, 85.00, '2028-12-31'],
                ['Lidocaina 2% 1.8 ml', 'Cartucho anestesico', 50, 35.00, '2029-12-31'],
                ['Clorhexidina 0.12%', 'Enjuague bucal 250 ml', 10, 120.00, '2029-12-31'],
                ['Guantes nitrilo M', 'Caja 100 piezas', 12, 180.00, null],
                ['Gasas esteriles 10x10', 'Paquete 100 piezas', 8, 95.00, null],
                ['Agujas odontologicas 27G', 'Caja 100 piezas', 6, 160.00, null]
            ];
            const stmt = db.prepare("INSERT INTO medicamentos (nombre, descripcion, stock, precio, fecha_vencimiento) VALUES (?, ?, ?, ?, ?)");
            defaults.forEach(item => stmt.run(item));
            stmt.finalize();
        });
    });

    // Tabla de Miscelánea / Material del Consultorio
    db.run(`CREATE TABLE IF NOT EXISTS miscelanea (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        categoria TEXT,
        stock INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 5,
        precio REAL DEFAULT 0.0,
        proveedor TEXT,
        fecha_compra DATE,
        notas TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) return;
        db.get("SELECT count(*) as count FROM miscelanea", (err, row) => {
            if (err || !row || row.count !== 0) return;
            const defaults = [
                ['Espejo bucal #5', 'Espejo dental de exploración', 'Instrumental', 20, 5, 45.00, 'Dental Supply Co.', null, 'Uso general'],
                ['Pinzas de curación', 'Pinzas dentales estándar', 'Instrumental', 15, 3, 85.00, 'Dental Supply Co.', null, null],
                ['Explorador dental', 'Sonda de exploración', 'Instrumental', 18, 5, 55.00, 'Dental Supply Co.', null, null],
                ['Algodón en rollo', 'Rollo de algodón estéril', 'Consumibles', 50, 10, 35.00, 'MedSupply', null, null],
                ['Baberos desechables', 'Paquete 100 piezas', 'Consumibles', 25, 5, 120.00, 'MedSupply', null, null],
                ['Vasos desechables', 'Paquete 100 piezas', 'Consumibles', 30, 10, 45.00, 'MedSupply', null, null],
                ['Cubrebocas N95', 'Caja 20 piezas', 'Equipo de Protección', 40, 10, 280.00, 'SafetyFirst', null, null],
                ['Lentes de protección', 'Lentes de seguridad', 'Equipo de Protección', 12, 3, 95.00, 'SafetyFirst', null, null],
                ['Lámpara de fotocurado', 'Lámpara LED para resinas', 'Equipo', 2, 1, 3500.00, 'DentalTech', null, 'Requiere mantenimiento anual'],
                ['Sillón dental - cojín', 'Cojín de repuesto', 'Mobiliario', 3, 1, 850.00, 'FurniturePro', null, null]
            ];
            const stmt = db.prepare("INSERT INTO miscelanea (nombre, descripcion, categoria, stock, stock_minimo, precio, proveedor, fecha_compra, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            defaults.forEach(item => stmt.run(item));
            stmt.finalize();
        });
    });

    // Tabla de Padecimientos Default
    db.run(`CREATE TABLE IF NOT EXISTS padecimientos_default (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL
    )`, (err) => {
        if (!err) {
            // Insertar valores por defecto si la tabla está vacía
            db.get("SELECT count(*) as count FROM padecimientos_default", (err, row) => {
                if (!err && row.count === 0) {
                    const defaults = ['Gingivitis', 'Periodontitis', 'Caries', 'Bruxismo', 'Sensibilidad Dental', 'Halitosis'];
                    const stmt = db.prepare("INSERT INTO padecimientos_default (nombre) VALUES (?)");
                    defaults.forEach(d => stmt.run(d));
                    stmt.finalize();
                }
            });
        }
    });

    // Asegurar columnas en `antecedentes_clinicos`
    db.all("PRAGMA table_info(antecedentes_clinicos)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla antecedentes_clinicos', err);
        const cols = (rows || []).map(r => r.name);
        if (!cols.includes('padecimientos')) {
            try {
                db.run(`ALTER TABLE antecedentes_clinicos ADD COLUMN padecimientos TEXT`);
                console.log('Added column to antecedentes_clinicos: padecimientos');
            } catch (e) {
                console.warn('Could not add column padecimientos to antecedentes_clinicos', e && e.message);
            }
        }
        if (!cols.includes('detalles_medicos')) {
            try {
                db.run(`ALTER TABLE antecedentes_clinicos ADD COLUMN detalles_medicos TEXT`);
                console.log('Added column to antecedentes_clinicos: detalles_medicos');
            } catch (e) {
                console.warn('Could not add column detalles_medicos to antecedentes_clinicos', e && e.message);
            }
        }
        if (!cols.includes('cirugias')) {
            try {
                db.run(`ALTER TABLE antecedentes_clinicos ADD COLUMN cirugias TEXT`);
                console.log('Added column to antecedentes_clinicos: cirugias');
            } catch (e) {
                console.warn('Could not add column cirugias to antecedentes_clinicos', e && e.message);
            }
        }
        if (!cols.includes('antecedentes_familiares')) {
            try {
                db.run(`ALTER TABLE antecedentes_clinicos ADD COLUMN antecedentes_familiares TEXT`);
                console.log('Added column to antecedentes_clinicos: antecedentes_familiares');
            } catch (e) {
                console.warn('Could not add column antecedentes_familiares to antecedentes_clinicos', e && e.message);
            }
        }
    });

    // Tabla de Catálogo de Tratamientos
    db.run(`CREATE TABLE IF NOT EXISTS tratamientos_catalogo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        categoria TEXT,
        costo_base REAL DEFAULT 0.0,
        costo_medicina_estandar REAL DEFAULT 0.0,
        costo_miscelanea_estandar REAL DEFAULT 0.0,
        notas_especiales TEXT,
        duracion_estimada INTEGER DEFAULT 30,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) {
            // Insertar tratamientos por defecto si la tabla está vacía
            db.get("SELECT count(*) as count FROM tratamientos_catalogo", (err, row) => {
                if (!err && row.count === 0) {
                    const defaultTratamientos = [
                        // Odontología General
                        ['Limpieza Dental', 'Profilaxis y eliminación de sarro', 'Odontología General', 500, 30, 1],
                        ['Extracción Simple', 'Extracción de diente sin complicaciones', 'Cirugía', 800, 30, 1],
                        ['Extracción Compleja', 'Extracción quirúrgica de diente', 'Cirugía', 1500, 60, 1],
                        ['Obturación (Resina)', 'Restauración con resina compuesta', 'Odontología General', 600, 45, 1],
                        ['Obturación (Amalgama)', 'Restauración con amalgama', 'Odontología General', 500, 45, 1],

                        // Endodoncia
                        ['Endodoncia Unirradicular', 'Tratamiento de conducto de 1 raíz', 'Endodoncia', 2500, 90, 1],
                        ['Endodoncia Birradicular', 'Tratamiento de conducto de 2 raíces', 'Endodoncia', 3000, 120, 1],
                        ['Endodoncia Multirradicular', 'Tratamiento de conducto de 3+ raíces', 'Endodoncia', 3500, 150, 1],

                        // Periodoncia
                        ['Curetaje Dental', 'Limpieza profunda subgingival', 'Periodoncia', 800, 60, 1],
                        ['Raspado y Alisado Radicular', 'Tratamiento periodontal por cuadrante', 'Periodoncia', 1200, 90, 1],

                        // Prótesis
                        ['Corona de Porcelana', 'Corona cerámica individual', 'Prótesis', 4000, 60, 1],
                        ['Corona Metal-Porcelana', 'Corona metal-cerámica', 'Prótesis', 3500, 60, 1],
                        ['Puente Fijo (3 piezas)', 'Puente dental fijo', 'Prótesis', 10000, 120, 1],
                        ['Prótesis Removible Parcial', 'Dentadura parcial removible', 'Prótesis', 5000, 90, 1],
                        ['Prótesis Total', 'Dentadura completa', 'Prótesis', 8000, 120, 1],

                        // Ortodoncia
                        ['Brackets Metálicos', 'Aparato de ortodoncia metálico', 'Ortodoncia', 15000, 60, 1],
                        ['Brackets Estéticos', 'Aparato de ortodoncia estético', 'Ortodoncia', 20000, 60, 1],
                        ['Ajuste de Ortodoncia', 'Revisión y ajuste mensual', 'Ortodoncia', 500, 30, 1],

                        // Estética
                        ['Blanqueamiento Dental', 'Blanqueamiento profesional', 'Estética', 2500, 90, 1],
                        ['Carilla de Porcelana', 'Carilla estética por diente', 'Estética', 5000, 60, 1],

                        // Diagnóstico
                        ['Radiografía Periapical', 'Radiografía de diente individual', 'Diagnóstico', 150, 10, 1],
                        ['Radiografía Panorámica', 'Radiografía completa de boca', 'Diagnóstico', 400, 15, 1],
                        ['Consulta General', 'Consulta y revisión dental', 'Diagnóstico', 300, 30, 1]
                    ];

                    const stmt = db.prepare(`INSERT INTO tratamientos_catalogo 
                        (nombre, descripcion, categoria, costo_base, duracion_estimada, activo) 
                        VALUES (?, ?, ?, ?, ?, ?)`);
                    defaultTratamientos.forEach(t => stmt.run(t));
                    stmt.finalize();
                    console.log('Inserted default treatments into catalog');
                }
            });
        }
    });

    // Asegurar columnas nuevas en `tratamientos_catalogo` (compatibilidad con BD antiguas)
    db.all("PRAGMA table_info(tratamientos_catalogo)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla tratamientos_catalogo', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('costo_medicina_estandar')) toAdd.push("costo_medicina_estandar REAL DEFAULT 0.0");
        if (!cols.includes('costo_miscelanea_estandar')) toAdd.push("costo_miscelanea_estandar REAL DEFAULT 0.0");
        if (!cols.includes('notas_especiales')) toAdd.push("notas_especiales TEXT");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE tratamientos_catalogo ADD COLUMN ${colDef}`);
                console.log('Added column to tratamientos_catalogo:', colDef);
            } catch (e) {
                console.warn('Could not add column to tratamientos_catalogo', colDef, e && e.message);
            }
        });
    });

    // Asegurar columna `catalogo_id` en `tratamientos`
    db.all("PRAGMA table_info(tratamientos)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla tratamientos', err);
        const cols = (rows || []).map(r => r.name);
        if (!cols.includes('catalogo_id')) {
            try {
                db.run(`ALTER TABLE tratamientos ADD COLUMN catalogo_id INTEGER REFERENCES tratamientos_catalogo(id)`);
                console.log('Added column to tratamientos: catalogo_id');
            } catch (e) {
                console.warn('Could not add column catalogo_id to tratamientos', e && e.message);
            }
        }
    });

    // Tabla de Planes de Tratamiento (Planes que se asignan a pacientes)
    db.run(`CREATE TABLE IF NOT EXISTS planes_tratamiento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paciente_id INTEGER NOT NULL,
      catalogo_id INTEGER NOT NULL,
      especialista_asignado TEXT,
      estado TEXT DEFAULT 'pendiente',
      fecha_inicio DATE,
      fecha_finalizacion DATE,
      costo_total REAL DEFAULT 0.0,
      costo_medicina REAL DEFAULT 0.0,
      costo_miscelanea REAL DEFAULT 0.0,
      notas TEXT,
      diente TEXT,
      caras TEXT,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
      FOREIGN KEY(catalogo_id) REFERENCES tratamientos_catalogo(id)
  )`);

    // Asegurar columnas adicionales en `planes_tratamiento` (compatibilidad con BD antiguas)
    db.all("PRAGMA table_info(planes_tratamiento)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla planes_tratamiento', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('especialista_asignado')) toAdd.push("especialista_asignado TEXT");
        if (!cols.includes('estado')) toAdd.push("estado TEXT DEFAULT 'pendiente'");
        if (!cols.includes('fecha_inicio')) toAdd.push("fecha_inicio DATE");
        if (!cols.includes('fecha_finalizacion')) toAdd.push("fecha_finalizacion DATE");
        if (!cols.includes('costo_total')) toAdd.push("costo_total REAL DEFAULT 0.0");
        if (!cols.includes('costo_medicina')) toAdd.push("costo_medicina REAL DEFAULT 0.0");
        if (!cols.includes('costo_miscelanea')) toAdd.push("costo_miscelanea REAL DEFAULT 0.0");
        if (!cols.includes('notas')) toAdd.push("notas TEXT");
        if (!cols.includes('diente')) toAdd.push("diente TEXT");
        if (!cols.includes('caras')) toAdd.push("caras TEXT");
        if (!cols.includes('fecha_creacion')) toAdd.push("fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP");
        if (!cols.includes('progreso')) toAdd.push("progreso INTEGER DEFAULT 0");
        if (!cols.includes('descuento_tipo')) toAdd.push("descuento_tipo TEXT DEFAULT 'ninguno'");
        if (!cols.includes('descuento_valor')) toAdd.push("descuento_valor REAL DEFAULT 0.0");
        if (!cols.includes('descuento_monto')) toAdd.push("descuento_monto REAL DEFAULT 0.0");
        if (!cols.includes('subtotal_neto')) toAdd.push("subtotal_neto REAL DEFAULT 0.0");
        if (!cols.includes('impuesto_tipo')) toAdd.push("impuesto_tipo TEXT DEFAULT 'ninguno'");
        if (!cols.includes('impuesto_valor')) toAdd.push("impuesto_valor REAL DEFAULT 0.0");
        if (!cols.includes('impuesto_monto')) toAdd.push("impuesto_monto REAL DEFAULT 0.0");
        if (!cols.includes('total_final')) toAdd.push("total_final REAL DEFAULT 0.0");
        if (!cols.includes('version_comercial')) toAdd.push("version_comercial INTEGER DEFAULT 1");
        if (!cols.includes('version_actualizada_en')) toAdd.push("version_actualizada_en DATETIME");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE planes_tratamiento ADD COLUMN ${colDef}`);
                console.log('Added column to planes_tratamiento:', colDef);
            } catch (e) {
                console.warn('Could not add column to planes_tratamiento', colDef, e && e.message);
            }
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS planes_financiamiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_tratamiento_id INTEGER NOT NULL UNIQUE,
        frecuencia TEXT NOT NULL,
        numero_cuotas INTEGER NOT NULL DEFAULT 1,
        anticipo REAL NOT NULL DEFAULT 0.0,
        interes_porcentaje REAL NOT NULL DEFAULT 0.0,
        fecha_primer_vencimiento DATE,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_tratamiento_id) REFERENCES planes_tratamiento(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cuotas_financiamiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_financiamiento_id INTEGER NOT NULL,
        plan_tratamiento_id INTEGER NOT NULL,
        numero INTEGER NOT NULL,
        es_anticipo INTEGER DEFAULT 0,
        fecha_vencimiento DATE NOT NULL,
        monto_programado REAL NOT NULL,
        monto_pagado REAL NOT NULL DEFAULT 0.0,
        estado TEXT DEFAULT 'pendiente',
        fecha_ultimo_pago DATETIME,
        notas TEXT,
        FOREIGN KEY(plan_financiamiento_id) REFERENCES planes_financiamiento(id) ON DELETE CASCADE,
        FOREIGN KEY(plan_tratamiento_id) REFERENCES planes_tratamiento(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS planes_tratamiento_versiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_tratamiento_id INTEGER NOT NULL,
        version_num INTEGER NOT NULL,
        estado_version TEXT NOT NULL DEFAULT 'vigente',
        motivo_cambio TEXT,
        costo_total REAL NOT NULL DEFAULT 0.0,
        descuento_tipo TEXT DEFAULT 'ninguno',
        descuento_valor REAL DEFAULT 0.0,
        descuento_monto REAL DEFAULT 0.0,
        subtotal_neto REAL DEFAULT 0.0,
        impuesto_tipo TEXT DEFAULT 'ninguno',
        impuesto_valor REAL DEFAULT 0.0,
        impuesto_monto REAL DEFAULT 0.0,
        total_final REAL NOT NULL DEFAULT 0.0,
        diente TEXT,
        caras TEXT,
        notas TEXT,
        financiamiento_json TEXT,
        snapshot_json TEXT,
        creado_por INTEGER,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_tratamiento_id) REFERENCES planes_tratamiento(id) ON DELETE CASCADE,
        FOREIGN KEY(creado_por) REFERENCES usuarios(id),
        UNIQUE(plan_tratamiento_id, version_num)
    )`);

    // Tabla de Detalles de Medicinas en Planes de Tratamiento
    db.run(`CREATE TABLE IF NOT EXISTS planes_tratamiento_medicinas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        medicamento_id INTEGER,
        cantidad_usada INTEGER DEFAULT 0,
        costo_medicamento REAL DEFAULT 0.0,
        fecha_aplicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_id) REFERENCES planes_tratamiento(id),
        FOREIGN KEY(medicamento_id) REFERENCES medicamentos(id)
    )`);

    // Tabla de Comunicación entre Especialistas (Odonto-Periodonto)
    db.run(`CREATE TABLE IF NOT EXISTS comunicacion_especialistas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        especialista_origen TEXT NOT NULL,
        especialista_destino TEXT NOT NULL,
        asunto TEXT NOT NULL,
        comentario TEXT,
        tipo_comunicacion TEXT DEFAULT 'coordinacion',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        leido INTEGER DEFAULT 0,
        FOREIGN KEY(plan_id) REFERENCES planes_tratamiento(id)
    )`);

    // Tabla de Historial de Planes de Tratamiento Ejecutados
    db.run(`CREATE TABLE IF NOT EXISTS planes_tratamiento_historial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        paciente_id INTEGER NOT NULL,
        catalogo_id INTEGER NOT NULL,
        especialista_ejecuto TEXT,
        descripcion_procedimiento TEXT,
        costo_base REAL DEFAULT 0.0,
        costo_medicina REAL DEFAULT 0.0,
        costo_miscelanea REAL DEFAULT 0.0,
        costo_total REAL DEFAULT 0.0,
        fecha_ejecucion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_id) REFERENCES planes_tratamiento(id),
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY(catalogo_id) REFERENCES tratamientos_catalogo(id)
    )`);

    // Asegurar columnas en `planes_tratamiento_historial`
    db.serialize(() => {
        db.all("PRAGMA table_info(planes_tratamiento_historial)", (err, rows) => {
            if (err) return console.error('Error leyendo info de tabla planes_tratamiento_historial', err);
            const cols = (rows || []).map(r => r.name);

            if (!cols.includes('especialista_ejecuto')) {
                try {
                    db.run(`ALTER TABLE planes_tratamiento_historial ADD COLUMN especialista_ejecuto TEXT`);
                    console.log('Added column to planes_tratamiento_historial: especialista_ejecuto');
                } catch (e) {
                    console.warn('Could not add column especialista_ejecuto', e && e.message);
                }
            }

            if (!cols.includes('descripcion_procedimiento')) {
                try {
                    db.run(`ALTER TABLE planes_tratamiento_historial ADD COLUMN descripcion_procedimiento TEXT`);
                    console.log('Added column to planes_tratamiento_historial: descripcion_procedimiento');
                } catch (e) {
                    console.warn('Could not add column descripcion_procedimiento', e && e.message);
                }
            }
        });
    });

    // CRM templates (email, reminders, sms)
    db.run(`CREATE TABLE IF NOT EXISTS crm_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL,
        asunto TEXT,
        contenido TEXT NOT NULL,
        imagen TEXT,
        activo INTEGER DEFAULT 1,
        es_predeterminada INTEGER DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME
    )`);

    // CRM campaigns
    db.run(`CREATE TABLE IF NOT EXISTS crm_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        tipo TEXT NOT NULL,
        estado TEXT DEFAULT 'draft',
        audiencia TEXT DEFAULT 'all',
        audiencia_ids TEXT,
        template_id INTEGER,
        asunto TEXT,
        contenido TEXT,
        programada_para DATETIME,
        enviada_en DATETIME,
        enviados INTEGER DEFAULT 0,
        aperturas INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME,
        FOREIGN KEY(template_id) REFERENCES crm_templates(id)
    )`);

    // CRM reminder logs
    db.run(`CREATE TABLE IF NOT EXISTS crm_recordatorios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        cita_id INTEGER,
        template_id INTEGER,
        canal TEXT DEFAULT 'email',
        estado TEXT DEFAULT 'pendiente',
        enviado_en DATETIME,
        error TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY(cita_id) REFERENCES citas(id),
        FOREIGN KEY(template_id) REFERENCES crm_templates(id)
    )`);

    // CRM survey logs
    db.run(`CREATE TABLE IF NOT EXISTS crm_encuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        link TEXT NOT NULL,
        destinatarios INTEGER DEFAULT 0,
        enviado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // CRM survey templates
    db.run(`CREATE TABLE IF NOT EXISTS crm_encuestas_plantillas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        titulo TEXT NOT NULL,
        link TEXT NOT NULL,
        descripcion TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME
    )`);

    // Ensure CRM template columns exist (for older DBs)
    db.all("PRAGMA table_info(crm_templates)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla crm_templates', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('asunto')) toAdd.push("asunto TEXT");
        if (!cols.includes('imagen')) toAdd.push("imagen TEXT");
        if (!cols.includes('activo')) toAdd.push("activo INTEGER DEFAULT 1");
        if (!cols.includes('es_predeterminada')) toAdd.push("es_predeterminada INTEGER DEFAULT 0");
        if (!cols.includes('fecha_actualizacion')) toAdd.push("fecha_actualizacion DATETIME");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE crm_templates ADD COLUMN ${colDef}`);
                console.log('Added column to crm_templates:', colDef);
            } catch (e) {
                console.warn('Could not add column to crm_templates', colDef, e && e.message);
            }
        });
    });

    // Ensure CRM campaigns columns exist (for older DBs)
    db.all("PRAGMA table_info(crm_campaigns)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla crm_campaigns', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('descripcion')) toAdd.push("descripcion TEXT");
        if (!cols.includes('estado')) toAdd.push("estado TEXT DEFAULT 'draft'");
        if (!cols.includes('audiencia')) toAdd.push("audiencia TEXT DEFAULT 'all'");
        if (!cols.includes('audiencia_ids')) toAdd.push("audiencia_ids TEXT");
        if (!cols.includes('template_id')) toAdd.push("template_id INTEGER");
        if (!cols.includes('asunto')) toAdd.push("asunto TEXT");
        if (!cols.includes('contenido')) toAdd.push("contenido TEXT");
        if (!cols.includes('programada_para')) toAdd.push("programada_para DATETIME");
        if (!cols.includes('enviada_en')) toAdd.push("enviada_en DATETIME");
        if (!cols.includes('enviados')) toAdd.push("enviados INTEGER DEFAULT 0");
        if (!cols.includes('aperturas')) toAdd.push("aperturas INTEGER DEFAULT 0");
        if (!cols.includes('clicks')) toAdd.push("clicks INTEGER DEFAULT 0");
        if (!cols.includes('fecha_actualizacion')) toAdd.push("fecha_actualizacion DATETIME");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE crm_campaigns ADD COLUMN ${colDef}`);
                console.log('Added column to crm_campaigns:', colDef);
            } catch (e) {
                console.warn('Could not add column to crm_campaigns', colDef, e && e.message);
            }
        });
    });

    // Ensure CRM reminder columns exist (for older DBs)
    db.all("PRAGMA table_info(crm_recordatorios)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla crm_recordatorios', err);
        const cols = (rows || []).map(r => r.name);
        const toAdd = [];
        if (!cols.includes('cita_id')) toAdd.push("cita_id INTEGER");
        if (!cols.includes('template_id')) toAdd.push("template_id INTEGER");
        if (!cols.includes('canal')) toAdd.push("canal TEXT DEFAULT 'email'");
        if (!cols.includes('estado')) toAdd.push("estado TEXT DEFAULT 'pendiente'");
        if (!cols.includes('enviado_en')) toAdd.push("enviado_en DATETIME");
        if (!cols.includes('error')) toAdd.push("error TEXT");

        toAdd.forEach(colDef => {
            try {
                db.run(`ALTER TABLE crm_recordatorios ADD COLUMN ${colDef}`);
                console.log('Added column to crm_recordatorios:', colDef);
            } catch (e) {
                console.warn('Could not add column to crm_recordatorios', colDef, e && e.message);
            }
        });
    });

    // Índices para CRM
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_templates_tipo ON crm_templates(tipo)`, (err) => {
        if (!err) console.log('Created index: idx_crm_templates_tipo');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_campaigns_estado ON crm_campaigns(estado)`, (err) => {
        if (!err) console.log('Created index: idx_crm_campaigns_estado');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_campaigns_fecha ON crm_campaigns(fecha_creacion)`, (err) => {
        if (!err) console.log('Created index: idx_crm_campaigns_fecha');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_recordatorios_paciente ON crm_recordatorios(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_crm_recordatorios_paciente');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_recordatorios_cita ON crm_recordatorios(cita_id)`, (err) => {
        if (!err) console.log('Created index: idx_crm_recordatorios_cita');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_encuestas_fecha ON crm_encuestas(enviado_en)`, (err) => {
        if (!err) console.log('Created index: idx_crm_encuestas_fecha');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_crm_encuestas_plantillas_activo ON crm_encuestas_plantillas(activo)`, (err) => {
        if (!err) console.log('Created index: idx_crm_encuestas_plantillas_activo');
    });

    // Crear índices para mejorar el rendimiento
    db.run(`CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON pacientes(nombre, apellido)`, (err) => {
        if (!err) console.log('Created index: idx_pacientes_nombre');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pacientes_created ON pacientes(created_at)`, (err) => {
        if (!err) console.log('Created index: idx_pacientes_created');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_hora)`, (err) => {
        if (!err) console.log('Created index: idx_citas_fecha');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_citas_paciente');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_citas_dentista ON citas(dentista_id)`, (err) => {
        if (!err) console.log('Created index: idx_citas_dentista');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_citas_estado_fecha ON citas(estado, fecha_hora)`, (err) => {
        if (!err) console.log('Created index: idx_citas_estado_fecha');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_tratamientos_paciente ON tratamientos(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_tratamientos_paciente');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_antecedentes_paciente ON antecedentes_clinicos(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_antecedentes_paciente');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol)`, (err) => {
        if (!err) console.log('Created index: idx_usuarios_rol');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_cajas_estado ON cajas(estado)`, (err) => {
        if (!err) console.log('Created index: idx_cajas_estado');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_cajas_usuario ON cajas(usuario_id)`, (err) => {
        if (!err) console.log('Created index: idx_cajas_usuario');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_cajas_fecha_apertura ON cajas(fecha_apertura)`, (err) => {
        if (!err) console.log('Created index: idx_cajas_fecha_apertura');
    });

    // Migración segura: mantener una sola caja abierta por usuario
    db.run(
        `UPDATE cajas
         SET estado = 'cerrada',
             fecha_cierre = COALESCE(fecha_cierre, CURRENT_TIMESTAMP),
             saldo_final = COALESCE(
                 saldo_final,
                 ROUND(
                     COALESCE(saldo_inicial, 0) + (
                         SELECT COALESCE(SUM(CASE WHEN m.tipo = 'egreso' THEN -m.monto ELSE m.monto END), 0)
                         FROM movimientos_caja m
                         WHERE m.caja_id = cajas.id
                     ),
                     2
                 )
             ),
             arqueo = COALESCE(arqueo, '{"auto_cierre_migracion":"caja_unica_por_usuario"}')
         WHERE estado = 'abierta'
           AND usuario_id IS NOT NULL
           AND id NOT IN (
               SELECT c_keep.id
               FROM cajas c_keep
               WHERE c_keep.estado = 'abierta'
                 AND c_keep.id = (
                     SELECT c_latest.id
                     FROM cajas c_latest
                     WHERE c_latest.usuario_id = c_keep.usuario_id
                       AND c_latest.estado = 'abierta'
                     ORDER BY datetime(c_latest.fecha_apertura) DESC, c_latest.id DESC
                     LIMIT 1
                 )
           )`,
        function (err) {
            if (err) {
                console.warn('Could not normalize open cajas per user', err && err.message);
                return;
            }
            if (this && this.changes > 0) {
                console.log('Normalized duplicate open cajas:', this.changes);
            }
        }
    );

    db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_cajas_open_user_unique
         ON cajas(usuario_id)
         WHERE estado = 'abierta'`,
        (err) => {
            if (!err) {
                console.log('Created index: idx_cajas_open_user_unique');
            } else {
                console.warn('Could not create unique open-caja index', err && err.message);
            }
        }
    );

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_caja ON movimientos_caja(caja_id)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_caja');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_fecha ON movimientos_caja(fecha)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_fecha');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_filtros ON movimientos_caja(fecha, caja_id, tipo, usuario_id)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_filtros');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_pago ON movimientos_caja(pago_id)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_pago');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_paciente ON movimientos_caja(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_paciente');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pagos_paciente_fecha ON pagos(paciente_id, fecha)`, (err) => {
        if (!err) console.log('Created index: idx_pagos_paciente_fecha');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pagos_plan_fecha ON pagos(plan_tratamiento_id, fecha)`, (err) => {
        if (!err) console.log('Created index: idx_pagos_plan_fecha');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pagos_tipo_estado ON pagos(tipo, estado)`, (err) => {
        if (!err) console.log('Created index: idx_pagos_tipo_estado');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pagos_caja ON pagos(caja_id)`, (err) => {
        if (!err) console.log('Created index: idx_pagos_caja');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_paciente_estado ON planes_tratamiento(paciente_id, estado)`, (err) => {
        if (!err) console.log('Created index: idx_planes_tratamiento_paciente_estado');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_planes_financiamiento_plan ON planes_financiamiento(plan_tratamiento_id)`, (err) => {
        if (!err) console.log('Created index: idx_planes_financiamiento_plan');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_cuotas_financiamiento_plan ON cuotas_financiamiento(plan_tratamiento_id, estado)`, (err) => {
        if (!err) console.log('Created index: idx_cuotas_financiamiento_plan');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_cuotas_financiamiento_vencimiento ON cuotas_financiamiento(fecha_vencimiento, estado)`, (err) => {
        if (!err) console.log('Created index: idx_cuotas_financiamiento_vencimiento');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_versiones_plan_version ON planes_tratamiento_versiones(plan_tratamiento_id, version_num)`, (err) => {
        if (!err) console.log('Created index: idx_planes_tratamiento_versiones_plan_version');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_versiones_estado ON planes_tratamiento_versiones(estado_version)`, (err) => {
        if (!err) console.log('Created index: idx_planes_tratamiento_versiones_estado');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pagos_aplicaciones_pago ON pagos_aplicaciones(pago_id)`, (err) => {
        if (!err) console.log('Created index: idx_pagos_aplicaciones_pago');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_pagos_aplicaciones_cuota ON pagos_aplicaciones(cuota_financiamiento_id)`, (err) => {
        if (!err) console.log('Created index: idx_pagos_aplicaciones_cuota');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_auditoria_financiera_fecha ON auditoria_financiera(fecha)`, (err) => {
        if (!err) console.log('Created index: idx_auditoria_financiera_fecha');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_cobranza_recordatorios_paciente ON cobranza_recordatorios(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_cobranza_recordatorios_paciente');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_facturas_simuladas_folio ON facturas_simuladas(folio)`, (err) => {
        if (!err) console.log('Created index: idx_facturas_simuladas_folio');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_facturas_simuladas_plan ON facturas_simuladas(plan_tratamiento_id)`, (err) => {
        if (!err) console.log('Created index: idx_facturas_simuladas_plan');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_facturas_simuladas_pago ON facturas_simuladas(pago_id)`, (err) => {
        if (!err) console.log('Created index: idx_facturas_simuladas_pago');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_facturas_simuladas_paciente_fecha ON facturas_simuladas(paciente_id, fecha_emision)`, (err) => {
        if (!err) console.log('Created index: idx_facturas_simuladas_paciente_fecha');
    });

    // Tabla de Periodontograma
    db.run(`CREATE TABLE IF NOT EXISTS periodontograma (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER UNIQUE NOT NULL,
        datos TEXT NOT NULL,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
    )`, (err) => {
        if (!err) console.log('Created table: periodontograma');
    });

    // Índice para periodontograma
    db.run(`CREATE INDEX IF NOT EXISTS idx_periodontograma_paciente ON periodontograma(paciente_id)`, (err) => {
        if (!err) console.log('Created index: idx_periodontograma_paciente');
    });

    // ⚠️ SECURITY FIX S8: Tabla de auditoría de acceso a expedientes clínicos
    // Registra QUIÉN accedió a QUÉ expediente, CUÁNDO y QUÉ acción realizó.
    // Requerido por NOM-004-SSA3 y Ley Federal de Protección de Datos Personales.
    db.run(`CREATE TABLE IF NOT EXISTS auditoria_clinica(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER,
                    paciente_id INTEGER,
                    accion TEXT NOT NULL,
                    modulo TEXT NOT NULL,
                    detalle TEXT,
                    ip_local TEXT,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
                    FOREIGN KEY(paciente_id) REFERENCES pacientes(id)
                )`, (err) => {
        if (!err) console.log('Created table: auditoria_clinica');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_auditoria_clinica_paciente ON auditoria_clinica(paciente_id, fecha)`, (err) => {
        if (!err) console.log('Created index: idx_auditoria_clinica_paciente');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_auditoria_clinica_usuario ON auditoria_clinica(usuario_id, fecha)`, (err) => {
        if (!err) console.log('Created index: idx_auditoria_clinica_usuario');
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_auditoria_clinica_fecha ON auditoria_clinica(fecha)`, (err) => {
        if (!err) console.log('Created index: idx_auditoria_clinica_fecha');
    });

    // Habilitar foreign keys
    db.run(`PRAGMA foreign_keys = ON`, (err) => {
        if (!err) console.log('Foreign keys enabled');
    });

    // ─── Índices de rendimiento para odontograma y módulos clínicos ───

    // Diagnósticos del odontograma: filtra por paciente + tipo de registro
    db.run(`CREATE INDEX IF NOT EXISTS idx_tratamientos_paciente_tipo
        ON tratamientos(paciente_id, registro_tipo)`, (err) => {
        if (!err) console.log('Created index: idx_tratamientos_paciente_tipo');
    });

    // Diagnósticos del odontograma: lookup por diente
    db.run(`CREATE INDEX IF NOT EXISTS idx_tratamientos_paciente_diente
        ON tratamientos(paciente_id, diente)`, (err) => {
        if (!err) console.log('Created index: idx_tratamientos_paciente_diente');
    });

    // Radiografías: lookup por paciente (si la tabla ya existe)
    db.run(`CREATE INDEX IF NOT EXISTS idx_radiografias_paciente
        ON radiografias_paciente(paciente_id)`, (err) => {
        // Ignorar si la tabla aún no existe
    });

    // Periodontograma: lookup por fecha de actualización
    db.run(`CREATE INDEX IF NOT EXISTS idx_periodontograma_updated
        ON periodontograma(paciente_id, fecha_actualizacion)`, (err) => {
        if (!err) console.log('Created index: idx_periodontograma_updated');
    });
});


/**
 * S8 — Helper: Registra un acceso/modificación a expediente clínico.
 * Llamar desde main.js antes de responder a consultas sobre historia clínica.
 * @param {object} opts - { usuario_id, paciente_id, accion, modulo, detalle }
 */
function logClinicalAccess({ usuario_id, paciente_id, accion, modulo, detalle = null }) {
    db.run(
        `INSERT INTO auditoria_clinica(usuario_id, paciente_id, accion, modulo, detalle) VALUES(?, ?, ?, ?, ?)`,
        [usuario_id || null, paciente_id || null, accion, modulo, detalle || null],
        (err) => {
            if (err) console.warn('[AUDIT] Error al registrar acceso clínico:', err.message);
        }
    );
}

module.exports = db;
module.exports.logClinicalAccess = logClinicalAccess;
