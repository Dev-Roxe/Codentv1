const { sendEmail } = require('./google/gmail-service');

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function clampMoney(value, min = 0, max = Number.POSITIVE_INFINITY) {
    return Math.min(max, Math.max(min, roundMoney(value)));
}

function formatDate(date) {
    const d = date instanceof Date ? date : new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

function addFrequency(baseDate, frequency, index = 0) {
    const date = new Date(`${formatDate(baseDate)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;

    switch (frequency) {
        case 'semanal':
            date.setDate(date.getDate() + (7 * index));
            break;
        case 'quincenal':
            date.setDate(date.getDate() + (15 * index));
            break;
        case 'mensual':
            date.setMonth(date.getMonth() + index);
            break;
        case 'semestral':
            date.setMonth(date.getMonth() + (6 * index));
            break;
        default:
            throw new Error(`Frecuencia no soportada: ${frequency}`);
    }

    return formatDate(date);
}

function buildSimulatedInvoiceFolio(invoiceId, issuedAt = new Date()) {
    const d = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
    const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
    const yyyymmdd = safeDate.toISOString().slice(0, 10).replace(/-/g, '');
    return `FS-${yyyymmdd}-${String(Number(invoiceId) || 0).padStart(6, '0')}`;
}

function deriveInstallmentStatus({ montoProgramado, montoPagado }) {
    const due = roundMoney(montoProgramado);
    const paid = roundMoney(montoPagado);
    if (paid <= 0) return 'pendiente';
    if (paid >= due) return 'pagada';
    return 'parcial';
}

function calculateDiscount(baseTotal, discountType = 'ninguno', discountValue = 0) {
    const safeBase = roundMoney(baseTotal);
    const safeValue = roundMoney(discountValue);
    if (!safeBase || safeValue <= 0 || discountType === 'ninguno') return 0;

    if (discountType === 'porcentaje') {
        return clampMoney((safeBase * safeValue) / 100, 0, safeBase);
    }

    if (discountType === 'monto_fijo') {
        return clampMoney(safeValue, 0, safeBase);
    }

    throw new Error(`Tipo de descuento no soportado: ${discountType}`);
}

function calculateTax(baseNetTotal, taxType = 'ninguno', taxValue = 0) {
    const safeBase = roundMoney(baseNetTotal);
    const safeValue = roundMoney(taxValue);
    if (!safeBase || safeValue <= 0 || taxType === 'ninguno') return 0;

    if (taxType === 'porcentaje') {
        return clampMoney((safeBase * safeValue) / 100, 0);
    }

    if (taxType === 'monto_fijo') {
        return clampMoney(safeValue, 0);
    }

    throw new Error(`Tipo de impuesto no soportado: ${taxType}`);
}

function computePlanFinancials({
    costoBase = 0,
    costoMedicina = 0,
    costoMiscelanea = 0,
    discountType = 'ninguno',
    discountValue = 0,
    taxType = 'ninguno',
    taxValue = 0,
}) {
    const costo_total = roundMoney(costoBase) + roundMoney(costoMedicina) + roundMoney(costoMiscelanea);
    const descuento_monto = calculateDiscount(costo_total, discountType, discountValue);
    const subtotal_neto = clampMoney(costo_total - descuento_monto, 0);
    const impuesto_monto = calculateTax(subtotal_neto, taxType, taxValue);
    const total_final = clampMoney(subtotal_neto + impuesto_monto, 0);

    return {
        costo_total: roundMoney(costo_total),
        descuento_tipo: discountType || 'ninguno',
        descuento_valor: roundMoney(discountValue),
        descuento_monto: roundMoney(descuento_monto),
        subtotal_neto: roundMoney(subtotal_neto),
        impuesto_tipo: taxType || 'ninguno',
        impuesto_valor: roundMoney(taxValue),
        impuesto_monto: roundMoney(impuesto_monto),
        total_final,
    };
}

const VALID_PLAN_FACES = new Set(['oclusal', 'mesial', 'distal', 'vestibular', 'lingual']);

function normalizePlanTooth(value) {
    const tooth = String(value || '').trim();
    return tooth || null;
}

function normalizePlanFaces(value) {
    let faces = [];

    if (Array.isArray(value)) {
        faces = value;
    } else if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            faces = Array.isArray(parsed) ? parsed : raw.split(',');
        } catch (e) {
            faces = raw.split(',');
        }
    }

    return [...new Set(
        faces
            .map(face => String(face || '').trim().toLowerCase())
            .filter(face => VALID_PLAN_FACES.has(face))
    )];
}

function serializePlanFaces(value) {
    const faces = normalizePlanFaces(value);
    return faces.length ? JSON.stringify(faces) : null;
}

function parsePositiveInt(value) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : null;
}

function resolveUserId(payload = {}) {
    const candidates = [
        payload.usuario_id,
        payload.user_id,
        payload.id_usuario,
        payload.usuarioId,
        payload.userId,
        payload.usuario?.id,
        payload.user?.id,
    ];

    for (const candidate of candidates) {
        const userId = parsePositiveInt(candidate);
        if (userId) return userId;
    }

    return null;
}

async function ensureTreatmentPlanSchema(dbHelpers) {
    const rows = await dbHelpers.all('PRAGMA table_info(planes_tratamiento)');
    const columns = new Set((rows || []).map(row => row?.name).filter(Boolean));

    const requiredColumns = [
        ['diente', 'TEXT'],
        ['caras', 'TEXT'],
        ['subtotal_neto', 'REAL DEFAULT 0.0'],
        ['impuesto_tipo', "TEXT DEFAULT 'ninguno'"],
        ['impuesto_valor', 'REAL DEFAULT 0.0'],
        ['impuesto_monto', 'REAL DEFAULT 0.0'],
        ['version_comercial', 'INTEGER DEFAULT 1'],
        ['version_actualizada_en', 'DATETIME'],
    ];

    for (const [name, definition] of requiredColumns) {
        if (columns.has(name)) continue;
        await dbHelpers.run(`ALTER TABLE planes_tratamiento ADD COLUMN ${name} ${definition}`);
        columns.add(name);
    }

    await dbHelpers.run(
        `CREATE TABLE IF NOT EXISTS planes_tratamiento_versiones (
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
        )`
    );
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_versiones_plan_version ON planes_tratamiento_versiones(plan_tratamiento_id, version_num)');
    await dbHelpers.run("CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_versiones_estado ON planes_tratamiento_versiones(estado_version)");

    return columns;
}

function buildInstallmentSchedule({
    totalFinal,
    downPayment = 0,
    installmentCount = 0,
    frequency = 'mensual',
    interestPercent = 0,
    startDate,
    firstDueDate,
}) {
    const safeTotal = roundMoney(totalFinal);
    const anticipo = clampMoney(downPayment, 0, safeTotal);
    const schedule = [];
    const baseStartDate = formatDate(startDate) || formatDate(new Date());
    const firstDue = formatDate(firstDueDate) || baseStartDate;
    let nextNumber = 1;

    if (anticipo > 0) {
        schedule.push({
            numero: nextNumber++,
            es_anticipo: 1,
            fecha_vencimiento: baseStartDate,
            monto_programado: anticipo,
        });
    }

    const financedBase = clampMoney(safeTotal - anticipo, 0);
    if (financedBase <= 0) {
        return {
            totalFinanciadoBase: 0,
            totalFinanciadoConInteres: 0,
            cuotas: schedule,
        };
    }

    const safeInstallmentCount = Number(installmentCount || 0);
    if (!safeInstallmentCount || safeInstallmentCount < 1) {
        throw new Error('El financiamiento requiere al menos una cuota');
    }

    const totalWithInterest = clampMoney(financedBase * (1 + ((Number(interestPercent) || 0) / 100)), 0);
    const baseInstallmentAmount = roundMoney(totalWithInterest / safeInstallmentCount);
    let distributed = 0;

    for (let index = 0; index < safeInstallmentCount; index += 1) {
        const isLast = index === safeInstallmentCount - 1;
        const monto = isLast
            ? clampMoney(totalWithInterest - distributed, 0)
            : baseInstallmentAmount;
        distributed = roundMoney(distributed + monto);
        schedule.push({
            numero: nextNumber++,
            es_anticipo: 0,
            fecha_vencimiento: addFrequency(firstDue, frequency, index),
            monto_programado: monto,
        });
    }

    return {
        totalFinanciadoBase: financedBase,
        totalFinanciadoConInteres: totalWithInterest,
        cuotas: schedule,
    };
}

function applyAmountToInstallments(installments, amount, preferredInstallmentId = null) {
    const rows = (installments || []).map(item => ({
        ...item,
        monto_programado: roundMoney(item.monto_programado),
        monto_pagado: roundMoney(item.monto_pagado),
    }));
    let remaining = clampMoney(amount, 0);
    const allocations = [];

    const sorted = rows.sort((left, right) => {
        if (preferredInstallmentId) {
            if (left.id === preferredInstallmentId) return -1;
            if (right.id === preferredInstallmentId) return 1;
        }
        const leftDue = formatDate(left.fecha_vencimiento) || '9999-12-31';
        const rightDue = formatDate(right.fecha_vencimiento) || '9999-12-31';
        if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
        return Number(left.numero || 0) - Number(right.numero || 0);
    });

    for (const installment of sorted) {
        if (remaining <= 0) break;
        const due = clampMoney(installment.monto_programado - installment.monto_pagado, 0);
        if (due <= 0) continue;

        const applied = clampMoney(Math.min(due, remaining), 0, due);
        if (applied <= 0) continue;

        installment.monto_pagado = roundMoney(installment.monto_pagado + applied);
        installment.estado = deriveInstallmentStatus({
            montoProgramado: installment.monto_programado,
            montoPagado: installment.monto_pagado,
        });
        remaining = roundMoney(remaining - applied);
        allocations.push({ cuotaId: installment.id, monto: applied });
    }

    return { installments: rows, allocations, remaining };
}

function reverseAmountFromInstallments(installments, amount) {
    const rows = (installments || []).map(item => ({
        ...item,
        monto_programado: roundMoney(item.monto_programado),
        monto_pagado: roundMoney(item.monto_pagado),
    }));
    let remaining = clampMoney(amount, 0);
    const allocations = [];

    const sorted = rows
        .filter(item => roundMoney(item.monto_pagado) > 0)
        .sort((left, right) => {
            const leftPaidAt = left.fecha_ultimo_pago || left.fecha_vencimiento || '0000-00-00';
            const rightPaidAt = right.fecha_ultimo_pago || right.fecha_vencimiento || '0000-00-00';
            if (leftPaidAt !== rightPaidAt) return rightPaidAt.localeCompare(leftPaidAt);
            return Number(right.numero || 0) - Number(left.numero || 0);
        });

    for (const installment of sorted) {
        if (remaining <= 0) break;
        const reversible = clampMoney(Math.min(installment.monto_pagado, remaining), 0, installment.monto_pagado);
        if (reversible <= 0) continue;

        installment.monto_pagado = roundMoney(installment.monto_pagado - reversible);
        installment.estado = deriveInstallmentStatus({
            montoProgramado: installment.monto_programado,
            montoPagado: installment.monto_pagado,
        });
        remaining = roundMoney(remaining - reversible);
        allocations.push({ cuotaId: installment.id, monto: -reversible });
    }

    return { installments: rows, allocations, remaining };
}

function createDbHelpers(db) {
    return {
        run(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.run(sql, params, function onRun(err) {
                    if (err) return reject(err);
                    resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        },
        get(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
            });
        },
        all(sql, params = []) {
            return new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            });
        },
    };
}

async function withTransaction(dbHelpers, callback) {
    await dbHelpers.run('BEGIN IMMEDIATE');
    try {
        const result = await callback();
        await dbHelpers.run('COMMIT');
        return result;
    } catch (error) {
        try {
            await dbHelpers.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('ROLLBACK failed', rollbackError);
        }
        throw error;
    }
}

async function recordAudit(dbHelpers, { userId = null, action, entity, entityId = null, payload = null }) {
    await dbHelpers.run(
        `INSERT INTO auditoria_financiera (usuario_id, accion, entidad, entidad_id, payload)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, action, entity, entityId, payload ? JSON.stringify(payload) : null]
    );
}

