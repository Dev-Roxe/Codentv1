const { createDbHelpers } = require('./db-helpers');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELETE_GUARDS = [
    { table: 'citas', where: 'especialista_id = ?', label: 'citas' },
    { table: 'planes_tratamiento', where: 'CAST(COALESCE(especialista_asignado, \'\') AS TEXT) = CAST(? AS TEXT)', label: 'planes de tratamiento' },
];

function normalizeText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizeEmail(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toLowerCase() : null;
}

function isValidEmail(email) {
    return EMAIL_REGEX.test(String(email || '').trim());
}

function normalizeSpecialistPayload(payload = {}) {
    return {
        id: payload.id ? Number(payload.id) : null,
        nombre: normalizeText(payload.nombre),
        especialidad: normalizeText(payload.especialidad),
        telefono: normalizeText(payload.telefono),
        email: normalizeEmail(payload.email),
        activo: Number(payload.activo ?? 1) === 1 ? 1 : 0,
    };
}

async function tableExists(dbHelpers, tableName) {
    const row = await dbHelpers.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        [tableName]
    );
    return !!row?.name;
}

async function listSpecialists(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all(
        `SELECT
            id,
            nombre,
            especialidad,
            telefono,
            email,
            COALESCE(activo, 1) AS activo,
            fecha_creacion
         FROM especialistas
         ORDER BY nombre COLLATE NOCASE ASC, especialidad COLLATE NOCASE ASC, id ASC`
    );
}

async function getSpecialistById(db, specialistId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(specialistId || 0);
    if (!id) return null;

    return dbHelpers.get(
        `SELECT
            id,
            nombre,
            especialidad,
            telefono,
            email,
            COALESCE(activo, 1) AS activo,
            fecha_creacion
         FROM especialistas
         WHERE id = ?`,
        [id]
    );
}

async function findDuplicateSpecialist(dbHelpers, specialist, excludeId = null) {
    const where = [];
    const params = [];

    if (specialist.email) {
        where.push("lower(trim(COALESCE(email, ''))) = ?");
        params.push(specialist.email);
    }

    if (specialist.nombre && specialist.especialidad) {
        where.push("(lower(trim(COALESCE(nombre, ''))) = ? AND lower(trim(COALESCE(especialidad, ''))) = ?)");
        params.push(specialist.nombre.toLowerCase(), specialist.especialidad.toLowerCase());
    }

    if (!where.length) return null;

    let sql = `SELECT id, nombre, especialidad FROM especialistas WHERE (${where.join(' OR ')})`;
    if (excludeId) {
        sql += ' AND id <> ?';
        params.push(Number(excludeId));
    }
    sql += ' ORDER BY id DESC LIMIT 1';

    return dbHelpers.get(sql, params);
}

function buildDuplicateError(duplicate) {
    const error = new Error(`Ya existe un especialista similar: ${duplicate.nombre} - ${duplicate.especialidad}`.trim());
    error.code = 'DUPLICATE_SPECIALIST';
    error.duplicate = duplicate;
    return error;
}

async function saveSpecialist(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const specialist = normalizeSpecialistPayload(payload);

    if (!specialist.nombre || !specialist.especialidad) {
        throw new Error('Nombre y especialidad son requeridos');
    }
    if (specialist.email && !isValidEmail(specialist.email)) {
        throw new Error('El correo electronico no es valido');
    }

    const duplicate = await findDuplicateSpecialist(dbHelpers, specialist, specialist.id);
    if (duplicate) {
        throw buildDuplicateError(duplicate);
    }

    if (specialist.id) {
        await dbHelpers.run(
            `UPDATE especialistas
             SET nombre = ?, especialidad = ?, telefono = ?, email = ?, activo = ?
             WHERE id = ?`,
            [
                specialist.nombre,
                specialist.especialidad,
                specialist.telefono,
                specialist.email,
                specialist.activo,
                specialist.id,
            ]
        );
        return getSpecialistById(db, specialist.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO especialistas (nombre, especialidad, telefono, email, activo)
         VALUES (?, ?, ?, ?, ?)`,
        [
            specialist.nombre,
            specialist.especialidad,
            specialist.telefono,
            specialist.email,
            specialist.activo,
        ]
    );

    return getSpecialistById(db, insert.lastID);
}

async function deleteSpecialist(db, specialistId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(specialistId || 0);
    if (!id) throw new Error('Especialista invalido');

    const specialist = await dbHelpers.get(
        'SELECT id, nombre, especialidad FROM especialistas WHERE id = ? LIMIT 1',
        [id]
    );
    if (!specialist) {
        throw new Error('Especialista no encontrado');
    }

    for (const guard of DELETE_GUARDS) {
        if (!(await tableExists(dbHelpers, guard.table))) continue;
        const row = await dbHelpers.get(
            `SELECT COUNT(*) AS total FROM ${guard.table} WHERE ${guard.where}`,
            [id]
        );
        if (Number(row?.total || 0) > 0) {
            throw new Error(`No se puede eliminar el especialista porque tiene ${guard.label} relacionados`);
        }
    }

    const result = await dbHelpers.run('DELETE FROM especialistas WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

module.exports = {
    deleteSpecialist,
    getSpecialistById,
    listSpecialists,
    saveSpecialist,
};
