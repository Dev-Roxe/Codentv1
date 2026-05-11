const { createDbHelpers } = require('./db-helpers');


function normalizeId(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizePadecimientos(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const result = [];
    value.forEach((item) => {
        const nombre = String(item || '').trim();
        if (!nombre) return;
        const key = nombre.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(nombre);
    });
    return result;
}

function normalizeMoney(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Costo invalido');
    }
    return Math.round(amount * 100) / 100;
}

function normalizeRecordType(value) {
    const normalized = String(value || 'tratamiento').trim().toLowerCase();
    if (!normalized) return 'tratamiento';
    return normalized.slice(0, 50);
}

async function getTableColumns(dbHelpers, tableName) {
    const rows = await dbHelpers.all(`PRAGMA table_info(${tableName})`);
    return new Set((rows || []).map((row) => row.name));
}

async function ensureRadiographsSchema(dbHelpers) {
    if (dbHelpers.db._radiographsSchemaEnsured) return dbHelpers.db._radiographsCols; // Already ensured in this session

    await dbHelpers.run(`CREATE TABLE IF NOT EXISTS radiografias_paciente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        tipo_estudio TEXT,
        fecha_estudio DATE,
        notas TEXT,
        imagen_data TEXT NOT NULL,
        mime_type TEXT,
        nombre_archivo TEXT,
        tamano_bytes INTEGER DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
    )`);

    const columns = await getTableColumns(dbHelpers, 'radiografias_paciente');
    const missingColumns = [
        ['paciente_id', 'ALTER TABLE radiografias_paciente ADD COLUMN paciente_id INTEGER'],
        ['titulo', 'ALTER TABLE radiografias_paciente ADD COLUMN titulo TEXT'],
        ['tipo_estudio', 'ALTER TABLE radiografias_paciente ADD COLUMN tipo_estudio TEXT'],
        ['fecha_estudio', 'ALTER TABLE radiografias_paciente ADD COLUMN fecha_estudio DATE'],
        ['notas', 'ALTER TABLE radiografias_paciente ADD COLUMN notas TEXT'],
        ['imagen_data', 'ALTER TABLE radiografias_paciente ADD COLUMN imagen_data TEXT'],
        ['mime_type', 'ALTER TABLE radiografias_paciente ADD COLUMN mime_type TEXT'],
        ['nombre_archivo', 'ALTER TABLE radiografias_paciente ADD COLUMN nombre_archivo TEXT'],
        ['tamano_bytes', 'ALTER TABLE radiografias_paciente ADD COLUMN tamano_bytes INTEGER DEFAULT 0'],
        ['fecha_creacion', 'ALTER TABLE radiografias_paciente ADD COLUMN fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP'],
        ['fecha_actualizacion', 'ALTER TABLE radiografias_paciente ADD COLUMN fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP'],
    ];

    for (const [columnName, sql] of missingColumns) {
        if (columns.has(columnName)) continue;
        await dbHelpers.run(sql);
        columns.add(columnName);
    }

    dbHelpers.db._radiographsCols = columns;
    dbHelpers.db._radiographsSchemaEnsured = true;
    return columns;
}

async function ensurePeriodontogramSchema(dbHelpers) {
    if (dbHelpers.db._periodontogramSchemaEnsured) return dbHelpers.db._periodontogramCols; // Already ensured in this session

    await dbHelpers.run(`CREATE TABLE IF NOT EXISTS periodontograma(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        datos TEXT,
        fecha TEXT,
        UNIQUE(paciente_id)
    )`);

    const columns = await getTableColumns(dbHelpers, 'periodontograma');
    const missingColumns = [
        ['fecha', 'ALTER TABLE periodontograma ADD COLUMN fecha TEXT'],
        ['dientes_imagenes', 'ALTER TABLE periodontograma ADD COLUMN dientes_imagenes TEXT'],
        ['dientes_bloqueados', 'ALTER TABLE periodontograma ADD COLUMN dientes_bloqueados INTEGER DEFAULT 0'],
        ['fecha_creacion', 'ALTER TABLE periodontograma ADD COLUMN fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP'],
        ['fecha_actualizacion', 'ALTER TABLE periodontograma ADD COLUMN fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP'],
    ];

    for (const [columnName, sql] of missingColumns) {
        if (columns.has(columnName)) continue;
        await dbHelpers.run(sql);
        columns.add(columnName);
    }

    dbHelpers.db._periodontogramCols = columns;
    dbHelpers.db._periodontogramSchemaEnsured = true;
    return columns;
}