async function getOpenCajaByUser(dbHelpers, userId) {
    if (!userId) return null;
    const row = await dbHelpers.get(
        `SELECT id
         FROM cajas
         WHERE usuario_id = ? AND estado = 'abierta'
         ORDER BY fecha_apertura DESC
         LIMIT 1`,
        [userId]
    );
    return row?.id || null;
}

async function getTreatmentCatalogPricing(dbHelpers, catalogId) {
    const row = await dbHelpers.get(
        `SELECT id, nombre, costo_base, costo_medicina_estandar, costo_miscelanea_estandar
         FROM tratamientos_catalogo
         WHERE id = ?`,
        [catalogId]
    );
    if (!row) throw new Error('Tratamiento no válido');
    return row;
}

async function getNetPaidForPlan(dbHelpers, planId) {
    const row = await dbHelpers.get(
        `SELECT
            COALESCE(SUM(
                CASE
                    WHEN estado != 'aplicado' THEN 0
                    WHEN tipo = 'devolucion' THEN -monto
                    ELSE monto
                END
            ), 0) AS neto_pagado
         FROM pagos
         WHERE plan_tratamiento_id = ?`,
        [planId]
    );
    return roundMoney(row?.neto_pagado || 0);
}

async function getPlanInstallments(dbHelpers, planId) {
    return dbHelpers.all(
        `SELECT *
         FROM cuotas_financiamiento
         WHERE plan_tratamiento_id = ?
         ORDER BY date(fecha_vencimiento) ASC, numero ASC, id ASC`,
        [planId]
    );
}

async function getSimulatedInvoiceById(dbHelpers, invoiceId) {
    return dbHelpers.get(
        `SELECT
            fs.*,
            p.fecha AS pago_fecha,
            p.descripcion AS pago_descripcion
         FROM facturas_simuladas fs
         LEFT JOIN pagos p ON p.id = fs.pago_id
         WHERE fs.id = ?`,
        [invoiceId]
    );
}

async function findActiveSimulatedInvoiceByPayment(dbHelpers, paymentId) {
    if (!paymentId) return null;
    return dbHelpers.get(
        `SELECT *
         FROM facturas_simuladas
         WHERE pago_id = ?
           AND estado = 'emitida'
         ORDER BY id DESC
         LIMIT 1`,
        [paymentId]
    );
}

