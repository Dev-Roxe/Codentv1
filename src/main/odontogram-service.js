const { randomUUID } = require('crypto');



const VALID_FACES = new Set(['oclusal', 'mesial', 'distal', 'vestibular', 'lingual']);
const AUTO_DELETE_PLAN_STATES = new Set(['draft', 'planned', 'planificado', 'not_started', 'no_iniciado', 'pendiente']);
const DETACH_ONLY_PLAN_STATES = new Set(['cancelled', 'canceled', 'cancelado']);
const PROTECTED_PLAN_STATES = new Set(['in_progress', 'en_progreso', 'activo', 'active', 'parcial', 'partial', 'completed', 'completado', 'completed_with_balance', 'terminado_con_saldo']);

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');
}

function normalizePlanStatus(value) {
    const normalized = normalizeText(value);
    if (normalized === 'no_iniciado' || normalized === 'not_started') return 'not_started';
    if (normalized === 'en_progreso' || normalized === 'in_progress') return 'in_progress';
    if (normalized === 'completado' || normalized === 'completed') return 'completed';
    if (normalized === 'terminado_con_saldo' || normalized === 'completed_with_balance') return 'completed_with_balance';
    if (normalized === 'cancelado' || normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
    if (normalized === 'planificado' || normalized === 'planned') return 'planned';
    if (normalized === 'activo' || normalized === 'active') return 'active';
    if (normalized === 'parcial' || normalized === 'partial') return 'partial';
    if (normalized === 'borrador') return 'draft';
    return normalized || 'unknown';
}

function normalizeFace(face) {
    const normalized = normalizeText(face);
    return VALID_FACES.has(normalized) ? normalized : null;
}

function normalizeTooth(value) {
    const tooth = String(value || '').trim();
    return tooth || null;
}

function normalizeFaces(value) {
    let faces = [];

    if (Array.isArray(value)) {
        faces = value;
    } else if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            faces = Array.isArray(parsed) ? parsed : raw.split(',');
        } catch (error) {
            faces = raw.split(',');
        }
    }

    return [...new Set(faces.map(normalizeFace).filter(Boolean))];
}

function createDbHelpers(db) {
    return {
        db,
        get(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (error, row) => {
                    if (error) return reject(error);
                    resolve(row || null);
                });
            });
        },
        all(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows || []);
                });
            });
        },
        run(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function onRun(error) {
                    if (error) return reject(error);
                    resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        },
    };
}

async function withTransaction(dbHelpers, work) {
    await dbHelpers.run('BEGIN IMMEDIATE TRANSACTION');
    try {
        const result = await work();
        await dbHelpers.run('COMMIT');
        return result;
    } catch (error) {
        try {
            await dbHelpers.run('ROLLBACK');
        } catch (rollbackError) {
            // ignore rollback failure and surface original error
        }
        throw error;
    }
}

async function ensureOdontogramSchema(dbHelpers) {
    if (dbHelpers.db._odontogramSchemaEnsured) return;

    const treatmentColumns = await dbHelpers.all('PRAGMA table_info(tratamientos)');
    const treatmentColumnNames = new Set((treatmentColumns || []).map((row) => row?.name).filter(Boolean));
    const treatmentColumnsToAdd = [
        ['registro_tipo', 'TEXT'],
        ['dx_uid', 'TEXT'],
        ['dx_id', 'TEXT'],
        ['dx_face', 'TEXT'],
    ];

    for (const [name, definition] of treatmentColumnsToAdd) {
        if (treatmentColumnNames.has(name)) continue;
        await dbHelpers.run(`ALTER TABLE tratamientos ADD COLUMN ${name} ${definition}`);
    }

    await dbHelpers.run(
        `CREATE TABLE IF NOT EXISTS planes_tratamiento_diagnosticos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER NOT NULL,
            diagnostico_id INTEGER NOT NULL,
            diagnostico_uid TEXT,
            paciente_id INTEGER NOT NULL,
            diente TEXT NOT NULL,
            cara TEXT,
            dx_id TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(plan_id) REFERENCES planes_tratamiento(id) ON DELETE CASCADE,
            FOREIGN KEY(diagnostico_id) REFERENCES tratamientos(id) ON DELETE CASCADE,
            UNIQUE(plan_id, diagnostico_id)
        )`
    );
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_tratamientos_diagnosticos_paciente_diente ON tratamientos(paciente_id, diente)');
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_diagnosticos_plan ON planes_tratamiento_diagnosticos(plan_id)');
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_diagnosticos_diagnostico ON planes_tratamiento_diagnosticos(diagnostico_id)');

    dbHelpers.db._odontogramSchemaEnsured = true;
}

