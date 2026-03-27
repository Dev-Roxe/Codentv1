const { createDbHelpers } = require('./db-helpers');

function normalizeText(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
}

function normalizeInteger(value, fallback = 0, min = 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
}

function normalizeFlag(value, fallback = 1) {
    return Number(value ?? fallback) === 1 ? 1 : 0;
}

function normalizeTreatmentPayload(payload = {}) {
    return {
        id: payload.id ? Number(payload.id) : null,
        nombre: normalizeText(payload.nombre),
        descripcion: normalizeText(payload.descripcion),
        categoria: normalizeText(payload.categoria),
        costo_base: normalizeMoney(payload.costo_base),
        costo_medicina_estandar: normalizeMoney(payload.costo_medicina_estandar),
        costo_miscelanea_estandar: normalizeMoney(payload.costo_miscelanea_estandar),
        notas_especiales: normalizeText(payload.notas_especiales),
        duracion_estimada: normalizeInteger(payload.duracion_estimada, 30, 1),
        activo: normalizeFlag(payload.activo, 1),
    };
}

function normalizeMedicationPayload(payload = {}) {
    return {
        id: payload.id ? Number(payload.id) : null,
        nombre: normalizeText(payload.nombre),
        descripcion: normalizeText(payload.descripcion),
        stock: normalizeInteger(payload.stock, 0, 0),
        stock_minimo: normalizeInteger(payload.stock_minimo, 5, 0),
        precio: normalizeMoney(payload.precio),
        fecha_vencimiento: normalizeText(payload.fecha_vencimiento),
    };
}

function normalizeSupplyPayload(payload = {}) {
    return {
        id: payload.id ? Number(payload.id) : null,
        nombre: normalizeText(payload.nombre),
        descripcion: normalizeText(payload.descripcion),
        categoria: normalizeText(payload.categoria),
        stock: normalizeInteger(payload.stock, 0, 0),
        stock_minimo: normalizeInteger(payload.stock_minimo, 5, 0),
        precio: normalizeMoney(payload.precio),
        proveedor: normalizeText(payload.proveedor),
        fecha_compra: normalizeText(payload.fecha_compra),
        notas: normalizeText(payload.notas),
    };
}

async function tableExists(dbHelpers, tableName) {
    const row = await dbHelpers.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        [tableName]
    );
    return !!row?.name;
}

async function findDuplicate(dbHelpers, { table, whereSql, params, excludeId = null, selectSql }) {
    let sql = selectSql || `SELECT id, nombre FROM ${table} WHERE ${whereSql}`;
    const finalParams = [...params];
    if (excludeId) {
        sql += ' AND id <> ?';
        finalParams.push(Number(excludeId));
    }
    sql += ' ORDER BY id DESC LIMIT 1';
    return dbHelpers.get(sql, finalParams);
}

function buildDuplicateError(code, message, duplicate) {
    const error = new Error(message);
    error.code = code;
    error.duplicate = duplicate;
    return error;
}

async function listTreatments(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    let sql = 'SELECT * FROM tratamientos_catalogo';
    const params = [];
    const category = normalizeText(filters.category);
    if (category && category !== 'all') {
        sql += ' WHERE categoria = ?';
        params.push(category);
    }
    sql += ' ORDER BY categoria COLLATE NOCASE ASC, nombre COLLATE NOCASE ASC';
    return dbHelpers.all(sql, params);
}

async function getTreatmentById(db, treatmentId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(treatmentId || 0);
    if (!id) return null;
    return dbHelpers.get('SELECT * FROM tratamientos_catalogo WHERE id = ?', [id]);
}