async function createSimulatedInvoice(dbHelpers, payload = {}) {
    const patientId = Number(payload.paciente_id || 0);
    const paymentId = payload.pago_id ? Number(payload.pago_id) : null;
    const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;
    const userId = payload.creado_por ? Number(payload.creado_por) : null;

    if (!patientId) throw new Error('Paciente invalido para comprobante');
    if (!paymentId && !planId) throw new Error('Debe asociar el comprobante a un pago o plan');

    if (paymentId) {
        const existing = await findActiveSimulatedInvoiceByPayment(dbHelpers, paymentId);
        if (existing) {
            return getSimulatedInvoiceById(dbHelpers, existing.id);
        }
    }

    const subtotal = clampMoney(payload.subtotal != null ? payload.subtotal : payload.total, 0);
    const descuento = clampMoney(payload.descuento, 0, subtotal);
    const impuesto = clampMoney(payload.impuesto, 0);
    const total = clampMoney(payload.total != null ? payload.total : (subtotal - descuento + impuesto), 0);
    const now = new Date();
    const tempFolio = `TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const inserted = await dbHelpers.run(
        `INSERT INTO facturas_simuladas
         (folio, fecha_emision, paciente_id, plan_tratamiento_id, pago_id, tipo, estado, moneda, subtotal, descuento, impuesto, total, metodo_pago, concepto, observaciones, creado_por, fecha_actualizacion)
         VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'emitida', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            tempFolio,
            patientId,
            planId,
            paymentId,
            payload.tipo || 'comprobante_pago',
            payload.moneda || 'MXN',
            subtotal,
            descuento,
            impuesto,
            total,
            payload.metodo_pago || null,
            payload.concepto || 'Comprobante interno',
            payload.observaciones || null,
            userId,
        ]
    );

    const finalFolio = buildSimulatedInvoiceFolio(inserted.lastID, now);
    await dbHelpers.run(
        `UPDATE facturas_simuladas
         SET folio = ?, fecha_actualizacion = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [finalFolio, inserted.lastID]
    );

    return getSimulatedInvoiceById(dbHelpers, inserted.lastID);
}

async function persistInstallments(dbHelpers, installments) {
    for (const installment of installments) {
        await dbHelpers.run(
            `UPDATE cuotas_financiamiento
             SET monto_pagado = ?, estado = ?, fecha_ultimo_pago = CASE WHEN ? > 0 THEN CURRENT_TIMESTAMP ELSE fecha_ultimo_pago END
             WHERE id = ?`,
            [
                roundMoney(installment.monto_pagado),
                installment.estado,
                roundMoney(installment.monto_pagado),
                installment.id,
            ]
        );
    }
}

async function recordPlanCommercialVersion(dbHelpers, {
    planId,
    versionNum,
    totals,
    planTooth = null,
    planFaces = null,
    notes = null,
    financing = null,
    userId = null,
    reason = null,
    snapshot = null,
}) {
    if (!planId || !versionNum || !totals) return;

    await dbHelpers.run(
        `UPDATE planes_tratamiento_versiones
         SET estado_version = 'reemplazada'
         WHERE plan_tratamiento_id = ?
           AND estado_version = 'vigente'`,
        [planId]
    );

    await dbHelpers.run(
        `INSERT INTO planes_tratamiento_versiones
         (
            plan_tratamiento_id,
            version_num,
            estado_version,
            motivo_cambio,
            costo_total,
            descuento_tipo,
            descuento_valor,
            descuento_monto,
            subtotal_neto,
            impuesto_tipo,
            impuesto_valor,
            impuesto_monto,
            total_final,
            diente,
            caras,
            notas,
            financiamiento_json,
            snapshot_json,
            creado_por
         )
         VALUES (?, ?, 'vigente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            planId,
            versionNum,
            reason || null,
            roundMoney(totals.costo_total || 0),
            totals.descuento_tipo || 'ninguno',
            roundMoney(totals.descuento_valor || 0),
            roundMoney(totals.descuento_monto || 0),
            roundMoney(totals.subtotal_neto || 0),
            totals.impuesto_tipo || 'ninguno',
            roundMoney(totals.impuesto_valor || 0),
            roundMoney(totals.impuesto_monto || 0),
            roundMoney(totals.total_final || 0),
            planTooth,
            planFaces,
            notes || null,
            financing ? JSON.stringify(financing) : null,
            snapshot ? JSON.stringify(snapshot) : null,
            userId ? Number(userId) : null,
        ]
    );
}

