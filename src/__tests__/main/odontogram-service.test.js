const sqlite3 = require('sqlite3');

const {
    createDbHelpers,
    saveOdontogramDiagnosis,
    clearOdontogramDiagnosis,
    syncPlanDiagnosisRelationsWithDbHelpers,
} = require('../../main/odontogram-service');

function openMemoryDb() {
    return new sqlite3.Database(':memory:');
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) return reject(error);
            resolve(row || null);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) return reject(error);
            resolve(rows || []);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

async function seedClinicalDb() {
    const db = openMemoryDb();

    await exec(db, `
        CREATE TABLE tratamientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            diente TEXT,
            procedimiento TEXT NOT NULL,
            costo REAL DEFAULT 0,
            fecha TEXT DEFAULT CURRENT_TIMESTAMP,
            notas TEXT
        );
        CREATE TABLE planes_tratamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            catalogo_id INTEGER,
            estado TEXT DEFAULT 'pendiente',
            diente TEXT,
            caras TEXT
        );
        CREATE TABLE pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER,
            paciente_id INTEGER,
            monto REAL DEFAULT 0,
            tipo TEXT DEFAULT 'pago',
            estado TEXT DEFAULT 'aplicado'
        );
        CREATE TABLE facturas_simuladas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER,
            pago_id INTEGER
        );
        CREATE TABLE cobranza_recordatorios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER
        );
        CREATE TABLE cuotas_financiamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER
        );
        CREATE TABLE planes_financiamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER
        );
        CREATE TABLE pagos_aplicaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cuota_financiamiento_id INTEGER
        );
        CREATE TABLE planes_tratamiento_medicinas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER
        );
        CREATE TABLE comunicacion_especialistas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER
        );
        CREATE TABLE planes_tratamiento_versiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER
        );
        CREATE TABLE planes_tratamiento_historial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER
        );
        CREATE TABLE planes_tratamiento_cancelaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER
        );
    `);

    return db;
}

async function createDiagnosis(db, overrides = {}) {
    const result = await saveOdontogramDiagnosis(db, {
        paciente_id: 1,
        tooth: '11',
        face: 'mesial',
        dx_id: 'caries-dx',
        dx_name: 'Caries',
        target: 'face',
        ...overrides,
    });

    expect(result.ok).toBe(true);
    return result.diagnosis;
}

async function createPlan(db, overrides = {}) {
    const insert = await run(
        db,
        `INSERT INTO planes_tratamiento (paciente_id, catalogo_id, estado, diente, caras)
         VALUES (?, ?, ?, ?, ?)`,
        [
            overrides.paciente_id || 1,
            overrides.catalogo_id || 1,
            overrides.estado || 'pendiente',
            overrides.diente || '11',
            overrides.caras != null ? overrides.caras : JSON.stringify(['mesial']),
        ]
    );
    return insert.lastID;
}