function parseDiagnosisNote(note) {
    if (typeof note !== 'string' || !note.startsWith('DX:')) return null;
    try {
        const parsed = JSON.parse(note.slice(3));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        return null;
    }
}

function normalizeDiagnosisRow(row) {
    if (!row) return null;
    const tooth = normalizeTooth(row.diente);
    if (!tooth) return null;

    const noteData = parseDiagnosisNote(row.notas);
    const explicitDxId = String(row.dx_id || '').trim() || null;
    const explicitFace = normalizeFace(row.dx_face);
    const explicitUid = String(row.dx_uid || '').trim() || null;
    const noteDxId = String(noteData?.dxId || '').trim() || null;
    const noteFace = normalizeFace(noteData?.face);
    const noteUid = String(noteData?.uid || '').trim() || null;
    const rowType = normalizeText(row.registro_tipo);
    const isDiagnosis = rowType === 'diagnostico' || !!noteData || !!explicitDxId || !!explicitFace || !!explicitUid;

    if (!isDiagnosis) return null;

    return {
        id: Number(row.id),
        paciente_id: Number(row.paciente_id),
        tooth,
        face: explicitFace || noteFace || null,
        dx_id: explicitDxId || noteDxId || null,
        dx_uid: explicitUid || noteUid || `legacy-dx-${row.id}`,
        procedimiento: row.procedimiento || '',
        notas: row.notas || '',
        fecha: row.fecha || null,
    };
}

async function listPatientDiagnosisRows(dbHelpers, patientId) {
    const rows = await dbHelpers.all(
        `SELECT
            id,
            paciente_id,
            diente,
            procedimiento,
            notas,
            fecha,
            registro_tipo,
            dx_uid,
            dx_id,
            dx_face
         FROM tratamientos
         WHERE paciente_id = ?
           AND diente IS NOT NULL
         ORDER BY datetime(fecha) DESC, id DESC`,
        [patientId]
    );

    return rows.map(normalizeDiagnosisRow).filter(Boolean);
}

function diagnosisMatchesTarget(diagnosis, target = {}) {
    if (!diagnosis) return false;

    if (Array.isArray(target.diagnosisIds) && target.diagnosisIds.length) {
        return target.diagnosisIds.includes(Number(diagnosis.id));
    }

    if (Array.isArray(target.diagnosisUids) && target.diagnosisUids.length) {
        return target.diagnosisUids.includes(String(diagnosis.dx_uid));
    }

    const tooth = normalizeTooth(target.tooth);
    if (tooth && diagnosis.tooth !== tooth) return false;

    if (target.mode === 'tooth') {
        return !tooth || diagnosis.tooth === tooth;
    }

    const face = normalizeFace(target.face);
    if (!face) return false;

    if (target.mode === 'face') {
        return diagnosis.face === face;
    }

    return diagnosis.face === face;
}