async function upsertFinancingForPlan(dbHelpers, {
    planId,
    financing,
    planStartDate,
    totalFinal,
    currentNetPaid = 0,
}) {
    const currentFinancing = await dbHelpers.get(
        `SELECT id FROM planes_financiamiento WHERE plan_tratamiento_id = ?`,
        [planId]
    );

    if (!financing || !financing.enabled) {
        if (currentFinancing && currentNetPaid > 0) {
            throw new Error('No se puede eliminar el financiamiento de un plan con pagos aplicados');
        }
        if (currentFinancing) {
            await dbHelpers.run('DELETE FROM planes_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
        }
        return null;
    }

    if (currentFinancing && currentNetPaid > 0) {
        throw new Error('No se puede redefinir el calendario de cuotas de un plan con pagos aplicados');
    }

    const frequency = financing.frequency || 'mensual';
    const installmentCount = Number(financing.installmentCount || 0);
    const downPayment = roundMoney(financing.downPayment || 0);
    const interestPercent = roundMoney(financing.interestPercent || 0);
    const firstDueDate = financing.firstDueDate || planStartDate || formatDate(new Date());

    const schedule = buildInstallmentSchedule({
        totalFinal,
        downPayment,
        installmentCount,
        frequency,
        interestPercent,
        startDate: planStartDate || formatDate(new Date()),
        firstDueDate,
    });

    if (currentFinancing) {
        await dbHelpers.run('DELETE FROM planes_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
    }

    const inserted = await dbHelpers.run(
        `INSERT INTO planes_financiamiento
         (plan_tratamiento_id, frecuencia, numero_cuotas, anticipo, interes_porcentaje, fecha_primer_vencimiento, activo, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [planId, frequency, installmentCount, downPayment, interestPercent, firstDueDate]
    );

    for (const quota of schedule.cuotas) {
        await dbHelpers.run(
            `INSERT INTO cuotas_financiamiento
             (plan_financiamiento_id, plan_tratamiento_id, numero, es_anticipo, fecha_vencimiento, monto_programado, monto_pagado, estado)
             VALUES (?, ?, ?, ?, ?, ?, 0, 'pendiente')`,
            [
                inserted.lastID,
                planId,
                quota.numero,
                quota.es_anticipo,
                quota.fecha_vencimiento,
                quota.monto_programado,
            ]
        );
    }

    return {
        financingId: inserted.lastID,
        schedule,
    };
}

async function getTreatmentPlanDetail(db, planId) {
    const dbHelpers = createDbHelpers(db);
    const plan = await dbHelpers.get(
        `SELECT
            pt.*,
            tc.nombre AS tratamiento_nombre,
            tc.descripcion AS tratamiento_descripcion
         FROM planes_tratamiento pt
         JOIN tratamientos_catalogo tc ON tc.id = pt.catalogo_id
         WHERE pt.id = ?`,
        [planId]
    );

    if (!plan) return null;

    const financing = await dbHelpers.get(
        `SELECT * FROM planes_financiamiento WHERE plan_tratamiento_id = ?`,
        [planId]
    );
    const installments = financing ? await getPlanInstallments(dbHelpers, planId) : [];
    const normalizedInstallments = installments.map(item => {
        const pendingAmount = clampMoney(item.monto_programado - item.monto_pagado, 0);
        const dueDate = formatDate(item.fecha_vencimiento);
        const isOverdue = !!(dueDate && dueDate < formatDate(new Date()) && pendingAmount > 0);
        return {
            ...item,
            saldo_pendiente: pendingAmount,
            esta_vencida: isOverdue,
            estado_visual: isOverdue ? 'vencida' : item.estado,
        };
    });
    const simulatedInvoices = await dbHelpers.all(
        `SELECT
            id,
            folio,
            fecha_emision,
            total,
            metodo_pago,
            concepto,
            pago_id,
            tipo
         FROM facturas_simuladas
         WHERE plan_tratamiento_id = ?
           AND estado = 'emitida'
         ORDER BY datetime(fecha_emision) DESC, id DESC`,
        [planId]
    );
    const commercialVersions = await dbHelpers.all(
        `SELECT
            v.id,
            v.version_num,
            v.estado_version,
            v.motivo_cambio,
            v.costo_total,
            v.descuento_tipo,
            v.descuento_valor,
            v.descuento_monto,
            v.subtotal_neto,
            v.impuesto_tipo,
            v.impuesto_valor,
            v.impuesto_monto,
            v.total_final,
            v.fecha_creacion,
            v.creado_por,
            COALESCE(
                NULLIF(
                    TRIM(
                        COALESCE(u.nombre, '') || ' ' ||
                        COALESCE(u.apellido, COALESCE(u.apellidos, ''))
                    ),
                    ''
                ),
                u.email,
                'Sistema'
            ) AS usuario_nombre
         FROM planes_tratamiento_versiones v
         LEFT JOIN usuarios u ON u.id = v.creado_por
         WHERE v.plan_tratamiento_id = ?
         ORDER BY version_num DESC
         LIMIT 20`,
        [planId]
    );
    const netPaid = await getNetPaidForPlan(dbHelpers, planId);
    const totalFinal = roundMoney(plan.total_final || plan.costo_total || 0);
    const pending = clampMoney(totalFinal - netPaid, 0);

    return {
        ...plan,
        total_final: totalFinal,
        financing: financing ? {
            ...financing,
            installments: normalizedInstallments,
        } : null,
        simulated_invoices: simulatedInvoices,
        commercial_versions: commercialVersions,
        financial_summary: {
            subtotal_neto: roundMoney(plan.subtotal_neto || (plan.costo_total - (plan.descuento_monto || 0) || 0)),
            impuesto_monto: roundMoney(plan.impuesto_monto || 0),
            total_final: totalFinal,
            net_paid: netPaid,
            pending,
        },
    };
}

async function saveTreatmentPlan(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

    return withTransaction(dbHelpers, async () => {
        const taxType = payload.impuesto_tipo || 'ninguno';
        const taxValue = payload.impuesto_valor || 0;
        const catalog = await getTreatmentCatalogPricing(dbHelpers, payload.catalogo_id);
        const totals = computePlanFinancials({
            costoBase: catalog.costo_base,
            costoMedicina: catalog.costo_medicina_estandar,
            costoMiscelanea: catalog.costo_miscelanea_estandar,
            discountType: payload.descuento_tipo || 'ninguno',
            discountValue: payload.descuento_valor || 0,
            taxType,
            taxValue,
        });
        const planTooth = normalizePlanTooth(payload.diente);
        const planFaces = serializePlanFaces(payload.caras);

        let planId = Number(payload.id || 0);
        let currentNetPaid = 0;
        let versionNum = 1;

        if (planId) {
            const currentPlan = await dbHelpers.get(
                `SELECT id, version_comercial
                 FROM planes_tratamiento
                 WHERE id = ?`,
                [planId]
            );
            if (!currentPlan) {
                throw new Error('Plan de tratamiento no encontrado');
            }

            currentNetPaid = await getNetPaidForPlan(dbHelpers, planId);
            if (totals.total_final < currentNetPaid) {
                throw new Error('El total final no puede quedar por debajo de lo ya pagado');
            }

            versionNum = Math.max(1, Number(currentPlan.version_comercial || 1) + 1);

            await dbHelpers.run(
                `UPDATE planes_tratamiento
                 SET catalogo_id = ?, especialista_asignado = ?, notas = ?, fecha_inicio = ?,
                     costo_total = ?, descuento_tipo = ?, descuento_valor = ?, descuento_monto = ?,
                     subtotal_neto = ?, impuesto_tipo = ?, impuesto_valor = ?, impuesto_monto = ?, total_final = ?,
                     version_comercial = ?, version_actualizada_en = CURRENT_TIMESTAMP, diente = ?, caras = ?
                 WHERE id = ?`,
                [
                    payload.catalogo_id,
                    payload.especialista_asignado || '',
                    payload.notas || '',
                    payload.fecha_inicio || null,
                    totals.costo_total,
                    totals.descuento_tipo,
                    totals.descuento_valor,
                    totals.descuento_monto,
                    totals.subtotal_neto,
                    totals.impuesto_tipo,
                    totals.impuesto_valor,
                    totals.impuesto_monto,
                    totals.total_final,
                    versionNum,
                    planTooth,
                    planFaces,
                    planId,
                ]
            );
        } else {
            const insert = await dbHelpers.run(
                `INSERT INTO planes_tratamiento
                 (
                    paciente_id,
                    catalogo_id,
                    especialista_asignado,
                    notas,
                    fecha_inicio,
                    costo_total,
                    descuento_tipo,
                    descuento_valor,
                    descuento_monto,
                    subtotal_neto,
                    impuesto_tipo,
                    impuesto_valor,
                    impuesto_monto,
                    total_final,
                    version_comercial,
                    version_actualizada_en,
                    diente,
                    caras,
                    estado
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, 'pendiente')`,
                [
                    payload.paciente_id,
                    payload.catalogo_id,
                    payload.especialista_asignado || '',
                    payload.notas || '',
                    payload.fecha_inicio || null,
                    totals.costo_total,
                    totals.descuento_tipo,
                    totals.descuento_valor,
                    totals.descuento_monto,
                    totals.subtotal_neto,
                    totals.impuesto_tipo,
                    totals.impuesto_valor,
                    totals.impuesto_monto,
                    totals.total_final,
                    planTooth,
                    planFaces,
                ]
            );
            planId = insert.lastID;
            versionNum = 1;
        }

        await upsertFinancingForPlan(dbHelpers, {
            planId,
            financing: payload.financing,
            planStartDate: payload.fecha_inicio || formatDate(new Date()),
            totalFinal: totals.total_final,
            currentNetPaid,
        });

        await recordPlanCommercialVersion(dbHelpers, {
            planId,
            versionNum,
            totals,
            planTooth,
            planFaces,
            notes: payload.notas || '',
            financing: payload.financing || null,
            userId: resolveUserId(payload) || null,
            reason: payload.version_reason || (payload.id ? 'actualizacion_comercial' : 'creacion_plan'),
            snapshot: {
                paciente_id: payload.paciente_id || null,
                catalogo_id: payload.catalogo_id,
                especialista_asignado: payload.especialista_asignado || '',
                fecha_inicio: payload.fecha_inicio || null,
                diente: planTooth,
                caras: normalizePlanFaces(payload.caras),
            },
        });

        await recordAudit(dbHelpers, {
            userId: resolveUserId(payload),
            action: payload.id ? 'actualizar_plan' : 'crear_plan',
            entity: 'plan_tratamiento',
            entityId: planId,
            payload: {
                catalogo_id: payload.catalogo_id,
                total_final: totals.total_final,
                descuento_monto: totals.descuento_monto,
                impuesto_monto: totals.impuesto_monto,
                version_comercial: versionNum,
                diente: planTooth,
                caras: normalizePlanFaces(payload.caras),
                financing: payload.financing || null,
            },
        });

        return getTreatmentPlanDetail(db, planId);
    });
}

async function getPatientFinancialSummary(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    const summaryRow = await dbHelpers.get(
        `SELECT
            COALESCE(SUM(CASE WHEN estado = 'aplicado' AND tipo = 'pago' THEN monto ELSE 0 END), 0) AS total_pagado,
            COALESCE(SUM(CASE WHEN estado = 'aplicado' AND tipo = 'devolucion' THEN monto ELSE 0 END), 0) AS total_devuelto,
            COUNT(*) AS total_movimientos
         FROM pagos
         WHERE paciente_id = ?`,
        [patientId]
    );

    const plans = await dbHelpers.all(
        `SELECT
            pt.id,
            pt.estado,
            pt.fecha_inicio,
            pt.costo_total,
            pt.total_final,
            pt.subtotal_neto,
            pt.descuento_tipo,
            pt.descuento_valor,
            pt.descuento_monto,
            pt.impuesto_tipo,
            pt.impuesto_valor,
            pt.impuesto_monto,
            pt.version_comercial,
            pt.progreso,
            pt.especialista_asignado,
            tc.nombre AS tratamiento_nombre,
            COALESCE(SUM(
                CASE
                    WHEN p.estado != 'aplicado' THEN 0
                    WHEN p.tipo = 'devolucion' THEN -p.monto
                    ELSE p.monto
                END
            ), 0) AS neto_pagado
         FROM planes_tratamiento pt
         JOIN tratamientos_catalogo tc ON tc.id = pt.catalogo_id
         LEFT JOIN pagos p ON p.plan_tratamiento_id = pt.id
         WHERE pt.paciente_id = ?
         GROUP BY pt.id
         ORDER BY date(COALESCE(pt.fecha_inicio, pt.fecha_creacion)) DESC, pt.id DESC`,
        [patientId]
    );

    const payments = await dbHelpers.all(
        `SELECT
            p.id,
            p.fecha,
            p.monto,
            p.descripcion,
            p.metodo,
            p.tipo,
            p.estado,
            p.plan_tratamiento_id,
            tc.nombre AS tratamiento_nombre,
            fs.id AS factura_simulada_id,
            fs.folio AS factura_folio,
            fs.fecha_emision AS factura_fecha_emision
         FROM pagos p
         LEFT JOIN planes_tratamiento pt ON pt.id = p.plan_tratamiento_id
         LEFT JOIN tratamientos_catalogo tc ON tc.id = pt.catalogo_id
         LEFT JOIN facturas_simuladas fs ON fs.id = (
            SELECT fs2.id
            FROM facturas_simuladas fs2
            WHERE fs2.pago_id = p.id
              AND fs2.estado = 'emitida'
            ORDER BY fs2.id DESC
            LIMIT 1
         )
         WHERE p.paciente_id = ?
         ORDER BY datetime(p.fecha) DESC, p.id DESC`,
        [patientId]
    );

    const installments = await dbHelpers.all(
        `SELECT
            cf.id,
            cf.plan_tratamiento_id,
            cf.numero,
            cf.es_anticipo,
            cf.fecha_vencimiento,
            cf.monto_programado,
            cf.monto_pagado,
            cf.estado,
            pt.estado AS plan_estado,
            tc.nombre AS tratamiento_nombre
         FROM cuotas_financiamiento cf
         JOIN planes_tratamiento pt ON pt.id = cf.plan_tratamiento_id
         JOIN tratamientos_catalogo tc ON tc.id = pt.catalogo_id
         WHERE pt.paciente_id = ?
         ORDER BY date(cf.fecha_vencimiento) ASC, cf.numero ASC`,
        [patientId]
    );

    const totalPlanned = roundMoney(plans.reduce((sum, plan) => sum + roundMoney(plan.total_final || plan.costo_total), 0));
    const totalPaid = roundMoney(summaryRow?.total_pagado || 0);
    const totalRefunded = roundMoney(summaryRow?.total_devuelto || 0);
    const netPaid = roundMoney(totalPaid - totalRefunded);
    const overdueInstallments = installments.filter(item => {
        const pendingAmount = clampMoney(item.monto_programado - item.monto_pagado, 0);
        const dueDate = formatDate(item.fecha_vencimiento);
        return pendingAmount > 0 && dueDate && dueDate < formatDate(new Date());
    });
    const totalOverdue = roundMoney(overdueInstallments.reduce((sum, item) => sum + clampMoney(item.monto_programado - item.monto_pagado, 0), 0));

    return {
        summary: {
            total_planned: totalPlanned,
            total_paid: totalPaid,
            total_refunded: totalRefunded,
            net_paid: netPaid,
            total_pending: clampMoney(totalPlanned - netPaid, 0),
            total_overdue: totalOverdue,
            overdue_count: overdueInstallments.length,
            payment_count: Number(summaryRow?.total_movimientos || 0),
        },
        plans: plans.map(plan => {
            const totalFinal = roundMoney(plan.total_final || plan.costo_total);
            const netPaidPlan = roundMoney(plan.neto_pagado || 0);
            const pending = clampMoney(totalFinal - netPaidPlan, 0);
            const planInstallments = installments.filter(item => Number(item.plan_tratamiento_id) === Number(plan.id));
            const overdueAmount = roundMoney(planInstallments.reduce((sum, item) => {
                const dueDate = formatDate(item.fecha_vencimiento);
                const pendingAmount = clampMoney(item.monto_programado - item.monto_pagado, 0);
                if (!dueDate || dueDate >= formatDate(new Date())) return sum;
                return sum + pendingAmount;
            }, 0));

            return {
                ...plan,
                total_final: totalFinal,
                neto_pagado: netPaidPlan,
                saldo_pendiente: pending,
                monto_vencido: overdueAmount,
                cuotas: planInstallments,
            };
        }),
        payments,
        installments: installments.map(item => ({
            ...item,
            saldo_pendiente: clampMoney(item.monto_programado - item.monto_pagado, 0),
            esta_vencida: !!(formatDate(item.fecha_vencimiento) && formatDate(item.fecha_vencimiento) < formatDate(new Date()) && clampMoney(item.monto_programado - item.monto_pagado, 0) > 0),
        })),
    };
}

async function registerPayment(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);

    return withTransaction(dbHelpers, async () => {
        const patientId = Number(payload.paciente_id || 0);
        const userId = resolveUserId(payload);
        const amount = clampMoney(payload.monto, 0);
        const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;
        const cuotaId = payload.cuota_financiamiento_id ? Number(payload.cuota_financiamiento_id) : null;

        if (!patientId) throw new Error('Paciente inválido');
        if (!userId) throw new Error('Usuario inválido: se requiere usuario_id (o user_id)');
        if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
        if (!payload.metodo) throw new Error('Debe seleccionar un método de pago');

        const cajaId = await getOpenCajaByUser(dbHelpers, userId);
        if (!cajaId) throw new Error('Debe abrir una caja propia para registrar el pago');

        if (planId) {
            const plan = await getTreatmentPlanDetail(db, planId);
            if (!plan) throw new Error('Plan de tratamiento no encontrado');
            if (amount > clampMoney(plan.financial_summary.pending, 0)) {
                throw new Error('El pago excede el saldo pendiente del plan');
            }
        }

        const paymentInsert = await dbHelpers.run(
            `INSERT INTO pagos
             (paciente_id, fecha, monto, descripcion, metodo, plan_tratamiento_id, tipo, estado, usuario_id, caja_id, moneda, referencia_externa)
             VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'pago', 'aplicado', ?, ?, ?, ?)`,
            [
                patientId,
                amount,
                payload.descripcion || null,
                payload.metodo,
                planId,
                userId,
                cajaId,
                payload.moneda || 'MXN',
                payload.referencia_externa || null,
            ]
        );

        const concept = payload.descripcion
            ? `Pago: ${payload.descripcion}`
            : planId
                ? `Pago plan #${planId}`
                : `Pago paciente #${patientId}`;

        await dbHelpers.run(
            `INSERT INTO movimientos_caja
             (caja_id, tipo, monto, concepto, usuario_id, pago_id, paciente_id, metodo, origen)
             VALUES (?, 'ingreso', ?, ?, ?, ?, ?, ?, ?)`,
            [
                cajaId,
                amount,
                concept,
                userId,
                paymentInsert.lastID,
                patientId,
                payload.metodo || null,
                planId ? 'pago_plan' : 'pago_paciente',
            ]
        );

        if (planId) {
            const installments = await getPlanInstallments(dbHelpers, planId);
            if (installments.length) {
                const allocation = applyAmountToInstallments(installments, amount, cuotaId);
                if (allocation.remaining > 0.01) {
                    throw new Error('No se pudo aplicar el pago a las cuotas del plan');
                }

                await persistInstallments(dbHelpers, allocation.installments);

                for (const item of allocation.allocations) {
                    await dbHelpers.run(
                        `INSERT INTO pagos_aplicaciones (pago_id, cuota_financiamiento_id, monto_aplicado)
                         VALUES (?, ?, ?)`,
                        [paymentInsert.lastID, item.cuotaId, item.monto]
                    );
                }
            }
        }

        let simulatedInvoice = null;
        try {
            simulatedInvoice = await createSimulatedInvoice(dbHelpers, {
                paciente_id: patientId,
                plan_tratamiento_id: planId,
                pago_id: paymentInsert.lastID,
                tipo: 'comprobante_pago',
                subtotal: amount,
                descuento: 0,
                impuesto: 0,
                total: amount,
                metodo_pago: payload.metodo,
                concepto: payload.descripcion || (planId ? `Pago de plan #${planId}` : `Pago de tratamiento`),
                observaciones: payload.observaciones || null,
                moneda: payload.moneda || 'MXN',
                creado_por: userId,
            });
        } catch (invoiceError) {
            console.warn('No se pudo generar comprobante interno de pago', invoiceError && invoiceError.message);
        }

        await recordAudit(dbHelpers, {
            userId,
            action: 'registrar_pago',
            entity: 'pago',
            entityId: paymentInsert.lastID,
            payload: {
                paciente_id: patientId,
                plan_tratamiento_id: planId,
                monto: amount,
                metodo: payload.metodo,
            },
        });

        return {
            paymentId: paymentInsert.lastID,
            cajaId,
            simulatedInvoice,
            summary: await getPatientFinancialSummary(db, patientId),
        };
    });
}