async function saveTreatment(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const treatment = normalizeTreatmentPayload(payload);

    if (!treatment.nombre || !treatment.categoria) {
        throw new Error('Nombre y categoria son requeridos');
    }

    const duplicate = await findDuplicate(dbHelpers, {
        table: 'tratamientos_catalogo',
        whereSql: "(lower(trim(COALESCE(nombre, ''))) = ? AND lower(trim(COALESCE(categoria, ''))) = ?)",
        params: [treatment.nombre.toLowerCase(), treatment.categoria.toLowerCase()],
        excludeId: treatment.id,
        selectSql: 'SELECT id, nombre, categoria FROM tratamientos_catalogo WHERE (lower(trim(COALESCE(nombre, \'\'))) = ? AND lower(trim(COALESCE(categoria, \'\'))) = ?)',
    });
    if (duplicate) {
        throw buildDuplicateError(
            'DUPLICATE_TREATMENT',
            `Ya existe un tratamiento similar: ${duplicate.nombre} - ${duplicate.categoria}`.trim(),
            duplicate
        );
    }

    if (treatment.id) {
        await dbHelpers.run(
            `UPDATE tratamientos_catalogo
             SET nombre = ?, descripcion = ?, categoria = ?, costo_base = ?, duracion_estimada = ?, activo = ?,
                 costo_medicina_estandar = ?, costo_miscelanea_estandar = ?, notas_especiales = ?
             WHERE id = ?`,
            [
                treatment.nombre,
                treatment.descripcion,
                treatment.categoria,
                treatment.costo_base,
                treatment.duracion_estimada,
                treatment.activo,
                treatment.costo_medicina_estandar,
                treatment.costo_miscelanea_estandar,
                treatment.notas_especiales,
                treatment.id,
            ]
        );
        return getTreatmentById(db, treatment.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO tratamientos_catalogo (
            nombre, descripcion, categoria, costo_base, duracion_estimada, activo,
            costo_medicina_estandar, costo_miscelanea_estandar, notas_especiales
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            treatment.nombre,
            treatment.descripcion,
            treatment.categoria,
            treatment.costo_base,
            treatment.duracion_estimada,
            treatment.activo,
            treatment.costo_medicina_estandar,
            treatment.costo_miscelanea_estandar,
            treatment.notas_especiales,
        ]
    );

    return getTreatmentById(db, insert.lastID);
}

async function deleteTreatment(db, treatmentId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(treatmentId || 0);
    if (!id) throw new Error('Tratamiento invalido');

    const treatment = await getTreatmentById(db, id);
    if (!treatment) throw new Error('Tratamiento no encontrado');

    const guards = [
        { table: 'tratamientos', where: 'catalogo_id = ?', label: 'tratamientos registrados' },
        { table: 'planes_tratamiento', where: 'catalogo_id = ?', label: 'planes de tratamiento' },
    ];

    for (const guard of guards) {
        if (!(await tableExists(dbHelpers, guard.table))) continue;
        const row = await dbHelpers.get(`SELECT COUNT(*) AS total FROM ${guard.table} WHERE ${guard.where}`, [id]);
        if (Number(row?.total || 0) > 0) {
            throw new Error(`No se puede eliminar el tratamiento porque tiene ${guard.label}`);
        }
    }

    const result = await dbHelpers.run('DELETE FROM tratamientos_catalogo WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

async function listMedicines(db) {
    const dbHelpers = createDbHelpers(db);
    return dbHelpers.all('SELECT * FROM medicamentos ORDER BY nombre COLLATE NOCASE ASC');
}

async function getMedicineById(db, medicineId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(medicineId || 0);
    if (!id) return null;
    return dbHelpers.get('SELECT * FROM medicamentos WHERE id = ?', [id]);
}

async function saveMedicine(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const medicine = normalizeMedicationPayload(payload);

    if (!medicine.nombre) {
        throw new Error('El nombre del medicamento es requerido');
    }

    const duplicate = await findDuplicate(dbHelpers, {
        table: 'medicamentos',
        whereSql: "lower(trim(COALESCE(nombre, ''))) = ?",
        params: [medicine.nombre.toLowerCase()],
        excludeId: medicine.id,
    });
    if (duplicate) {
        throw buildDuplicateError(
            'DUPLICATE_MEDICINE',
            `Ya existe un medicamento similar: ${duplicate.nombre}`.trim(),
            duplicate
        );
    }

    if (medicine.id) {
        await dbHelpers.run(
            `UPDATE medicamentos
             SET nombre = ?, descripcion = ?, stock = ?, stock_minimo = ?, precio = ?, fecha_vencimiento = ?
             WHERE id = ?`,
            [
                medicine.nombre,
                medicine.descripcion,
                medicine.stock,
                medicine.stock_minimo,
                medicine.precio,
                medicine.fecha_vencimiento,
                medicine.id,
            ]
        );
        return getMedicineById(db, medicine.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO medicamentos (nombre, descripcion, stock, stock_minimo, precio, fecha_vencimiento)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            medicine.nombre,
            medicine.descripcion,
            medicine.stock,
            medicine.stock_minimo,
            medicine.precio,
            medicine.fecha_vencimiento,
        ]
    );

    return getMedicineById(db, insert.lastID);
}

async function deleteMedicine(db, medicineId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(medicineId || 0);
    if (!id) throw new Error('Medicamento invalido');

    const medicine = await getMedicineById(db, id);
    if (!medicine) throw new Error('Medicamento no encontrado');

    if (await tableExists(dbHelpers, 'planes_tratamiento_medicinas')) {
        const row = await dbHelpers.get(
            'SELECT COUNT(*) AS total FROM planes_tratamiento_medicinas WHERE medicamento_id = ?',
            [id]
        );
        if (Number(row?.total || 0) > 0) {
            throw new Error('No se puede eliminar el medicamento porque ya esta asociado a planes de tratamiento');
        }
    }

    const result = await dbHelpers.run('DELETE FROM medicamentos WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

async function listSupplies(db, filters = {}) {
    const dbHelpers = createDbHelpers(db);
    let sql = 'SELECT * FROM miscelanea';
    const params = [];
    const category = normalizeText(filters.category);
    if (category && category !== 'all') {
        sql += ' WHERE categoria = ?';
        params.push(category);
    }
    sql += ' ORDER BY nombre COLLATE NOCASE ASC';
    return dbHelpers.all(sql, params);
}

async function getSupplyById(db, supplyId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(supplyId || 0);
    if (!id) return null;
    return dbHelpers.get('SELECT * FROM miscelanea WHERE id = ?', [id]);
}

async function saveSupply(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const supply = normalizeSupplyPayload(payload);

    if (!supply.nombre) {
        throw new Error('El nombre del material es requerido');
    }

    const duplicate = await findDuplicate(dbHelpers, {
        table: 'miscelanea',
        whereSql: "lower(trim(COALESCE(nombre, ''))) = ? AND lower(trim(COALESCE(categoria, ''))) = ?",
        params: [supply.nombre.toLowerCase(), String(supply.categoria || '').toLowerCase()],
        excludeId: supply.id,
        selectSql: 'SELECT id, nombre, categoria FROM miscelanea WHERE lower(trim(COALESCE(nombre, \'\'))) = ? AND lower(trim(COALESCE(categoria, \'\'))) = ?',
    });
    if (duplicate) {
        throw buildDuplicateError(
            'DUPLICATE_SUPPLY',
            `Ya existe un material similar: ${duplicate.nombre}${duplicate.categoria ? ` - ${duplicate.categoria}` : ''}`.trim(),
            duplicate
        );
    }

    if (supply.id) {
        await dbHelpers.run(
            `UPDATE miscelanea
             SET nombre = ?, descripcion = ?, categoria = ?, stock = ?, stock_minimo = ?, precio = ?, proveedor = ?, fecha_compra = ?, notas = ?
             WHERE id = ?`,
            [
                supply.nombre,
                supply.descripcion,
                supply.categoria,
                supply.stock,
                supply.stock_minimo,
                supply.precio,
                supply.proveedor,
                supply.fecha_compra,
                supply.notas,
                supply.id,
            ]
        );
        return getSupplyById(db, supply.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO miscelanea (nombre, descripcion, categoria, stock, stock_minimo, precio, proveedor, fecha_compra, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            supply.nombre,
            supply.descripcion,
            supply.categoria,
            supply.stock,
            supply.stock_minimo,
            supply.precio,
            supply.proveedor,
            supply.fecha_compra,
            supply.notas,
        ]
    );

    return getSupplyById(db, insert.lastID);
}

async function deleteSupply(db, supplyId) {
    const dbHelpers = createDbHelpers(db);
    const id = Number(supplyId || 0);
    if (!id) throw new Error('Material invalido');

    const supply = await getSupplyById(db, id);
    if (!supply) throw new Error('Material no encontrado');

    const result = await dbHelpers.run('DELETE FROM miscelanea WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

module.exports = {
    deleteMedicine,
    deleteSupply,
    deleteTreatment,
    getMedicineById,
    getSupplyById,
    getTreatmentById,
    listMedicines,
    listSupplies,
    listTreatments,
    saveMedicine,
    saveSupply,
    saveTreatment,
};