async function getAntecedentes(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(patientId);
    if (!id) return null;
    return dbHelpers.get('SELECT * FROM antecedentes_clinicos WHERE paciente_id = ?', [id]);
}

async function saveAntecedentes(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = normalizeId(payload.paciente_id);
    if (!patientId) throw new Error('Paciente invalido');

    const data = {
        alergias: normalizeText(payload.alergias) || '',
        enfermedades: normalizeText(payload.enfermedades) || '',
        medicamentos: normalizeText(payload.medicamentos) || '',
        cirugias: normalizeText(payload.cirugias) || '',
        antecedentes_familiares: normalizeText(payload.antecedentes_familiares) || '',
        tipo_sangre: normalizeText(payload.tipo_sangre) || '',
        observaciones: normalizeText(payload.observaciones) || '',
        padecimientos: JSON.stringify(normalizePadecimientos(payload.padecimientos)),
        detalles_medicos: typeof payload.detalles_medicos === 'object' ? JSON.stringify(payload.detalles_medicos) : (normalizeText(payload.detalles_medicos) || '{}'),
    };

    const existing = await getAntecedentes(db, patientId);
    if (existing?.id) {
        await dbHelpers.run(
            `UPDATE antecedentes_clinicos
             SET alergias = ?, enfermedades = ?, medicamentos = ?, cirugias = ?, antecedentes_familiares = ?, tipo_sangre = ?, observaciones = ?, padecimientos = ?, detalles_medicos = ?
             WHERE paciente_id = ?`,
            [
                data.alergias,
                data.enfermedades,
                data.medicamentos,
                data.cirugias,
                data.antecedentes_familiares,
                data.tipo_sangre,
                data.observaciones,
                data.padecimientos,
                data.detalles_medicos,
                patientId,
            ]
        );
    } else {
        await dbHelpers.run(
            `INSERT INTO antecedentes_clinicos
             (paciente_id, alergias, enfermedades, medicamentos, cirugias, antecedentes_familiares, tipo_sangre, observaciones, padecimientos, detalles_medicos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                patientId,
                data.alergias,
                data.enfermedades,
                data.medicamentos,
                data.cirugias,
                data.antecedentes_familiares,
                data.tipo_sangre,
                data.observaciones,
                data.padecimientos,
                data.detalles_medicos,
            ]
        );
    }

    return getAntecedentes(db, patientId);
}

async function listDefaultConditions(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all('SELECT * FROM padecimientos_default ORDER BY nombre COLLATE NOCASE ASC');
}

async function addDefaultCondition(db, name) {
    const dbHelpers = createDbHelpers(db);
    const normalizedName = normalizeText(name);
    if (!normalizedName) throw new Error('Debes indicar un padecimiento');

    const duplicate = await dbHelpers.get(
        "SELECT id, nombre FROM padecimientos_default WHERE lower(trim(COALESCE(nombre, ''))) = ? LIMIT 1",
        [normalizedName.toLowerCase()]
    );
    if (duplicate?.id) {
        const error = new Error('Ese padecimiento ya existe');
        error.code = 'DUPLICATE_CONDITION';
        throw error;
    }

    const insert = await dbHelpers.run(
        'INSERT INTO padecimientos_default (nombre) VALUES (?)',
        [normalizedName]
    );
    return dbHelpers.get('SELECT * FROM padecimientos_default WHERE id = ?', [insert.lastID]);
}

async function removeDefaultCondition(db, conditionId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(conditionId);
    if (!id) throw new Error('Padecimiento invalido');
    const result = await dbHelpers.run('DELETE FROM padecimientos_default WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

async function listRadiographs(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(patientId);
    if (!id) return [];
    await ensureRadiographsSchema(dbHelpers);

    return dbHelpers.all(
        `SELECT id, paciente_id, titulo, tipo_estudio, fecha_estudio, notas, imagen_data, mime_type, nombre_archivo, tamano_bytes,
                fecha_creacion, fecha_actualizacion
         FROM radiografias_paciente
         WHERE paciente_id = ?
         ORDER BY datetime(COALESCE(NULLIF(fecha_estudio, ''), fecha_actualizacion, fecha_creacion)) DESC, id DESC`,
        [id]
    );
}

async function saveRadiograph(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureRadiographsSchema(dbHelpers);

    const radiograph = {
        id: normalizeId(payload.id),
        paciente_id: normalizeId(payload.paciente_id),
        titulo: normalizeText(payload.titulo),
        tipo_estudio: normalizeText(payload.tipo_estudio),
        fecha_estudio: normalizeText(payload.fecha_estudio),
        notas: normalizeText(payload.notas) || '',
        imagen_data: normalizeText(payload.imagen_data),
        mime_type: normalizeText(payload.mime_type),
        nombre_archivo: normalizeText(payload.nombre_archivo),
        tamano_bytes: Number(payload.tamano_bytes || 0),
    };

    if (!radiograph.paciente_id) throw new Error('Paciente invalido');
    if (!radiograph.titulo) throw new Error('Titulo requerido');
    if (!radiograph.imagen_data) throw new Error('Imagen requerida');
    if (!Number.isFinite(radiograph.tamano_bytes) || radiograph.tamano_bytes < 0) {
        radiograph.tamano_bytes = 0;
    }

    if (radiograph.id) {
        await dbHelpers.run(
            `UPDATE radiografias_paciente
             SET titulo = ?, tipo_estudio = ?, fecha_estudio = ?, notas = ?, imagen_data = ?, mime_type = ?, nombre_archivo = ?, tamano_bytes = ?, fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = ? AND paciente_id = ?`,
            [
                radiograph.titulo,
                radiograph.tipo_estudio,
                radiograph.fecha_estudio,
                radiograph.notas,
                radiograph.imagen_data,
                radiograph.mime_type,
                radiograph.nombre_archivo,
                radiograph.tamano_bytes,
                radiograph.id,
                radiograph.paciente_id,
            ]
        );
        return dbHelpers.get(
            'SELECT * FROM radiografias_paciente WHERE id = ? AND paciente_id = ?',
            [radiograph.id, radiograph.paciente_id]
        );
    }

    const insert = await dbHelpers.run(
        `INSERT INTO radiografias_paciente
         (paciente_id, titulo, tipo_estudio, fecha_estudio, notas, imagen_data, mime_type, nombre_archivo, tamano_bytes, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            radiograph.paciente_id,
            radiograph.titulo,
            radiograph.tipo_estudio,
            radiograph.fecha_estudio,
            radiograph.notas,
            radiograph.imagen_data,
            radiograph.mime_type,
            radiograph.nombre_archivo,
            radiograph.tamano_bytes,
        ]
    );
    return dbHelpers.get('SELECT * FROM radiografias_paciente WHERE id = ?', [insert.lastID]);
}

async function removeRadiograph(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureRadiographsSchema(dbHelpers);

    const id = normalizeId(payload.id);
    const patientId = normalizeId(payload.paciente_id);
    if (!id || !patientId) throw new Error('Radiografia invalida');

    const result = await dbHelpers.run(
        'DELETE FROM radiografias_paciente WHERE id = ? AND paciente_id = ?',
        [id, patientId]
    );
    return { ok: true, changes: result.changes };
}

async function getPeriodontogram(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(patientId);
    if (!id) return null;
    await ensurePeriodontogramSchema(dbHelpers);

    let record = await dbHelpers.get(
        'SELECT datos, dientes_imagenes, dientes_bloqueados, fecha, fecha_creacion, fecha_actualizacion FROM periodontograma WHERE paciente_id = ?',
        [id]
    );

    // Fallback: si no tiene imágenes, tomar las más recientes de la base de datos (imágenes globales/por defecto)
    if (!record || !record.dientes_imagenes || record.dientes_imagenes === '{}' || record.dientes_imagenes === 'null') {
        const fallback = await dbHelpers.get(
            `SELECT dientes_imagenes FROM periodontograma 
             WHERE dientes_imagenes IS NOT NULL 
               AND dientes_imagenes != '{}' 
               AND dientes_imagenes != 'null' 
               AND length(dientes_imagenes) > 50 
             ORDER BY id DESC LIMIT 1`
        );
        if (fallback && fallback.dientes_imagenes) {
            if (!record) {
                record = {
                    datos: null,
                    dientes_imagenes: fallback.dientes_imagenes,
                    dientes_bloqueados: 0,
                    fecha: new Date().toISOString().slice(0, 10),
                    fecha_creacion: new Date().toISOString(),
                    fecha_actualizacion: new Date().toISOString()
                };
            } else {
                record.dientes_imagenes = fallback.dientes_imagenes;
            }
        }
    }

    return record;
}

function normalizePeriodontogramImageEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return { imagen_v: '', imagen_p: '', imagen_url: '' };
    }

    const normalized = {
        imagen_v: typeof entry.imagen_v === 'string' ? entry.imagen_v : '',
        imagen_p: typeof entry.imagen_p === 'string' ? entry.imagen_p : '',
        imagen_url: typeof entry.imagen_url === 'string' ? entry.imagen_url : '',
    };

    if (!normalized.imagen_v && !normalized.imagen_p && normalized.imagen_url) {
        normalized.imagen_v = normalized.imagen_url;
        normalized.imagen_p = normalized.imagen_url;
    }

    return normalized;
}