async function registerRefund(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);

    return withTransaction(dbHelpers, async () => {
        const patientId = Number(payload.paciente_id || 0);
        const userId = resolveUserId(payload);
        const amount = clampMoney(payload.monto, 0);
        const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;

        if (!patientId) throw new Error('Paciente inválido');
        if (!userId) throw new Error('Usuario inválido: se requiere usuario_id (o user_id)');
        if (amount <= 0) throw new Error('El monto de devolución debe ser mayor a 0');

        const cajaId = await getOpenCajaByUser(dbHelpers, userId);
        if (!cajaId) throw new Error('Debe abrir una caja propia para registrar la devolución');

        if (planId) {
            const planNetPaid = await getNetPaidForPlan(dbHelpers, planId);
            if (amount > planNetPaid) {
                throw new Error('La devolución excede lo pagado en el plan');
            }
        } else {
            const summary = await getPatientFinancialSummary(db, patientId);
            if (amount > summary.summary.net_paid) {
                throw new Error('La devolución excede el neto pagado por el paciente');
            }
        }

        const refundInsert = await dbHelpers.run(
            `INSERT INTO pagos
             (paciente_id, fecha, monto, descripcion, metodo, plan_tratamiento_id, tipo, estado, usuario_id, caja_id, moneda, referencia_externa)
             VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'devolucion', 'aplicado', ?, ?, ?, ?)`,
            [
                patientId,
                amount,
                payload.descripcion || 'Devolución',
                payload.metodo || 'Devolución',
                planId,
                userId,
                cajaId,
                payload.moneda || 'MXN',
                payload.referencia_externa || null,
            ]
        );

        const concept = payload.descripcion
            ? `Devolución: ${payload.descripcion}`
            : planId
                ? `Devolución plan #${planId}`
                : `Devolución paciente #${patientId}`;

        await dbHelpers.run(
            `INSERT INTO movimientos_caja
             (caja_id, tipo, monto, concepto, usuario_id, pago_id, paciente_id, metodo, origen)
             VALUES (?, 'egreso', ?, ?, ?, ?, ?, ?, ?)`,
            [
                cajaId,
                amount,
                concept,
                userId,
                refundInsert.lastID,
                patientId,
                payload.metodo || null,
                planId ? 'devolucion_plan' : 'devolucion_paciente',
            ]
        );

        if (planId) {
            const installments = await getPlanInstallments(dbHelpers, planId);
            if (installments.length) {
                const reversal = reverseAmountFromInstallments(installments, amount);
                if (reversal.remaining > 0.01) {
                    throw new Error('No se pudo revertir la devolución contra las cuotas pagadas');
                }

                await persistInstallments(dbHelpers, reversal.installments);

                for (const item of reversal.allocations) {
                    await dbHelpers.run(
                        `INSERT INTO pagos_aplicaciones (pago_id, cuota_financiamiento_id, monto_aplicado)
                         VALUES (?, ?, ?)`,
                        [refundInsert.lastID, item.cuotaId, item.monto]
                    );
                }
            }
        }

        let simulatedInvoice = null;
        try {
            simulatedInvoice = await createSimulatedInvoice(dbHelpers, {
                paciente_id: patientId,
                plan_tratamiento_id: planId,
                pago_id: refundInsert.lastID,
                tipo: 'comprobante_devolucion',
                subtotal: amount,
                descuento: 0,
                impuesto: 0,
                total: amount,
                metodo_pago: payload.metodo || 'Devolucion',
                concepto: payload.descripcion || (planId ? `Devolucion de plan #${planId}` : 'Devolucion de tratamiento'),
                observaciones: payload.observaciones || null,
                moneda: payload.moneda || 'MXN',
                creado_por: userId,
            });
        } catch (invoiceError) {
            console.warn('No se pudo generar comprobante interno de devolucion', invoiceError && invoiceError.message);
        }

        await recordAudit(dbHelpers, {
            userId,
            action: 'registrar_devolucion',
            entity: 'pago',
            entityId: refundInsert.lastID,
            payload: {
                paciente_id: patientId,
                plan_tratamiento_id: planId,
                monto: amount,
            },
        });

        return {
            refundId: refundInsert.lastID,
            cajaId,
            simulatedInvoice,
            summary: await getPatientFinancialSummary(db, patientId),
        };
    });
}

