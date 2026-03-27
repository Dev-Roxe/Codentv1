const { createDbHelpers } = require('./db-helpers');

const FIELD_CONFIG_KEY = 'required_fields_paciente';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATED_PATIENT_TABLES = [
    { table: 'citas', where: 'paciente_id = ?' },
    { table: 'antecedentes_clinicos', where: 'paciente_id = ?' },
    { table: 'tratamientos', where: 'paciente_id = ?' },
    { table: 'planes_tratamiento', where: 'paciente_id = ?' },
    { table: 'planes_tratamiento_historial', where: 'paciente_id = ?' },
    { table: 'planes_tratamiento_cancelaciones', where: 'paciente_id = ?' },
    { table: 'pagos', where: 'paciente_id = ?' },
    { table: 'movimientos_caja', where: 'paciente_id = ?' },
    { table: 'cobranza_recordatorios', where: 'paciente_id = ?' },
    { table: 'facturas_simuladas', where: 'paciente_id = ?' },
    { table: 'crm_recordatorios', where: 'paciente_id = ?' },
    { table: 'periodontograma', where: 'paciente_id = ?' },
    { table: 'radiografias_paciente', where: 'paciente_id = ?' },
    { table: 'auditoria_clinica', where: 'paciente_id = ?' }
];

function isValidEmail(email) {
    return EMAIL_REGEX.test(String(email || '').trim());
}

function normalizeText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function sanitizeFieldConfig(config) {
    if (Array.isArray(config)) {
        return config.filter((key) => key !== 'genero');
    }
    if (config && typeof config === 'object') {
        const cleaned = { ...config };
        delete cleaned.genero;
        return cleaned;
    }
    return config;
}

function applyFieldConfigDefaults(config) {
    const safeConfig = config && typeof config === 'object' && !Array.isArray(config) ? { ...config } : {};
    safeConfig.nombre = { show: true, required: true, ...(safeConfig.nombre || {}) };
    safeConfig.apellido = { show: true, required: true, ...(safeConfig.apellido || {}) };
    safeConfig.nombre.show = true;
    safeConfig.nombre.required = true;
    safeConfig.apellido.show = true;
    safeConfig.apellido.required = true;
    return safeConfig;
}

function parseFieldConfigValue(value) {
    if (!value) return applyFieldConfigDefaults({});
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return applyFieldConfigDefaults(
                sanitizeFieldConfig(parsed).reduce((acc, key) => ({
                    ...acc,
                    [key]: { show: true, required: true },
                }), {})
            );
        }
        return applyFieldConfigDefaults(sanitizeFieldConfig(parsed));
    } catch (error) {
        return applyFieldConfigDefaults({});
    }
}

function sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    return JSON.parse(JSON.stringify(meta));
}

function normalizePatientPayload(payload = {}) {
    return {
        id: payload.id ? Number(payload.id) : null,
        nombre: normalizeText(payload.nombre),
        apellido: normalizeText(payload.apellido),
        telefono: normalizeText(payload.telefono),
        email: normalizeText(payload.email)?.toLowerCase() || null,
        direccion: normalizeText(payload.direccion),
        fecha_nacimiento: normalizeText(payload.fecha_nacimiento),
        nombre_social: normalizeText(payload.nombre_social),
        curp: normalizeText(payload.curp),
        convenio: normalizeText(payload.convenio),
        numero_interno: normalizeText(payload.numero_interno),
        sexo: normalizeText(payload.sexo),
        ciudad: normalizeText(payload.ciudad),
        delegacion: normalizeText(payload.delegacion),
        actividad: normalizeText(payload.actividad),
        profesion: normalizeText(payload.profesion),
        empleador: normalizeText(payload.empleador),
        observaciones: normalizeText(payload.observaciones),
        apoderado: normalizeText(payload.apoderado)
    };
}

async function tableExists(dbHelpers, tableName) {
    const row = await dbHelpers.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        [tableName]
    );
    return !!row?.name;
}

async function getPatientById(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(patientId || 0);
    if (!id) return null;

    return dbHelpers.get(
        `SELECT
            p.*,
            COUNT(c.id) AS total_citas,
            MAX(CASE WHEN c.estado = 'atendido' THEN date(c.fecha_hora) END) AS ultima_cita_atendida,
            MAX(date(c.fecha_hora)) AS ultima_cita,
            COALESCE(
                MAX(CASE WHEN c.estado = 'atendido' THEN date(c.fecha_hora) END),
                MAX(date(c.fecha_hora)),
                date(COALESCE(p.created_at, p.fecha_registro))
            ) AS ultima_actividad
        FROM pacientes p
        LEFT JOIN citas c ON c.paciente_id = p.id
        WHERE p.id = ?
        GROUP BY p.id`,
        [id]
    );
}

async function listPatients(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all(
        `SELECT
            p.*,
            COUNT(c.id) AS total_citas,
            MAX(CASE WHEN c.estado = 'atendido' THEN date(c.fecha_hora) END) AS ultima_cita_atendida,
            MAX(date(c.fecha_hora)) AS ultima_cita,
            COALESCE(
                MAX(CASE WHEN c.estado = 'atendido' THEN date(c.fecha_hora) END),
                MAX(date(c.fecha_hora)),
                date(COALESCE(p.created_at, p.fecha_registro))
            ) AS ultima_actividad
        FROM pacientes p
        LEFT JOIN citas c ON c.paciente_id = p.id
        GROUP BY p.id
        ORDER BY p.id DESC`
    );
}