describe('Odontogram Service', () => {
    test('limpiar un hallazgo sin tratamiento asociado elimina el diagnostico', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);

            const before = await get(db, 'SELECT COUNT(*) AS total FROM tratamientos');
            expect(Number(before.total)).toBe(1);

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(true);
            expect(result.removedDiagnosisIds).toEqual([diagnosis.id]);
            expect(result.removedPlanIds).toEqual([]);

            const after = await get(db, 'SELECT COUNT(*) AS total FROM tratamientos');
            expect(Number(after.total)).toBe(0);
        } finally {
            await close(db);
        }
    });

    test('limpiar un hallazgo con tratamiento pendiente elimina diagnostico y plan', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);
            const planId = await createPlan(db, { estado: 'pendiente' });
            const dbHelpers = createDbHelpers(db);
            await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
                plan_id: planId,
                paciente_id: 1,
                diente: '11',
                caras: ['mesial'],
                source_diagnosis_ids: [diagnosis.id],
            });

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(true);
            expect(result.removedPlanIds).toEqual([planId]);

            const planRow = await get(db, 'SELECT id FROM planes_tratamiento WHERE id = ?', [planId]);
            expect(planRow).toBeNull();
        } finally {
            await close(db);
        }
    });

    test('limpiar un hallazgo con tratamiento not_started elimina diagnostico y plan', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);
            const planId = await createPlan(db, { estado: 'not_started' });
            const dbHelpers = createDbHelpers(db);
            await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
                plan_id: planId,
                paciente_id: 1,
                diente: '11',
                caras: ['mesial'],
                source_diagnosis_ids: [diagnosis.id],
            });

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(true);
            expect(result.removedPlanIds).toEqual([planId]);
        } finally {
            await close(db);
        }
    });

    test('limpiar un hallazgo con tratamiento en progreso bloquea la limpieza', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);
            const planId = await createPlan(db, { estado: 'en_progreso' });
            const dbHelpers = createDbHelpers(db);
            await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
                plan_id: planId,
                paciente_id: 1,
                diente: '11',
                caras: ['mesial'],
                source_diagnosis_ids: [diagnosis.id],
            });

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.requiresCancellation).toBe(true);
            expect(result.planId).toBe(planId);
            expect(result.financialImpact.netPaid).toBe(0);

            const diagnosisRow = await get(db, 'SELECT id FROM tratamientos WHERE id = ?', [diagnosis.id]);
            const planRow = await get(db, 'SELECT id FROM planes_tratamiento WHERE id = ?', [planId]);
            expect(diagnosisRow).not.toBeNull();
            expect(planRow).not.toBeNull();
        } finally {
            await close(db);
        }
    });

    test('limpiar un hallazgo con tratamiento completado bloquea la limpieza', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);
            const planId = await createPlan(db, { estado: 'completado' });
            const dbHelpers = createDbHelpers(db);
            await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
                plan_id: planId,
                paciente_id: 1,
                diente: '11',
                caras: ['mesial'],
                source_diagnosis_ids: [diagnosis.id],
            });

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(false);
            expect(result.blocked).toBe(true);
        } finally {
            await close(db);
        }
    });

    test('limpiar un hallazgo con tratamiento cancelado quita el diagnostico y deja el plan historico', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);
            const planId = await createPlan(db, { estado: 'cancelado' });
            const dbHelpers = createDbHelpers(db);
            await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
                plan_id: planId,
                paciente_id: 1,
                diente: '11',
                caras: ['mesial'],
                source_diagnosis_ids: [diagnosis.id],
            });

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(true);
            expect(result.detachedPlanIds).toEqual([planId]);

            const diagnosisRow = await get(db, 'SELECT id FROM tratamientos WHERE id = ?', [diagnosis.id]);
            const planRow = await get(db, 'SELECT id FROM planes_tratamiento WHERE id = ?', [planId]);
            const relationRows = await all(db, 'SELECT * FROM planes_tratamiento_diagnosticos WHERE plan_id = ?', [planId]);

            expect(diagnosisRow).toBeNull();
            expect(planRow).not.toBeNull();
            expect(relationRows).toHaveLength(0);
        } finally {
            await close(db);
        }
    });

    test('limpiar un hallazgo con plan pendiente elimina residuos financieros del plan removible', async () => {
        const db = await seedClinicalDb();

        try {
            const diagnosis = await createDiagnosis(db);
            const planId = await createPlan(db, { estado: 'pendiente' });
            await run(db, 'INSERT INTO cuotas_financiamiento (plan_tratamiento_id) VALUES (?)', [planId]);
            await run(db, 'INSERT INTO pagos (plan_tratamiento_id, paciente_id, monto, tipo, estado) VALUES (?, 1, 0, ?, ?)', [planId, 'pago', 'cancelado']);
            const paymentRow = await get(db, 'SELECT id FROM pagos WHERE plan_tratamiento_id = ? ORDER BY id DESC LIMIT 1', [planId]);
            await run(db, 'INSERT INTO facturas_simuladas (plan_tratamiento_id, pago_id) VALUES (?, ?)', [planId, paymentRow.id]);
            await run(db, 'INSERT INTO cobranza_recordatorios (plan_tratamiento_id) VALUES (?)', [planId]);
            const dbHelpers = createDbHelpers(db);
            await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
                plan_id: planId,
                paciente_id: 1,
                diente: '11',
                caras: ['mesial'],
                source_diagnosis_ids: [diagnosis.id],
            });

            const result = await clearOdontogramDiagnosis(db, {
                paciente_id: 1,
                diagnosisIds: [diagnosis.id],
                mode: 'face',
            });

            expect(result.ok).toBe(true);
            expect(result.removedPlanIds).toEqual([planId]);
            expect(await get(db, 'SELECT id FROM facturas_simuladas WHERE plan_tratamiento_id = ?', [planId])).toBeNull();
            expect(await get(db, 'SELECT id FROM cobranza_recordatorios WHERE plan_tratamiento_id = ?', [planId])).toBeNull();
            expect(await get(db, 'SELECT id FROM pagos WHERE plan_tratamiento_id = ?', [planId])).toBeNull();
        } finally {
            await close(db);
        }
    });
});