async function generateSimulatedInvoice(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    return withTransaction(dbHelpers, async () => {
        const paymentId = payload.pago_id ? Number(payload.pago_id) : null;
        const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;
        const userId = resolveUserId(payload);

        if (!paymentId && !planId) {
            throw new Error('Debe indicar un pago o plan para generar comprobante');
        }

        if (paymentId) {
            const payment = await dbHelpers.get(
                `SELECT *
                 FROM pagos
                 WHERE id = ?`,
                [paymentId]
            );
            if (!payment) throw new Error('Pago no encontrado');

            return createSimulatedInvoice(dbHelpers, {
                paciente_id: payment.paciente_id,
                plan_tratamiento_id: payment.plan_tratamiento_id || planId,
                pago_id: payment.id,
                tipo: payload.tipo || (payment.tipo === 'devolucion' ? 'comprobante_devolucion' : 'comprobante_pago'),
                subtotal: roundMoney(payment.monto || 0),
                descuento: clampMoney(payload.descuento, 0),
                impuesto: clampMoney(payload.impuesto, 0),
                total: payload.total != null ? payload.total : roundMoney(payment.monto || 0),
                metodo_pago: payload.metodo_pago || payment.metodo || null,
                concepto: payload.concepto || payment.descripcion || `Movimiento #${payment.id}`,
                observaciones: payload.observaciones || null,
                moneda: payload.moneda || payment.moneda || 'MXN',
                creado_por: userId,
            });
        }

        const plan = await dbHelpers.get(
            `SELECT id, paciente_id, total_final, costo_total
             FROM planes_tratamiento
             WHERE id = ?`,
            [planId]
        );
        if (!plan) throw new Error('Plan de tratamiento no encontrado');

        return createSimulatedInvoice(dbHelpers, {
            paciente_id: plan.paciente_id,
            plan_tratamiento_id: plan.id,
            tipo: payload.tipo || 'comprobante_plan',
            subtotal: roundMoney(payload.subtotal != null ? payload.subtotal : (plan.total_final || plan.costo_total || 0)),
            descuento: clampMoney(payload.descuento, 0),
            impuesto: clampMoney(payload.impuesto, 0),
            total: payload.total != null ? payload.total : roundMoney(plan.total_final || plan.costo_total || 0),
            metodo_pago: payload.metodo_pago || null,
            concepto: payload.concepto || `Comprobante plan #${plan.id}`,
            observaciones: payload.observaciones || null,
            moneda: payload.moneda || 'MXN',
            creado_por: userId,
        });
    });
}