function uniqueNumbers(values = []) {
    return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

async function tableExists(dbHelpers, tableName) {
    const row = await dbHelpers.get(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name = ?`,
        [tableName]
    );
    return !!row;
}

async function runIfTableExists(dbHelpers, tableName, sql, params = []) {
    if (!(await tableExists(dbHelpers, tableName))) return;
    await dbHelpers.run(sql, params);
}

async function loadPlanRows(dbHelpers, patientId, planId = null) {
    const where = ['paciente_id = ?'];
    const params = [patientId];

    if (planId) {
        where.push('id = ?');
        params.push(planId);
    }

    return dbHelpers.all(
        `SELECT id, paciente_id, estado, diente, caras
         FROM planes_tratamiento
         WHERE ${where.join(' AND ')}`,
        params
    );
}

async function getPlanAppliedPaymentCount(dbHelpers, planId) {
    const row = await dbHelpers.get(
        `SELECT COUNT(*) AS total
         FROM pagos
         WHERE plan_tratamiento_id = ?
           AND lower(COALESCE(estado, 'aplicado')) = 'aplicado'`,
        [planId]
    );
    return Number(row?.total || 0);
}

async function getPlanFinancialImpact(dbHelpers, planId) {
    if (!planId) {
        return {
            paymentCount: 0,
            totalPaid: 0,
            totalRefunded: 0,
            netPaid: 0,
        };
    }

    const row = await dbHelpers.get(
        `SELECT
            COUNT(*) AS movimientos,
            COALESCE(SUM(CASE WHEN lower(COALESCE(tipo, 'pago')) = 'devolucion' THEN monto ELSE 0 END), 0) AS total_devuelto,
            COALESCE(SUM(CASE WHEN lower(COALESCE(tipo, 'pago')) != 'devolucion' THEN monto ELSE 0 END), 0) AS total_pagado,
            COALESCE(SUM(
                CASE
                    WHEN lower(COALESCE(tipo, 'pago')) = 'devolucion' THEN -monto
                    ELSE monto
                END
            ), 0) AS neto_pagado
         FROM pagos
         WHERE plan_tratamiento_id = ?
           AND lower(COALESCE(estado, 'aplicado')) = 'aplicado'`,
        [planId]
    );

    return {
        paymentCount: Number(row?.movimientos || 0),
        totalPaid: Math.round((Number(row?.total_pagado || 0)) * 100) / 100,
        totalRefunded: Math.round((Number(row?.total_devuelto || 0)) * 100) / 100,
        netPaid: Math.round((Number(row?.neto_pagado || 0)) * 100) / 100,
    };
}

async function deletePlanTree(dbHelpers, planId) {
    await runIfTableExists(
        dbHelpers,
        'pagos_aplicaciones',
        'DELETE FROM pagos_aplicaciones WHERE cuota_financiamiento_id IN (SELECT id FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?)',
        [planId]
    );
    await runIfTableExists(dbHelpers, 'facturas_simuladas', 'DELETE FROM facturas_simuladas WHERE plan_tratamiento_id = ? OR pago_id IN (SELECT id FROM pagos WHERE plan_tratamiento_id = ?)', [planId, planId]);
    await runIfTableExists(dbHelpers, 'cobranza_recordatorios', 'DELETE FROM cobranza_recordatorios WHERE plan_tratamiento_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'pagos', 'DELETE FROM pagos WHERE plan_tratamiento_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'cuotas_financiamiento', 'DELETE FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_financiamiento', 'DELETE FROM planes_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_tratamiento_medicinas', 'DELETE FROM planes_tratamiento_medicinas WHERE plan_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'comunicacion_especialistas', 'DELETE FROM comunicacion_especialistas WHERE plan_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_tratamiento_versiones', 'DELETE FROM planes_tratamiento_versiones WHERE plan_tratamiento_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_tratamiento_historial', 'DELETE FROM planes_tratamiento_historial WHERE plan_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_tratamiento_cancelaciones', 'DELETE FROM planes_tratamiento_cancelaciones WHERE plan_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_tratamiento_diagnosticos', 'DELETE FROM planes_tratamiento_diagnosticos WHERE plan_id = ?', [planId]);
    await runIfTableExists(dbHelpers, 'planes_tratamiento', 'DELETE FROM planes_tratamiento WHERE id = ?', [planId]);
}

function classifyPlanCleanup(plan = {}, paymentCount = 0) {
    if (paymentCount > 0) {
        return {
            mode: 'block',
            reason: 'payments',
            message: 'No se puede quitar este padecimiento del plan porque el tratamiento ya tiene pagos registrados. Para eliminarlo, primero debes cancelar o devolver esos pagos.',
        };
    }

    const status = normalizePlanStatus(plan.estado);
    if (AUTO_DELETE_PLAN_STATES.has(status)) {
        return { mode: 'auto_delete', reason: status };
    }
    if (DETACH_ONLY_PLAN_STATES.has(status)) {
        return { mode: 'detach', reason: status };
    }
    if (PROTECTED_PLAN_STATES.has(status)) {
        return {
            mode: 'block',
            reason: status,
            message: 'No se puede quitar este padecimiento del plan porque el tratamiento ya fue iniciado. Para eliminarlo, primero debes cancelar el tratamiento.',
        };
    }

    return {
        mode: 'block',
        reason: status || 'unknown',
        message: 'No se pudo quitar este padecimiento automaticamente porque el estado del tratamiento requiere revision manual.',
    };
}

async function backfillPlanDiagnosisRelationsWithDbHelpers(dbHelpers, patientId, diagnosisRows = null) {
    await ensureOdontogramSchema(dbHelpers);
    const diagnoses = Array.isArray(diagnosisRows) ? diagnosisRows : await listPatientDiagnosisRows(dbHelpers, patientId);
    const plans = await loadPlanRows(dbHelpers, patientId);

    for (const plan of plans) {
        const totalRelations = await dbHelpers.get(
            'SELECT COUNT(*) AS total FROM planes_tratamiento_diagnosticos WHERE plan_id = ?',
            [plan.id]
        );
        if (Number(totalRelations?.total || 0) > 0) continue;

        const tooth = normalizeTooth(plan.diente);
        if (!tooth) continue;

        const faces = normalizeFaces(plan.caras);
        const matches = diagnoses.filter((diagnosis) => {
            if (diagnosis.tooth !== tooth) return false;
            if (!faces.length) return true;
            return diagnosis.face && faces.includes(diagnosis.face);
        });

        for (const diagnosis of matches) {
            await dbHelpers.run(
                `INSERT OR IGNORE INTO planes_tratamiento_diagnosticos
                 (plan_id, diagnostico_id, diagnostico_uid, paciente_id, diente, cara, dx_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [plan.id, diagnosis.id, diagnosis.dx_uid, patientId, diagnosis.tooth, diagnosis.face, diagnosis.dx_id]
            );
        }
    }
}