async function listBasicPatients(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all(
        'SELECT id, nombre, apellido FROM pacientes ORDER BY nombre COLLATE NOCASE ASC, apellido COLLATE NOCASE ASC, id ASC'
    );
}

async function getFieldConfig(db) {
    const dbHelpers = createDbHelpers(db);
    const row = await dbHelpers.get(
        'SELECT valor FROM admin_config WHERE clave = ? LIMIT 1',
        [FIELD_CONFIG_KEY]
    );
    return parseFieldConfigValue(row?.valor);
}

async function saveFieldConfig(db, config) {
    const dbHelpers = createDbHelpers(db);
    const normalized = applyFieldConfigDefaults(sanitizeFieldConfig(config) || {});
    await dbHelpers.run(
        'INSERT OR REPLACE INTO admin_config (clave, valor) VALUES (?, ?)',
        [FIELD_CONFIG_KEY, JSON.stringify(normalized)]
    );
    return normalized;
}

async function findDuplicatePatient(dbHelpers, patient, excludeId = null) {
    const normalizedEmail = String(patient.email || '').trim().toLowerCase();
    const normalizedPhone = normalizePhone(patient.telefono);
    const normalizedName = String(patient.nombre || '').trim().toLowerCase();
    const normalizedLastName = String(patient.apellido || '').trim().toLowerCase();
    const where = [];
    const params = [];

    if (normalizedEmail) {
        where.push("lower(trim(COALESCE(email, ''))) = ?");
        params.push(normalizedEmail);
    }

    if (normalizedPhone && normalizedName && normalizedLastName) {
        where.push(`(
            replace(replace(replace(replace(replace(COALESCE(telefono, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?
            AND lower(trim(COALESCE(nombre, ''))) = ?
            AND lower(trim(COALESCE(apellido, ''))) = ?
        )`);
        params.push(normalizedPhone, normalizedName, normalizedLastName);
    }

    if (!where.length) return null;

    let sql = `SELECT id, nombre, apellido FROM pacientes WHERE (${where.join(' OR ')})`;
    if (excludeId) {
        sql += ' AND id <> ?';
        params.push(Number(excludeId));
    }
    sql += ' ORDER BY id DESC LIMIT 1';

    return dbHelpers.get(sql, params);
}

function buildDuplicateError(duplicate) {
    const error = new Error(`Ya existe un paciente similar: ${duplicate.nombre} ${duplicate.apellido}`.trim());
    error.code = 'DUPLICATE_PATIENT';
    error.duplicate = duplicate;
    return error;
}

async function savePatient(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patient = normalizePatientPayload(payload);

    if (!patient.nombre || !patient.apellido) {
        throw new Error('Nombre y apellidos son requeridos');
    }
    if (patient.email && !isValidEmail(patient.email)) {
        throw new Error('El correo electronico no es valido');
    }

    const duplicate = await findDuplicatePatient(dbHelpers, patient, patient.id);
    if (duplicate) {
        throw buildDuplicateError(duplicate);
    }

    if (patient.id) {
        await dbHelpers.run(
            `UPDATE pacientes
             SET nombre = ?, apellido = ?, telefono = ?, email = ?, direccion = ?, fecha_nacimiento = ?,
                 nombre_social = ?, curp = ?, convenio = ?, numero_interno = ?, sexo = ?, ciudad = ?,
                 delegacion = ?, actividad = ?, profesion = ?, empleador = ?, observaciones = ?, apoderado = ?
             WHERE id = ?`,
            [
                patient.nombre, patient.apellido, patient.telefono, patient.email, patient.direccion, patient.fecha_nacimiento,
                patient.nombre_social, patient.curp, patient.convenio, patient.numero_interno, patient.sexo, patient.ciudad,
                patient.delegacion, patient.actividad, patient.profesion, patient.empleador, patient.observaciones, patient.apoderado,
                patient.id,
            ]
        );
        return getPatientById(db, patient.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO pacientes (
            nombre, apellido, telefono, email, direccion, fecha_nacimiento, 
            nombre_social, curp, convenio, numero_interno, sexo, ciudad, 
            delegacion, actividad, profesion, empleador, observaciones, apoderado, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
            patient.nombre, patient.apellido, patient.telefono, patient.email, patient.direccion, patient.fecha_nacimiento,
            patient.nombre_social, patient.curp, patient.convenio, patient.numero_interno, patient.sexo, patient.ciudad,
            patient.delegacion, patient.actividad, patient.profesion, patient.empleador, patient.observaciones, patient.apoderado
        ]
    );

    return getPatientById(db, insert.lastID);
}

async function removePatient(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(patientId || 0);
    if (!id) throw new Error('Paciente invalido');

    const patient = await dbHelpers.get(
        'SELECT id, nombre, apellido FROM pacientes WHERE id = ? LIMIT 1',
        [id]
    );
    if (!patient) {
        throw new Error('Paciente no encontrado');
    }

    // Eliminar registros relacionados (Cascade Delete)
    for (const relation of RELATED_PATIENT_TABLES) {
        if (!(await tableExists(dbHelpers, relation.table))) continue;
        await dbHelpers.run(`DELETE FROM ${relation.table} WHERE ${relation.where}`, [id]);
    }

    const result = await dbHelpers.run('DELETE FROM pacientes WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

module.exports = {
    getFieldConfig,
    getPatientById,
    listBasicPatients,
    listPatients,
    removePatient,
    saveFieldConfig,
    savePatient,
};