async function getSimulatedInvoices(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const patientId = payload.paciente_id ? Number(payload.paciente_id) : null;
    const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;
    const paymentId = payload.pago_id ? Number(payload.pago_id) : null;

    const where = [];
    const params = [];

    if (patientId) {
        where.push('fs.paciente_id = ?');
        params.push(patientId);
    }
    if (planId) {
        where.push('fs.plan_tratamiento_id = ?');
        params.push(planId);
    }
    if (paymentId) {
        where.push('fs.pago_id = ?');
        params.push(paymentId);
    }

    const sql = `
        SELECT
            fs.*,
            p.fecha AS pago_fecha,
            p.descripcion AS pago_descripcion
        FROM facturas_simuladas fs
        LEFT JOIN pagos p ON p.id = fs.pago_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY datetime(fs.fecha_emision) DESC, fs.id DESC
    `;

    return dbHelpers.all(sql, params);
}

async function getOverdueAccounts(db) {
    const dbHelpers = createDbHelpers(db);
    const rows = await dbHelpers.all(
        `SELECT
            p.id AS paciente_id,
            p.nombre,
            p.apellido,
            p.email,
            p.telefono,
            pt.id AS plan_tratamiento_id,
            tc.nombre AS tratamiento_nombre,
            cf.id AS cuota_financiamiento_id,
            cf.numero,
            cf.es_anticipo,
            cf.fecha_vencimiento,
            cf.monto_programado,
            cf.monto_pagado
         FROM cuotas_financiamiento cf
         JOIN planes_tratamiento pt ON pt.id = cf.plan_tratamiento_id
         JOIN pacientes p ON p.id = pt.paciente_id
         JOIN tratamientos_catalogo tc ON tc.id = pt.catalogo_id
         WHERE date(cf.fecha_vencimiento) < date('now')
           AND round(cf.monto_pagado, 2) < round(cf.monto_programado, 2)
         ORDER BY date(cf.fecha_vencimiento) ASC, p.apellido ASC, p.nombre ASC`
    );

    const morososByPatient = new Map();
    const overdueInstallments = rows.map(row => {
        const overdueAmount = clampMoney(row.monto_programado - row.monto_pagado, 0);
        const entry = {
            ...row,
            monto_vencido: overdueAmount,
            dias_vencido: Math.max(0, Math.floor((Date.now() - new Date(`${row.fecha_vencimiento}T00:00:00`).getTime()) / 86400000)),
        };

        const current = morososByPatient.get(row.paciente_id) || {
            paciente_id: row.paciente_id,
            nombre: row.nombre,
            apellido: row.apellido,
            email: row.email,
            telefono: row.telefono,
            cuotas_vencidas: 0,
            monto_vencido: 0,
        };
        current.cuotas_vencidas += 1;
        current.monto_vencido = roundMoney(current.monto_vencido + overdueAmount);
        morososByPatient.set(row.paciente_id, current);

        return entry;
    });

    return {
        installments: overdueInstallments,
        patients: Array.from(morososByPatient.values()).sort((left, right) => right.monto_vencido - left.monto_vencido),
    };
}

function getPeriodRange(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - ((days - 1) * 86400000));
    return {
        prevStart: formatDate(prevStart),
        prevEnd: formatDate(prevEnd),
    };
}