function countPeriodontogramImages(payload) {
    if (!payload || typeof payload !== 'object') return 0;
    return Object.values(payload).reduce((count, entry) => {
        const normalized = normalizePeriodontogramImageEntry(entry);
        return count + ((normalized.imagen_v || normalized.imagen_p || normalized.imagen_url) ? 1 : 0);
    }, 0);
}

function extractPeriodontogramImagesFromData(data) {
    const rawTeeth = data?.teeth && typeof data.teeth === 'object' ? data.teeth : data;
    if (!rawTeeth || typeof rawTeeth !== 'object') return {};

    const images = {};
    Object.entries(rawTeeth).forEach(([tooth, entry]) => {
        if (!/^\d+$/.test(String(tooth))) return;
        images[tooth] = normalizePeriodontogramImageEntry(entry);
    });
    return images;
}

function extractStoredPeriodontogramImages(row) {
    const images = {};
    const append = (payload) => {
        Object.entries(payload || {}).forEach(([tooth, entry]) => {
            if (!/^\d+$/.test(String(tooth))) return;
            images[tooth] = normalizePeriodontogramImageEntry(entry);
        });
    };

    try {
        if (row?.datos) append(extractPeriodontogramImagesFromData(JSON.parse(row.datos)));
    } catch (_) {
        // ignore malformed legacy payloads
    }

    try {
        if (row?.dientes_imagenes) append(JSON.parse(row.dientes_imagenes));
    } catch (_) {
        // ignore malformed legacy payloads
    }

    return images;
}

