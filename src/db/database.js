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

    // Asegurar columnas adicionales en `pacientes`
    db.all("PRAGMA table_info(pacientes)", (err, rows) => {
        if (err) return console.error('Error leyendo info de tabla pacientes', err);
        const cols = (rows || []).map(r => r.name);

        // Agregar columna meta si no existe
        if (!cols.includes('meta')) {
            try {
                db.run(`ALTER TABLE pacientes ADD COLUMN meta TEXT`);
                console.log('Added column to pacientes: meta');
            } catch (e) {
                console.warn('Could not add column meta to pacientes', e && e.message);
            }
        }

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
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
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
        FOREIGN KEY(caja_id) REFERENCES cajas(id) ON DELETE CASCADE,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

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
    });


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
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY(catalogo_id) REFERENCES tratamientos_catalogo(id)
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

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_caja ON movimientos_caja(caja_id)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_caja');
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_movimientos_caja_fecha ON movimientos_caja(fecha)`, (err) => {
        if (!err) console.log('Created index: idx_movimientos_caja_fecha');
    });

    // Habilitar foreign keys
    db.run(`PRAGMA foreign_keys = ON`, (err) => {
        if (!err) console.log('Foreign keys enabled');
    });
});

module.exports = db;