async function getFinanceReport(db, { startDate, endDate }) {
    const dbHelpers = createDbHelpers(db);
    const { prevStart, prevEnd } = getPeriodRange(startDate, endDate);

    const summary = await dbHelpers.get(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'pago' AND estado = 'aplicado' THEN monto ELSE 0 END), 0) AS ingresos_brutos,
            COALESCE(SUM(CASE WHEN tipo = 'devolucion' AND estado = 'aplicado' THEN monto ELSE 0 END), 0) AS devoluciones,
            COUNT(*) AS movimientos
         FROM pagos
         WHERE date(fecha) BETWEEN date(?) AND date(?)`,
        [startDate, endDate]
    );

    const previous = await dbHelpers.get(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'pago' AND estado = 'aplicado' THEN monto ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tipo = 'devolucion' AND estado = 'aplicado' THEN monto ELSE 0 END), 0) AS neto
         FROM pagos
         WHERE date(fecha) BETWEEN date(?) AND date(?)`,
        [prevStart, prevEnd]
    );

    const citas = await dbHelpers.get(
        `SELECT COUNT(*) AS total
         FROM citas
         WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
           AND estado = 'atendido'`,
        [startDate, endDate]
    );

    const newPatients = await dbHelpers.get(
        `SELECT COUNT(*) AS total
         FROM pacientes
         WHERE date(COALESCE(created_at, fecha_registro)) BETWEEN date(?) AND date(?)`,
        [startDate, endDate]
    );

    const monthlyIncome = await dbHelpers.all(
        `SELECT
            strftime('%Y-%m', fecha) AS mes,
            COALESCE(SUM(CASE WHEN tipo = 'pago' AND estado = 'aplicado' THEN monto ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tipo = 'devolucion' AND estado = 'aplicado' THEN monto ELSE 0 END), 0) AS neto
         FROM pagos
         WHERE date(fecha) BETWEEN date(?) AND date(?)
         GROUP BY mes
         ORDER BY mes ASC`,
        [startDate, endDate]
    );

    const specialistProduction = await dbHelpers.all(
        `SELECT
            COALESCE(NULLIF(h.especialista_ejecuto, ''), 'Sin asignar') AS profesional,
            COUNT(*) AS tratamientos,
            COALESCE(SUM(h.costo_total), 0) AS produccion
         FROM planes_tratamiento_historial h
         WHERE date(h.fecha_ejecucion) BETWEEN date(?) AND date(?)
         GROUP BY profesional
         ORDER BY produccion DESC
         LIMIT 10`,
        [startDate, endDate]
    );

    const treatments = await dbHelpers.all(
        `SELECT nombre, COUNT(*) AS cantidad, SUM(ingresos) AS ingresos
         FROM (
            SELECT
                COALESCE(tc.nombre, h.descripcion_procedimiento, 'Tratamiento') AS nombre,
                COALESCE(h.costo_total, 0) AS ingresos
            FROM planes_tratamiento_historial h
            LEFT JOIN tratamientos_catalogo tc ON tc.id = h.catalogo_id
            WHERE date(h.fecha_ejecucion) BETWEEN date(?) AND date(?)
            UNION ALL
            SELECT
                CASE
                    WHEN t.procedimiento LIKE 'Receta:%' OR t.procedimiento LIKE 'Receta M%' THEN 'Receta'
                    ELSE COALESCE(NULLIF(t.procedimiento, ''), 'Tratamiento')
                END AS nombre,
                COALESCE(t.costo, 0) AS ingresos
            FROM tratamientos t
            WHERE date(t.fecha) BETWEEN date(?) AND date(?)
         )
         GROUP BY nombre
         ORDER BY ingresos DESC, cantidad DESC
         LIMIT 10`,
        [startDate, endDate, startDate, endDate]
    );

    const overdue = await getOverdueAccounts(db);
    const netIncome = roundMoney((summary?.ingresos_brutos || 0) - (summary?.devoluciones || 0));
    const previousNet = roundMoney(previous?.neto || 0);
    const incomeChange = previousNet === 0
        ? (netIncome > 0 ? 100 : 0)
        : roundMoney(((netIncome - previousNet) / previousNet) * 100);
    const ticket = Number(citas?.total || 0) > 0 ? roundMoney(netIncome / Number(citas.total || 0)) : 0;

    return {
        summary: {
            gross_income: roundMoney(summary?.ingresos_brutos || 0),
            refunds: roundMoney(summary?.devoluciones || 0),
            net_income: netIncome,
            total_movements: Number(summary?.movimientos || 0),
            appointments: Number(citas?.total || 0),
            new_patients: Number(newPatients?.total || 0),
            ticket_average: ticket,
            income_change: incomeChange,
            overdue_amount: overdue.patients.reduce((sum, item) => sum + roundMoney(item.monto_vencido), 0),
            overdue_patients: overdue.patients.length,
        },
        monthlyIncome: monthlyIncome.map(row => ({
            key: row.mes,
            label: row.mes,
            value: roundMoney(row.neto || 0),
        })),
        specialistProduction: specialistProduction.map(row => ({
            profesional: row.profesional,
            tratamientos: Number(row.tratamientos || 0),
            produccion: roundMoney(row.produccion || 0),
        })),
        treatments: treatments.map(row => {
            const quantity = Number(row.cantidad || 0);
            const income = roundMoney(row.ingresos || 0);
            return {
                nombre: row.nombre,
                cantidad: quantity,
                ingresos: income,
                promedio: quantity > 0 ? roundMoney(income / quantity) : 0,
            };
        }),
        overdue,
    };
}

async function sendCollectionReminder(db, { cuota_financiamiento_id, usuario_id = null }) {
    const dbHelpers = createDbHelpers(db);
    const quota = await dbHelpers.get(
        `SELECT
            cf.id,
            cf.numero,
            cf.es_anticipo,
            cf.fecha_vencimiento,
            cf.monto_programado,
            cf.monto_pagado,
            pt.id AS plan_tratamiento_id,
            p.id AS paciente_id,
            p.nombre,
            p.apellido,
            p.email,
            tc.nombre AS tratamiento_nombre
         FROM cuotas_financiamiento cf
         JOIN planes_tratamiento pt ON pt.id = cf.plan_tratamiento_id
         JOIN pacientes p ON p.id = pt.paciente_id
         JOIN tratamientos_catalogo tc ON tc.id = pt.catalogo_id
         WHERE cf.id = ?`,
        [cuota_financiamiento_id]
    );

    if (!quota) throw new Error('Cuota no encontrada');
    if (!quota.email) throw new Error('El paciente no tiene correo registrado');

    const saldoPendiente = clampMoney(quota.monto_programado - quota.monto_pagado, 0);
    const patientName = [quota.nombre, quota.apellido].filter(Boolean).join(' ').trim();
    const subject = quota.es_anticipo
        ? `Recordatorio de anticipo pendiente - ${quota.tratamiento_nombre}`
        : `Recordatorio de cuota vencida #${quota.numero} - ${quota.tratamiento_nombre}`;
    const html = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #0F2532;">
            <p>Hola ${patientName || 'paciente'},</p>
            <p>Tenemos un saldo pendiente relacionado con tu tratamiento <strong>${quota.tratamiento_nombre}</strong>.</p>
            <p>
                ${quota.es_anticipo ? 'Anticipo pendiente' : `Cuota #${quota.numero}`}<br/>
                Fecha de vencimiento: <strong>${quota.fecha_vencimiento}</strong><br/>
                Saldo pendiente: <strong>$${saldoPendiente.toFixed(2)} MXN</strong>
            </p>
            <p>Si ya realizaste el pago, puedes ignorar este mensaje. En caso contrario, por favor comunícate con la clínica para regularizar tu cuenta.</p>
        </div>
    `;

    try {
        await sendEmail({
            to: quota.email,
            subject,
            html,
        });

        await dbHelpers.run(
            `INSERT INTO cobranza_recordatorios
             (paciente_id, plan_tratamiento_id, cuota_financiamiento_id, canal, destinatario, estado, error)
             VALUES (?, ?, ?, 'email', ?, 'sent', NULL)`,
            [quota.paciente_id, quota.plan_tratamiento_id, cuota_financiamiento_id, quota.email]
        );

        await recordAudit(dbHelpers, {
            userId: usuario_id,
            action: 'enviar_recordatorio_cobranza',
            entity: 'cuota_financiamiento',
            entityId: cuota_financiamiento_id,
            payload: { destinatario: quota.email },
        });

        return { success: true };
    } catch (error) {
        await dbHelpers.run(
            `INSERT INTO cobranza_recordatorios
             (paciente_id, plan_tratamiento_id, cuota_financiamiento_id, canal, destinatario, estado, error)
             VALUES (?, ?, ?, 'email', ?, 'failed', ?)`,
            [quota.paciente_id, quota.plan_tratamiento_id, cuota_financiamiento_id, quota.email, error.message || 'error']
        );
        if (error.message === 'NO_TOKEN') {
            throw new Error('Gmail no está configurado');
        }
        throw error;
    }
}

module.exports = {
    roundMoney,
    calculateDiscount,
    calculateTax,
    computePlanFinancials,
    buildInstallmentSchedule,
    applyAmountToInstallments,
    reverseAmountFromInstallments,
    saveTreatmentPlan,
    getTreatmentPlanDetail,
    getPatientFinancialSummary,
    registerPayment,
    registerRefund,
    generateSimulatedInvoice,
    getSimulatedInvoices,
    getOverdueAccounts,
    getFinanceReport,
    sendCollectionReminder,
};