function mergePeriodontogramImagesIntoData(data, imagePayload) {
    const base = data && typeof data === 'object' ? data : {};
    const teeth = base.teeth && typeof base.teeth === 'object'
        ? base.teeth
        : base;

    Object.entries(imagePayload || {}).forEach(([tooth, entry]) => {
        if (!/^\d+$/.test(String(tooth))) return;
        const target = teeth[tooth] && typeof teeth[tooth] === 'object'
            ? teeth[tooth]
            : {};
        const normalized = normalizePeriodontogramImageEntry(entry);
        target.imagen_v = normalized.imagen_v;
        target.imagen_p = normalized.imagen_p;
        target.imagen_url = normalized.imagen_url;
        teeth[tooth] = target;
    });

    if (base.teeth && typeof base.teeth === 'object') {
        base.teeth = teeth;
    }

    return base;
}

async function savePeriodontogram(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = normalizeId(payload.paciente_id);
    if (!patientId) throw new Error('Paciente invalido');

    const columns = await ensurePeriodontogramSchema(dbHelpers);
    let datosPayload = payload.datos && typeof payload.datos === 'object' ? payload.datos : {};
    let dientesImagenesPayload = payload.dientes_imagenes && typeof payload.dientes_imagenes === 'object'
        ? payload.dientes_imagenes
        : {};

    if (countPeriodontogramImages(dientesImagenesPayload) === 0) {
        const existing = await getPeriodontogram(db, patientId);
        const storedImages = extractStoredPeriodontogramImages(existing);
        if (countPeriodontogramImages(storedImages) > 0) {
            dientesImagenesPayload = storedImages;
            datosPayload = mergePeriodontogramImagesIntoData(datosPayload, storedImages);
        }
    }

    const datos = JSON.stringify(datosPayload);
    const dientesImagenes = JSON.stringify(dientesImagenesPayload);
    const dientesBloqueados = Number(payload.dientes_bloqueados ?? 0) === 1 ? 1 : 0;
    const fecha = normalizeText(payload.fecha) || new Date().toISOString().slice(0, 10);

    const insertCols = ['paciente_id', 'datos'];
    const insertVals = [patientId, datos];
    const updateSet = ['datos = excluded.datos'];

    if (columns.has('fecha')) {
        insertCols.push('fecha');
        insertVals.push(fecha);
        updateSet.push('fecha = excluded.fecha');
    }
    if (columns.has('dientes_imagenes')) {
        insertCols.push('dientes_imagenes');
        insertVals.push(dientesImagenes);
        updateSet.push('dientes_imagenes = excluded.dientes_imagenes');
    }
    if (columns.has('dientes_bloqueados')) {
        insertCols.push('dientes_bloqueados');
        insertVals.push(dientesBloqueados);
        updateSet.push('dientes_bloqueados = excluded.dientes_bloqueados');
    }
    if (columns.has('fecha_actualizacion')) {
        updateSet.push('fecha_actualizacion = CURRENT_TIMESTAMP');
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    await dbHelpers.run(
        `INSERT INTO periodontograma (${insertCols.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT(paciente_id) DO UPDATE SET ${updateSet.join(', ')}`,
        insertVals
    );

    return getPeriodontogram(db, patientId);
}

async function listTreatmentHistory(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(patientId);
    if (!id) return { planes: [], legacy: [] };

    const planes = await dbHelpers.all(
        `SELECT
             pt.*,
             tc.nombre  AS tratamiento_nombre,
             tc.categoria,
             tc.descripcion AS tratamiento_descripcion
         FROM planes_tratamiento pt
         LEFT JOIN tratamientos_catalogo tc ON pt.catalogo_id = tc.id
         WHERE pt.paciente_id = ?
         ORDER BY pt.fecha_creacion DESC`,
        [id]
    );

    const legacy = await dbHelpers.all(
        `SELECT * FROM tratamientos
         WHERE paciente_id = ? AND (procedimiento NOT LIKE '%Receta%' OR procedimiento IS NULL)
         ORDER BY fecha DESC`,
        [id]
    );

    return { planes, legacy };
}

async function listPrescriptions(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(patientId);
    if (!id) return [];

    return dbHelpers.all(
        `SELECT * FROM tratamientos
         WHERE paciente_id = ? AND procedimiento LIKE '%Receta%'
         ORDER BY fecha DESC`,
        [id]
    );
}

async function saveTreatmentRecord(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = normalizeId(payload.paciente_id);
    if (!patientId) throw new Error('Paciente invalido');

    const procedure = normalizeText(payload.procedimiento);
    if (!procedure) throw new Error('Procedimiento requerido');

    const columns = await getTableColumns(dbHelpers, 'tratamientos');
    const tooth = normalizeText(payload.diente);
    const notes = normalizeText(payload.notas) || '';
    const catalogId = normalizeId(payload.catalogo_id);
    const cost = normalizeMoney(payload.costo);
    const dateValue = normalizeText(payload.fecha) || new Date().toISOString();
    const recordType = normalizeRecordType(payload.registro_tipo);

    const insertColumns = ['paciente_id', 'diente', 'procedimiento', 'costo', 'notas'];
    const insertValues = [patientId, tooth, procedure, cost, notes];

    if (columns.has('catalogo_id')) {
        insertColumns.push('catalogo_id');
        insertValues.push(catalogId);
    }
    if (columns.has('fecha')) {
        insertColumns.push('fecha');
        insertValues.push(dateValue);
    }
    if (columns.has('registro_tipo')) {
        insertColumns.push('registro_tipo');
        insertValues.push(recordType);
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    const insert = await dbHelpers.run(
        `INSERT INTO tratamientos (${insertColumns.join(', ')})
         VALUES (${placeholders})`,
        insertValues
    );

    return dbHelpers.get('SELECT * FROM tratamientos WHERE id = ?', [insert.lastID]);
}

module.exports = {
    addDefaultCondition,
    getAntecedentes,
    getPeriodontogram,
    listDefaultConditions,
    listPrescriptions,
    listRadiographs,
    listTreatmentHistory,
    removeDefaultCondition,
    removeRadiograph,
    saveTreatmentRecord,
    saveAntecedentes,
    savePeriodontogram,
    saveRadiograph,
};