async function syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, payload = {}) {
    await ensureOdontogramSchema(dbHelpers);

    const patientId = Number(payload.paciente_id || 0);
    const planId = Number(payload.plan_id || payload.id || 0);
    if (!patientId || !planId) return { linkedDiagnosisIds: [] };

    const plans = await loadPlanRows(dbHelpers, patientId, planId);
    const plan = plans[0];
    if (!plan) return { linkedDiagnosisIds: [] };

    const diagnoses = await listPatientDiagnosisRows(dbHelpers, patientId);
    const diagnosisIds = uniqueNumbers(payload.sourceDiagnosisIds || payload.source_diagnosis_ids || []);
    const diagnosisUids = [...new Set((payload.sourceDiagnosisUids || payload.source_diagnosis_uids || []).map((value) => String(value || '').trim()).filter(Boolean))];
    const planTooth = normalizeTooth(payload.diente || plan.diente);
    const planFaces = normalizeFaces(payload.caras != null ? payload.caras : plan.caras);

    let matches = diagnoses.filter((diagnosis) => diagnosis.tooth === planTooth);

    if (diagnosisIds.length) {
        matches = matches.filter((diagnosis) => diagnosisIds.includes(Number(diagnosis.id)));
    } else if (diagnosisUids.length) {
        matches = matches.filter((diagnosis) => diagnosisUids.includes(String(diagnosis.dx_uid)));
    } else if (planFaces.length) {
        matches = matches.filter((diagnosis) => diagnosis.face && planFaces.includes(diagnosis.face));
    }

    await dbHelpers.run('DELETE FROM planes_tratamiento_diagnosticos WHERE plan_id = ?', [planId]);

    for (const diagnosis of matches) {
        await dbHelpers.run(
            `INSERT OR IGNORE INTO planes_tratamiento_diagnosticos
             (plan_id, diagnostico_id, diagnostico_uid, paciente_id, diente, cara, dx_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [planId, diagnosis.id, diagnosis.dx_uid, patientId, diagnosis.tooth, diagnosis.face, diagnosis.dx_id]
        );
    }

    return {
        linkedDiagnosisIds: matches.map((diagnosis) => Number(diagnosis.id)),
        linkedDiagnosisUids: matches.map((diagnosis) => String(diagnosis.dx_uid)),
    };
}

async function findTargetDiagnoses(dbHelpers, patientId, payload = {}) {
    const diagnoses = await listPatientDiagnosisRows(dbHelpers, patientId);
    return diagnoses.filter((diagnosis) => diagnosisMatchesTarget(diagnosis, payload));
}

async function clearOdontogramDiagnosisWithDbHelpers(dbHelpers, patientId, payload = {}) {
    await ensureOdontogramSchema(dbHelpers);
    await backfillPlanDiagnosisRelationsWithDbHelpers(dbHelpers, patientId);

    const targetDiagnoses = await findTargetDiagnoses(dbHelpers, patientId, payload);
    if (!targetDiagnoses.length) {
        return {
            ok: true,
            blocked: false,
            removedDiagnosisIds: [],
            removedPlanIds: [],
            detachedPlanIds: [],
            message: 'No se encontro un padecimiento activo para eliminar.',
        };
    }

    const diagnosisIds = uniqueNumbers(targetDiagnoses.map((diagnosis) => diagnosis.id));
    const placeholders = diagnosisIds.map(() => '?').join(', ');
    const relatedPlans = diagnosisIds.length
        ? await dbHelpers.all(
            `SELECT DISTINCT
                pt.id,
                pt.estado,
                pt.diente,
                pt.caras
             FROM planes_tratamiento pt
             JOIN planes_tratamiento_diagnosticos rel
               ON rel.plan_id = pt.id
             WHERE rel.diagnostico_id IN (${placeholders})`,
            diagnosisIds
        )
        : [];

    const planPolicies = [];
    for (const plan of relatedPlans) {
        const financialImpact = await getPlanFinancialImpact(dbHelpers, plan.id);
        const paymentCount = financialImpact.paymentCount;
        const policy = classifyPlanCleanup(plan, paymentCount);
        planPolicies.push({
            plan,
            paymentCount,
            financialImpact,
            ...policy,
        });
    }

    const blockingPlan = planPolicies.find((policy) => policy.mode === 'block');
    if (blockingPlan) {
        return {
            ok: false,
            blocked: true,
            removedDiagnosisIds: [],
            removedPlanIds: [],
            detachedPlanIds: [],
            message: blockingPlan.message,
            planId: blockingPlan.plan.id,
            planStatus: normalizePlanStatus(blockingPlan.plan.estado),
            requiresCancellation: true,
            paymentCount: blockingPlan.paymentCount,
            financialImpact: blockingPlan.financialImpact,
        };
    }

    const removedPlanIds = [];
    const detachedPlanIds = [];

    for (const planPolicy of planPolicies) {
        await dbHelpers.run(
            `DELETE FROM planes_tratamiento_diagnosticos
             WHERE plan_id = ?
               AND diagnostico_id IN (${placeholders})`,
            [planPolicy.plan.id, ...diagnosisIds]
        );

        const remaining = await dbHelpers.get(
            'SELECT COUNT(*) AS total FROM planes_tratamiento_diagnosticos WHERE plan_id = ?',
            [planPolicy.plan.id]
        );

        if (planPolicy.mode === 'detach') {
            detachedPlanIds.push(Number(planPolicy.plan.id));
            continue;
        }

        if (Number(remaining?.total || 0) > 0) {
            detachedPlanIds.push(Number(planPolicy.plan.id));
            continue;
        }

        await deletePlanTree(dbHelpers, planPolicy.plan.id);
        removedPlanIds.push(Number(planPolicy.plan.id));
    }

    await dbHelpers.run(
        `DELETE FROM tratamientos
         WHERE id IN (${placeholders})`,
        diagnosisIds
    );

    let message = 'Se elimino el padecimiento del odontograma y de la tabla clinica.';
    if (removedPlanIds.length) {
        message = 'Se elimino el padecimiento del odontograma, de la tabla y del plan de tratamiento.';
    } else if (detachedPlanIds.length) {
        message = 'Se elimino el padecimiento del odontograma y de la tabla clinica. El plan cancelado quedo desacoplado para conservar el historial.';
    }

    return {
        ok: true,
        blocked: false,
        removedDiagnosisIds: diagnosisIds,
        removedPlanIds,
        detachedPlanIds,
        message,
    };
}

async function clearOdontogramDiagnosis(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = Number(payload.paciente_id || 0);
    if (!patientId) throw new Error('Paciente invalido para limpiar diagnostico');

    return withTransaction(dbHelpers, async () => clearOdontogramDiagnosisWithDbHelpers(dbHelpers, patientId, payload));
}

async function saveOdontogramDiagnosis(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = Number(payload.paciente_id || 0);
    const tooth = normalizeTooth(payload.tooth);
    const face = normalizeFace(payload.face);
    const dxId = String(payload.dx_id || '').trim();
    const dxName = String(payload.dx_name || '').trim();
    const target = normalizeText(payload.target || (face ? 'face' : 'tooth')) || 'face';

    if (!patientId) throw new Error('Paciente invalido para guardar diagnostico');
    if (!tooth) throw new Error('Diente invalido para guardar diagnostico');
    if (!dxId || !dxName) throw new Error('Diagnostico invalido');
    if (target === 'face' && !face) throw new Error('Cara invalida para guardar diagnostico');

    return withTransaction(dbHelpers, async () => {
        await ensureOdontogramSchema(dbHelpers);

        const existingDiagnoses = await findTargetDiagnoses(dbHelpers, patientId, {
            tooth,
            face,
            mode: target === 'tooth' ? 'tooth' : 'face',
        });

        if (existingDiagnoses.length) {
            const clearResult = await clearOdontogramDiagnosisWithDbHelpers(dbHelpers, patientId, {
                paciente_id: patientId,
                diagnosisIds: existingDiagnoses.map((diagnosis) => diagnosis.id),
                mode: target === 'tooth' ? 'tooth' : 'face',
            });
            if (!clearResult.ok) return clearResult;
        }

        const uid = payload.dx_uid || randomUUID();
        const note = `DX:${JSON.stringify({
            type: 'diagnosis',
            dxId,
            face: face || null,
            uid,
        })}`;

        const insert = await dbHelpers.run(
            `INSERT INTO tratamientos
             (paciente_id, diente, procedimiento, costo, notas, fecha, registro_tipo, dx_uid, dx_id, dx_face)
             VALUES (?, ?, ?, 0, ?, datetime('now'), 'diagnostico', ?, ?, ?)`,
            [patientId, tooth, dxName, note, uid, dxId, face]
        );

        return {
            ok: true,
            blocked: false,
            message: 'Diagnostico guardado correctamente.',
            diagnosis: {
                id: Number(insert.lastID),
                paciente_id: patientId,
                tooth,
                face: face || null,
                dx_id: dxId,
                dx_uid: uid,
                procedimiento: dxName,
            },
        };
    });
}

module.exports = {
    AUTO_DELETE_PLAN_STATES,
    DETACH_ONLY_PLAN_STATES,
    PROTECTED_PLAN_STATES,
    normalizePlanStatus,
    createDbHelpers,
    ensureOdontogramSchema,
    listPatientDiagnosisRows,
    syncPlanDiagnosisRelationsWithDbHelpers,
    saveOdontogramDiagnosis,
    clearOdontogramDiagnosis,
};
