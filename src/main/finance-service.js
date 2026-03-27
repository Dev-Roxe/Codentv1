const { sendEmail } = require('./google/gmail-service');
const { syncPlanDiagnosisRelationsWithDbHelpers } = require('./odontogram-service');

function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function clampMoney(value, min = 0, max = Number.POSITIVE_INFINITY) {
    return Math.min(max, Math.max(min, roundMoney(value)));
}

function formatDate(date) {
    let d = null;
    if (date instanceof Date) {
        d = new Date(date.getTime());
    } else if (typeof date === 'string') {
        const trimmed = date.trim();
        d = trimmed.length > 10 ? new Date(trimmed) : new Date(`${trimmed}T00:00:00`);
    } else {
        d = new Date(date);
    }
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

function buildPlanCode(planId) {
    const safeId = Math.max(0, Number(planId) || 0);
    return `PLAN-${String(safeId).padStart(4, '0')}`;
}

function buildInstallmentLabel(installment = {}) {
    return installment.es_anticipo ? 'Anticipo' : `Cuota #${Number(installment.numero || 0)}`;
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

function clampPercentage(value) {
    const safeValue = Math.round(Number(value) || 0);
    return Math.min(100, Math.max(0, safeValue));
}

function normalizePlanStatusValue(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');

    if (normalized === 'no_iniciado') return 'not_started';
    if (normalized === 'en_progreso') return 'in_progress';
    if (normalized === 'planificado') return 'planned';
    if (normalized === 'completado') return 'completed';
    if (normalized === 'cancelado') return 'cancelled';
    if (normalized === 'terminado_con_saldo') return 'completed_with_balance';
    if (normalized === 'finalizado_clinicamente') return 'completed_with_balance';
    if (normalized === 'clinical_completed') return 'completed_with_balance';
    return normalized;
}

const NON_REMOVABLE_PLAN_STATUSES = new Set([
    'in_progress',
    'active',
    'partial',
    'completed',
    'completed_with_balance',
]);

function deriveClinicalStatus(progress) {
    const safeProgress = clampPercentage(progress);
    if (safeProgress >= 100) return 'completado';
    if (safeProgress > 0) return 'en_progreso';
    return 'pendiente';
}

function deriveFinancialStatus({
    totalFinal = 0,
    netPaid = 0,
    pending = 0,
    overdueAmount = 0,
    isCancelled = false,
}) {
    if (isCancelled) return 'cancelado';
    const safeTotal = roundMoney(totalFinal);
    const safeNetPaid = roundMoney(netPaid);
    const safePending = clampMoney(pending, 0);
    const safeOverdue = roundMoney(overdueAmount);

    if (safeTotal <= 0.01) return 'pagado';
    if (safePending <= 0.01) return 'pagado';
    if (safeOverdue > 0.01) return 'vencido';
    if (safeNetPaid > 0.01) return 'parcial';
    return 'pendiente';
}

function getCompletionBlockMessage(code) {
    if (code === 'cancelado') {
        return 'El plan est\u00e1 cancelado y no puede completarse.';
    }
    if (code === 'progreso_clinico') {
        return 'El progreso cl\u00ednico debe llegar a 100% antes de completar el tratamiento.';
    }
    if (code === 'saldo_vencido') {
        return 'Existen cuotas vencidas pendientes; no se puede completar el tratamiento.';
    }
    if (code === 'saldo_pendiente') {
        return 'A\u00fan existe saldo pendiente; liquida el plan antes de completarlo.';
    }
    return null;
}

function normalizeInstallments(installments = [], referenceDate = new Date()) {
    const todayKey = formatDate(referenceDate);

    return (installments || []).map(item => {
        const scheduled = roundMoney(item.monto_programado || 0);
        const paid = roundMoney(item.monto_pagado || 0);
        const rawPendingAmount = clampMoney(scheduled - paid, 0);
        const dueDate = formatDate(item.fecha_vencimiento);
        const isCancelledPlan = normalizePlanStatusValue(item.plan_estado) === 'cancelled';
        const pendingAmount = isCancelledPlan ? 0 : rawPendingAmount;
        const isOverdue = !!(dueDate && todayKey && dueDate < todayKey && pendingAmount > 0.01);
        const derivedStatus = item.estado || deriveInstallmentStatus({
            montoProgramado: scheduled,
            montoPagado: paid,
        });
        const visualStatus = isCancelledPlan && rawPendingAmount > 0.01
            ? 'cancelada'
            : (isOverdue ? 'vencida' : derivedStatus);
        return {
            ...item,
            monto_programado: scheduled,
            monto_pagado: paid,
            saldo_pendiente: pendingAmount,
            saldo_pendiente_original: rawPendingAmount,
            etiqueta_cuota: buildInstallmentLabel(item),
            esta_vencida: isOverdue,
            estado_visual: visualStatus,
        };
    });
}

function buildPlanLifecycle(plan = {}, installments = [], netPaid = 0) {
    const normalizedInstallments = normalizeInstallments(installments);
    const normalizedCurrentStatus = normalizePlanStatusValue(plan.estado);
    const isCancelled = normalizedCurrentStatus === 'cancelled';
    const clinicalProgress = clampPercentage(
        plan.progreso_clinico != null ? plan.progreso_clinico : plan.progreso
    );
    const clinicalStatus = deriveClinicalStatus(clinicalProgress);
    const totalFinal = roundMoney(plan.total_final || plan.costo_total || 0);
    const safeNetPaid = roundMoney(netPaid != null ? netPaid : plan.neto_pagado || 0);
    const pending = isCancelled ? 0 : clampMoney(totalFinal - safeNetPaid, 0);
    const overdueAmount = roundMoney(normalizedInstallments.reduce((sum, item) => {
        if (!item.esta_vencida) return sum;
        return sum + roundMoney(item.saldo_pendiente || 0);
    }, 0));
    const overdueCount = normalizedInstallments.filter(item => item.esta_vencida).length;
    const financialProgress = totalFinal <= 0.01
        ? 100
        : clampPercentage((safeNetPaid / totalFinal) * 100);
    const financialStatus = deriveFinancialStatus({
        totalFinal,
        netPaid: safeNetPaid,
        pending,
        overdueAmount,
        isCancelled,
    });
    const isStoredCompleted = normalizedCurrentStatus === 'completed';
    const isStoredCompletedWithBalance = normalizedCurrentStatus === 'completed_with_balance';
    const hasActivity = clinicalProgress > 0 || safeNetPaid > 0.01;
    const hasClinicalCompletionPendingCollection = !isCancelled && clinicalStatus === 'completado' && pending > 0.01;
    const suggestedStatus = isCancelled
        ? 'cancelado'
        : hasClinicalCompletionPendingCollection
            ? 'terminado_con_saldo'
        : hasActivity
            ? 'en_progreso'
            : 'pendiente';
    const canComplete = !isCancelled && clinicalProgress >= 100 && pending <= 0.01;
    const canFinishClinically = !isCancelled && clinicalProgress < 100;
    const completionBlockCode = isCancelled
        ? 'cancelado'
        : clinicalProgress < 100
            ? 'progreso_clinico'
            : pending > 0.01
                ? (overdueAmount > 0.01 ? 'saldo_vencido' : 'saldo_pendiente')
                : null;
    const overallStatus = isCancelled
        ? 'cancelado'
        : (isStoredCompleted && canComplete ? 'completado' : suggestedStatus);
    const overallLabel = overallStatus === 'completado'
        ? 'Completado'
        : overallStatus === 'cancelado'
            ? 'Cancelado'
            : overallStatus === 'terminado_con_saldo'
                ? 'Terminado con saldo'
                : (canComplete ? 'Listo para completar' : (suggestedStatus === 'en_progreso' ? 'En curso' : 'Pendiente'));

    return {
        progreso_clinico: clinicalProgress,
        estado_clinico: clinicalStatus,
        progreso_financiero: financialProgress,
        estado_financiero: financialStatus,
        estado_general: overallStatus,
        estado_general_sugerido: suggestedStatus,
        estado_general_label: overallLabel,
        total_final: totalFinal,
        neto_pagado: safeNetPaid,
        saldo_pendiente: pending,
        monto_vencido: overdueAmount,
        cuotas_vencidas: overdueCount,
        puede_completarse: canComplete,
        puede_finalizar_clinicamente: canFinishClinically,
        terminado_con_saldo: overallStatus === 'terminado_con_saldo' || (isStoredCompletedWithBalance && pending > 0.01),
        listo_para_completar: canComplete && overallStatus !== 'completado',
        bloqueo_completado_codigo: completionBlockCode,
        bloqueo_completado: getCompletionBlockMessage(completionBlockCode),
        cuotas: normalizedInstallments,
    };
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

function normalizeCancellationPolicy(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');

    if (!normalized) return null;

    if ([
        'refund_full',
        'full_refund',
        'devolucion_total',
        'cancelar_y_devolver',
        'cancel_with_refund',
        'cancelar_tratamiento_y_devolver',
    ].includes(normalized)) {
        return 'refund_full';
    }

    if ([
        'keep_income',
        'sin_devolucion',
        'no_refund',
        'cancelar_sin_devolucion',
        'conservar_ingreso',
        'retain_income',
    ].includes(normalized)) {
        return 'keep_income';
    }

    if ([
        'refund_partial',
        'partial_refund',
        'devolucion_parcial',
        'cancelar_con_devolucion_parcial',
        'partial',
    ].includes(normalized)) {
        return 'refund_partial';
    }

    if (['do_not_cancel', 'no_cancelar', 'cancelacion_abortada', 'abort'].includes(normalized)) {
        return 'do_not_cancel';
    }

    return null;
}

async function ensureTreatmentPlanSchema(dbHelpers) {
    const rows = await dbHelpers.all('PRAGMA table_info(planes_tratamiento)');
    const columns = new Set((rows || []).map(row => row?.name).filter(Boolean));

    const requiredColumns = [
        ['estado', "TEXT DEFAULT 'pendiente'"],
        ['progreso', 'INTEGER DEFAULT 0'],
        ['progreso_clinico', 'INTEGER DEFAULT 0'],
        ['estado_clinico', "TEXT DEFAULT 'pendiente'"],
        ['fecha_completado_clinico', 'DATETIME'],
        ['fecha_cancelacion', 'DATETIME'],
        ['motivo_cancelacion', 'TEXT'],
        ['politica_cancelacion', 'TEXT'],
        ['cancelado_por', 'INTEGER'],
        ['monto_reembolsado', 'REAL DEFAULT 0.0'],
        ['monto_conservado', 'REAL DEFAULT 0.0'],
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

    if (columns.has('progreso') && columns.has('progreso_clinico')) {
        await dbHelpers.run(
            `UPDATE planes_tratamiento
             SET progreso_clinico = COALESCE(progreso, 0)
             WHERE COALESCE(progreso_clinico, 0) = 0
               AND COALESCE(progreso, 0) > 0`
        );
    }

    if (columns.has('estado_clinico')) {
        await dbHelpers.run(
            `UPDATE planes_tratamiento
             SET estado_clinico = CASE
                WHEN COALESCE(progreso_clinico, progreso, 0) >= 100 THEN 'completado'
                WHEN COALESCE(progreso_clinico, progreso, 0) > 0 THEN 'en_progreso'
                ELSE 'pendiente'
             END
             WHERE estado_clinico IS NULL
                OR TRIM(COALESCE(estado_clinico, '')) = ''`
        );
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

    await dbHelpers.run(
        `CREATE TABLE IF NOT EXISTS planes_tratamiento_cancelaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER NOT NULL,
            paciente_id INTEGER NOT NULL,
            politica TEXT NOT NULL,
            motivo TEXT,
            monto_reembolsado REAL DEFAULT 0.0,
            monto_conservado REAL DEFAULT 0.0,
            detalle TEXT,
            cancelado_por INTEGER,
            fecha_cancelacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(plan_id) REFERENCES planes_tratamiento(id) ON DELETE CASCADE,
            FOREIGN KEY(cancelado_por) REFERENCES usuarios(id)
        )`
    );
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_cancelaciones_plan ON planes_tratamiento_cancelaciones(plan_id, fecha_cancelacion)');
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_planes_tratamiento_cancelaciones_paciente ON planes_tratamiento_cancelaciones(paciente_id, fecha_cancelacion)');

    await dbHelpers.run(
        `CREATE TABLE IF NOT EXISTS auditoria_clinica(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            paciente_id INTEGER,
            accion TEXT NOT NULL,
            modulo TEXT NOT NULL,
            detalle TEXT,
            ip_local TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    );
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_auditoria_clinica_paciente ON auditoria_clinica(paciente_id, fecha)');
    await dbHelpers.run('CREATE INDEX IF NOT EXISTS idx_auditoria_clinica_usuario ON auditoria_clinica(usuario_id, fecha)');

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

async function tableExists(dbHelpers, tableName) {
    const row = await dbHelpers.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        [tableName]
    );
    return !!row?.name;
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

async function recordClinicalAudit(dbHelpers, {
    userId = null,
    patientId = null,
    action,
    module = 'tratamientos',
    detail = null,
}) {
    await dbHelpers.run(
        `INSERT INTO auditoria_clinica (usuario_id, paciente_id, accion, modulo, detalle)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, patientId, action, module, detail ? JSON.stringify(detail) : null]
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

async function ensureLedgerMovementForPayment(dbHelpers, paymentId) {
    if (!paymentId) throw new Error('Pago invalido para sincronizar ledger');
    const movement = await dbHelpers.get(
        `SELECT id, caja_id, tipo, monto
         FROM movimientos_caja
         WHERE pago_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [paymentId]
    );
    if (!movement) {
        throw new Error('No se pudo sincronizar el movimiento de caja del pago');
    }
    return movement;
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

async function getLatestPlanCancellation(dbHelpers, planId) {
    if (!planId) return null;
    return dbHelpers.get(
        `SELECT *
         FROM planes_tratamiento_cancelaciones
         WHERE plan_id = ?
         ORDER BY datetime(fecha_cancelacion) DESC, id DESC
         LIMIT 1`,
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

async function cancelOutstandingInstallments(dbHelpers, planId) {
    if (!planId) return;

    await dbHelpers.run(
        `UPDATE cuotas_financiamiento
         SET estado = CASE
            WHEN round(COALESCE(monto_pagado, 0), 2) >= round(COALESCE(monto_programado, 0), 2) THEN 'pagada'
            ELSE 'cancelada'
         END
         WHERE plan_tratamiento_id = ?`,
        [planId]
    );
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

async function ensurePlanHistorySnapshot(dbHelpers, planId) {
    if (!planId) return;

    try {
        const plan = await dbHelpers.get(
            `SELECT id, paciente_id, catalogo_id, especialista_asignado, total_final, costo_total
             FROM planes_tratamiento
             WHERE id = ?`,
            [planId]
        );
        if (!plan) return;

        const existing = await dbHelpers.get(
            `SELECT id
             FROM planes_tratamiento_historial
             WHERE plan_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [planId]
        );
        if (existing) return;

        await dbHelpers.run(
            `INSERT INTO planes_tratamiento_historial
             (plan_id, paciente_id, catalogo_id, especialista_ejecuto, costo_total, fecha_ejecucion)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                planId,
                plan.paciente_id,
                plan.catalogo_id,
                plan.especialista_asignado || null,
                roundMoney(plan.total_final || plan.costo_total || 0),
            ]
        );
    } catch (error) {
        console.warn('No se pudo guardar snapshot de historial del plan', error && error.message);
    }
}

async function syncTreatmentPlanState(dbHelpers, planId, { forceStatus = null } = {}) {
    const safePlanId = Number(planId || 0);
    if (!safePlanId) return null;

    const plan = await dbHelpers.get(
        `SELECT *
         FROM planes_tratamiento
         WHERE id = ?`,
        [safePlanId]
    );
    if (!plan) return null;

    const installments = await getPlanInstallments(dbHelpers, safePlanId);
    const netPaid = await getNetPaidForPlan(dbHelpers, safePlanId);
    const lifecycle = buildPlanLifecycle(plan, installments, netPaid);
    const currentStatus = normalizePlanStatusValue(plan.estado);
    const forcedStatus = normalizePlanStatusValue(forceStatus);

    if (currentStatus === 'cancelled' && forcedStatus && forcedStatus !== 'cancelled') {
        throw new Error('El plan est\u00e1 cancelado y no puede modificarse desde esta acci\u00f3n.');
    }

    let nextStatus = lifecycle.estado_general_sugerido;
    if (forcedStatus === 'completed') {
        if (!lifecycle.puede_completarse) {
            throw new Error(lifecycle.bloqueo_completado || 'El plan no puede completarse todav\u00eda.');
        }
        nextStatus = 'completado';
    } else if (forcedStatus === 'completed_with_balance') {
        nextStatus = lifecycle.saldo_pendiente > 0.01
            ? 'terminado_con_saldo'
            : lifecycle.estado_general_sugerido;
    } else if (forcedStatus === 'cancelled') {
        nextStatus = 'cancelado';
    } else if (currentStatus === 'cancelled') {
        nextStatus = 'cancelado';
    } else if (currentStatus === 'completed' && lifecycle.puede_completarse) {
        nextStatus = 'completado';
    } else if (currentStatus === 'completed_with_balance' && lifecycle.saldo_pendiente > 0.01) {
        nextStatus = 'terminado_con_saldo';
    }

    await dbHelpers.run(
        `UPDATE planes_tratamiento
         SET progreso = ?,
             progreso_clinico = ?,
             estado_clinico = ?,
             estado = ?,
             fecha_completado_clinico = CASE
                WHEN ? = 'completado' THEN COALESCE(fecha_completado_clinico, CURRENT_TIMESTAMP)
                ELSE NULL
             END,
             fecha_finalizacion = CASE
                WHEN ? = 'completado' THEN COALESCE(fecha_finalizacion, CURRENT_DATE)
                ELSE NULL
             END,
             fecha_cancelacion = CASE
                WHEN ? = 'cancelado' THEN COALESCE(fecha_cancelacion, CURRENT_TIMESTAMP)
                ELSE fecha_cancelacion
             END
         WHERE id = ?`,
        [
            lifecycle.progreso_clinico,
            lifecycle.progreso_clinico,
            lifecycle.estado_clinico,
            nextStatus,
            lifecycle.estado_clinico,
            nextStatus,
            nextStatus,
            safePlanId,
        ]
    );

    if (nextStatus === 'completado') {
        await ensurePlanHistorySnapshot(dbHelpers, safePlanId);
    }

    return {
        ...plan,
        progreso: lifecycle.progreso_clinico,
        progreso_clinico: lifecycle.progreso_clinico,
        estado_clinico: lifecycle.estado_clinico,
        estado: nextStatus,
        lifecycle: {
            ...lifecycle,
            estado_general: nextStatus,
            estado_general_label: nextStatus === 'completado'
                ? 'Completado'
                : nextStatus === 'cancelado'
                    ? 'Cancelado'
                    : nextStatus === 'terminado_con_saldo'
                        ? 'Terminado con saldo'
                    : lifecycle.estado_general_label,
        },
    };
}

async function refreshPatientPlanStates(dbHelpers, patientId) {
    const rows = await dbHelpers.all(
        `SELECT id
         FROM planes_tratamiento
         WHERE paciente_id = ?`,
        [patientId]
    );

    for (const row of rows) {
        await syncTreatmentPlanState(dbHelpers, row.id);
    }
}

async function getTreatmentPlanDetail(db, planId) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);
    await syncTreatmentPlanState(dbHelpers, planId);
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
    const latestCancellation = await getLatestPlanCancellation(dbHelpers, planId);
    const netPaid = await getNetPaidForPlan(dbHelpers, planId);
    const lifecycle = buildPlanLifecycle(plan, installments, netPaid);

    return {
        ...plan,
        plan_code: buildPlanCode(plan.id),
        estado: lifecycle.estado_general,
        estado_general: lifecycle.estado_general,
        estado_general_label: lifecycle.estado_general_label,
        estado_clinico: lifecycle.estado_clinico,
        progreso: lifecycle.progreso_clinico,
        progreso_clinico: lifecycle.progreso_clinico,
        progreso_financiero: lifecycle.progreso_financiero,
        estado_financiero: lifecycle.estado_financiero,
        puede_completarse: lifecycle.puede_completarse,
        listo_para_completar: lifecycle.listo_para_completar,
        bloqueo_completado: lifecycle.bloqueo_completado,
        bloqueo_completado_codigo: lifecycle.bloqueo_completado_codigo,
        total_final: lifecycle.total_final,
        financing: financing ? {
            ...financing,
            installments: lifecycle.cuotas,
        } : null,
        simulated_invoices: simulatedInvoices,
        commercial_versions: commercialVersions,
        cancellation: latestCancellation ? {
            ...latestCancellation,
            monto_reembolsado: roundMoney(latestCancellation.monto_reembolsado || 0),
            monto_conservado: roundMoney(latestCancellation.monto_conservado || 0),
        } : null,
        financial_summary: {
            subtotal_neto: roundMoney(plan.subtotal_neto || (plan.costo_total - (plan.descuento_monto || 0) || 0)),
            impuesto_monto: roundMoney(plan.impuesto_monto || 0),
            total_final: lifecycle.total_final,
            net_paid: lifecycle.neto_pagado,
            pending: lifecycle.saldo_pendiente,
            overdue: lifecycle.monto_vencido,
            financial_progress: lifecycle.progreso_financiero,
            financial_status: lifecycle.estado_financiero,
        },
        lifecycle,
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

        await syncPlanDiagnosisRelationsWithDbHelpers(dbHelpers, {
            plan_id: planId,
            paciente_id: payload.paciente_id,
            diente: planTooth,
            caras: payload.caras,
            source_diagnosis_ids: payload.source_diagnosis_ids,
            source_diagnosis_uids: payload.source_diagnosis_uids,
        });

        await syncTreatmentPlanState(dbHelpers, planId);

        return getTreatmentPlanDetail(db, planId);
    });
}

async function getPatientFinancialSummary(db, patientId) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);
    await refreshPatientPlanStates(dbHelpers, patientId);
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
            pt.fecha_creacion,
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
            pt.progreso_clinico,
            pt.estado_clinico,
            pt.especialista_asignado,
            pt.notas,
            pt.diente,
            pt.caras,
            tc.nombre AS tratamiento_nombre,
            tc.descripcion AS tratamiento_descripcion,
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
            pt.diente,
            pt.caras,
            tc.nombre AS tratamiento_nombre,
            tc.descripcion AS tratamiento_descripcion,
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

    const paymentApplications = await dbHelpers.all(
        `SELECT
            pa.pago_id,
            pa.cuota_financiamiento_id,
            pa.monto_aplicado,
            cf.plan_tratamiento_id,
            cf.numero,
            cf.es_anticipo,
            cf.fecha_vencimiento
         FROM pagos_aplicaciones pa
         JOIN pagos p ON p.id = pa.pago_id
         JOIN cuotas_financiamiento cf ON cf.id = pa.cuota_financiamiento_id
         WHERE p.paciente_id = ?
         ORDER BY pa.pago_id DESC, date(cf.fecha_vencimiento) ASC, cf.numero ASC`,
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

    const paymentApplicationsByPayment = new Map();
    paymentApplications.forEach(application => {
        const paymentId = Number(application.pago_id);
        const bucket = paymentApplicationsByPayment.get(paymentId) || [];
        bucket.push({
            ...application,
            monto_aplicado: roundMoney(application.monto_aplicado || 0),
            etiqueta_cuota: buildInstallmentLabel(application),
            plan_code: buildPlanCode(application.plan_tratamiento_id),
        });
        paymentApplicationsByPayment.set(paymentId, bucket);
    });

    const normalizedInstallments = normalizeInstallments(installments).map(item => ({
        ...item,
        plan_code: buildPlanCode(item.plan_tratamiento_id),
    }));

    const normalizedPayments = payments.map(payment => {
        const applications = paymentApplicationsByPayment.get(Number(payment.id)) || [];
        return {
            ...payment,
            plan_code: payment.plan_tratamiento_id ? buildPlanCode(payment.plan_tratamiento_id) : null,
            aplicaciones: applications,
            cuotas_aplicadas_count: applications.length,
            cuotas_aplicadas_label: applications
                .map(item => `${item.etiqueta_cuota} (${roundMoney(item.monto_aplicado).toFixed(2)})`)
                .join(' | '),
        };
    });

    const mappedPlans = plans.map(plan => {
        const planInstallments = normalizedInstallments.filter(item => Number(item.plan_tratamiento_id) === Number(plan.id));
        const planPayments = normalizedPayments.filter(item => Number(item.plan_tratamiento_id) === Number(plan.id));
        const lifecycle = buildPlanLifecycle(plan, planInstallments, plan.neto_pagado);

        return {
            ...plan,
            plan_code: buildPlanCode(plan.id),
            estado: lifecycle.estado_general,
            estado_general: lifecycle.estado_general,
            estado_general_label: lifecycle.estado_general_label,
            estado_clinico: lifecycle.estado_clinico,
            progreso: lifecycle.progreso_clinico,
            progreso_clinico: lifecycle.progreso_clinico,
            progreso_financiero: lifecycle.progreso_financiero,
            estado_financiero: lifecycle.estado_financiero,
            puede_completarse: lifecycle.puede_completarse,
            listo_para_completar: lifecycle.listo_para_completar,
            bloqueo_completado: lifecycle.bloqueo_completado,
            bloqueo_completado_codigo: lifecycle.bloqueo_completado_codigo,
            total_final: lifecycle.total_final,
            neto_pagado: lifecycle.neto_pagado,
            saldo_pendiente: lifecycle.saldo_pendiente,
            monto_vencido: lifecycle.monto_vencido,
            numero_cuotas: planInstallments.length,
            cuotas: lifecycle.cuotas,
            payments: planPayments,
        };
    });

    const activePlans = mappedPlans.filter(plan => normalizePlanStatusValue(plan.estado_general || plan.estado) !== 'cancelled');
    const totalPlanned = roundMoney(activePlans.reduce((sum, plan) => sum + roundMoney(plan.total_final || plan.costo_total), 0));
    const totalPaid = roundMoney(summaryRow?.total_pagado || 0);
    const totalRefunded = roundMoney(summaryRow?.total_devuelto || 0);
    const netPaid = roundMoney(totalPaid - totalRefunded);
    const totalPending = roundMoney(activePlans.reduce((sum, plan) => sum + roundMoney(plan.saldo_pendiente || 0), 0));
    const overdueInstallments = normalizedInstallments.filter(item => item.esta_vencida && normalizePlanStatusValue(item.plan_estado) !== 'cancelled');
    const totalOverdue = roundMoney(overdueInstallments.reduce((sum, item) => sum + roundMoney(item.saldo_pendiente || 0), 0));

    return {
        summary: {
            total_planned: totalPlanned,
            total_paid: totalPaid,
            total_refunded: totalRefunded,
            net_paid: netPaid,
            total_pending: totalPending,
            total_overdue: totalOverdue,
            overdue_count: overdueInstallments.length,
            payment_count: Number(summaryRow?.total_movimientos || 0),
        },
        plans: mappedPlans,
        payments: normalizedPayments,
        installments: normalizedInstallments,
    };
}

async function updateTreatmentPlanProgress(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

    return withTransaction(dbHelpers, async () => {
        const planId = Number(payload.plan_id || payload.planId || payload.id || 0);
        const progress = clampPercentage(payload.progreso_clinico != null ? payload.progreso_clinico : payload.progreso);
        const userId = resolveUserId(payload);

        if (!planId) throw new Error('Plan de tratamiento inv\u00e1lido');

        const plan = await dbHelpers.get(
            `SELECT id, estado
             FROM planes_tratamiento
             WHERE id = ?`,
            [planId]
        );
        if (!plan) throw new Error('Plan de tratamiento no encontrado');
        if (normalizePlanStatusValue(plan.estado) === 'cancelled') {
            throw new Error('No se puede modificar el progreso de un plan cancelado.');
        }

        await dbHelpers.run(
            `UPDATE planes_tratamiento
             SET progreso = ?, progreso_clinico = ?
             WHERE id = ?`,
            [progress, progress, planId]
        );

        const syncedPlan = await syncTreatmentPlanState(dbHelpers, planId);

        await recordAudit(dbHelpers, {
            userId,
            action: 'actualizar_progreso_plan',
            entity: 'plan_tratamiento',
            entityId: planId,
            payload: {
                progreso_clinico: syncedPlan?.progreso_clinico ?? progress,
                estado_general: syncedPlan?.estado || null,
            },
        });

        return getTreatmentPlanDetail(db, planId);
    });
}

async function setTreatmentPlanStatus(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

    const requestedStatus = payload.estado || payload.status || '';
    const normalizedStatus = normalizePlanStatusValue(requestedStatus);
    if (normalizedStatus === 'cancelled') {
        return cancelTreatmentPlan(db, payload);
    }

    return withTransaction(dbHelpers, async () => {
        const planId = Number(payload.plan_id || payload.planId || payload.id || 0);
        const userId = resolveUserId(payload);

        if (!planId) throw new Error('Plan de tratamiento inv\u00e1lido');
        if (!normalizedStatus) throw new Error('Estado de tratamiento inv\u00e1lido');
        if (!['completed', 'completed_with_balance'].includes(normalizedStatus)) {
            throw new Error('Estado de tratamiento no soportado');
        }

        const plan = await dbHelpers.get(
            `SELECT id, estado
             FROM planes_tratamiento
             WHERE id = ?`,
            [planId]
        );
        if (!plan) throw new Error('Plan de tratamiento no encontrado');

        if (normalizedStatus === 'completed_with_balance') {
            await dbHelpers.run(
                `UPDATE planes_tratamiento
                 SET progreso = 100,
                     progreso_clinico = 100
                 WHERE id = ?`,
                [planId]
            );
        }

        const syncedPlan = await syncTreatmentPlanState(dbHelpers, planId, {
            forceStatus: normalizedStatus,
        });

        await recordAudit(dbHelpers, {
            userId,
            action: normalizedStatus === 'completed_with_balance'
                    ? 'finalizar_plan_clinicamente'
                    : 'actualizar_estado_plan',
            entity: 'plan_tratamiento',
            entityId: planId,
            payload: {
                estado_anterior: plan.estado,
                estado_nuevo: syncedPlan?.estado || requestedStatus,
            },
        });

        return getTreatmentPlanDetail(db, planId);
    });
}

async function cancelTreatmentPlan(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

    const transactionResult = await withTransaction(dbHelpers, async () => {
        const planId = Number(payload.plan_id || payload.planId || payload.id || 0);
        const userId = resolveUserId(payload);
        const policy = normalizeCancellationPolicy(
            payload.politica_cancelacion || payload.cancellation_policy || payload.policy
        );
        const reason = String(payload.motivo || payload.reason || '').trim();

        if (!planId) throw new Error('Plan de tratamiento invalido');
        if (!userId) throw new Error('Usuario invalido: se requiere usuario_id (o user_id)');
        if (!policy || policy === 'do_not_cancel') {
            throw new Error('Debes indicar una politica valida de cancelacion.');
        }
        if (!reason) {
            throw new Error('Debes registrar el motivo de cancelacion.');
        }

        const plan = await dbHelpers.get(
            `SELECT id, paciente_id, estado, total_final, costo_total, progreso, progreso_clinico
             FROM planes_tratamiento
             WHERE id = ?`,
            [planId]
        );
        if (!plan) throw new Error('Plan de tratamiento no encontrado');
        if (normalizePlanStatusValue(plan.estado) === 'cancelled') {
            throw new Error('El plan ya se encuentra cancelado.');
        }

        const netPaidBefore = await getNetPaidForPlan(dbHelpers, planId);
        const totalFinal = roundMoney(plan.total_final || plan.costo_total || 0);
        const requestedRefund = clampMoney(
            payload.monto_reembolsado != null ? payload.monto_reembolsado : payload.refund_amount,
            0,
            netPaidBefore
        );

        let refundAmount = 0;
        if (policy === 'refund_full') {
            refundAmount = netPaidBefore;
        } else if (policy === 'refund_partial') {
            refundAmount = requestedRefund;
            if (refundAmount <= 0) {
                throw new Error('Debes indicar un monto de devolucion parcial mayor a 0.');
            }
        }

        let refundResult = null;
        if (refundAmount > 0.01) {
            refundResult = await registerRefundWithDbHelpers(dbHelpers, db, {
                ...payload,
                paciente_id: plan.paciente_id,
                plan_tratamiento_id: planId,
                monto: refundAmount,
                descripcion: payload.descripcion_devolucion
                    || payload.descripcion
                    || `Cancelacion de plan #${planId} - ${reason}`,
                metodo: payload.metodo_devolucion || payload.metodo || 'Devolucion',
            });
        }

        const netPaidAfter = await getNetPaidForPlan(dbHelpers, planId);
        const keptAmount = roundMoney(Math.max(0, netPaidAfter));
        await cancelOutstandingInstallments(dbHelpers, planId);

        await dbHelpers.run(
            `UPDATE planes_tratamiento
             SET motivo_cancelacion = ?,
                 politica_cancelacion = ?,
                 cancelado_por = ?,
                 monto_reembolsado = ?,
                 monto_conservado = ?,
                 fecha_cancelacion = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [reason, policy, userId, refundAmount, keptAmount, planId]
        );

        await dbHelpers.run(
            `INSERT INTO planes_tratamiento_cancelaciones
             (plan_id, paciente_id, politica, motivo, monto_reembolsado, monto_conservado, detalle, cancelado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                planId,
                plan.paciente_id,
                policy,
                reason,
                refundAmount,
                keptAmount,
                JSON.stringify({
                    estado_anterior: plan.estado,
                    progreso_clinico: clampPercentage(plan.progreso_clinico != null ? plan.progreso_clinico : plan.progreso),
                    total_final: totalFinal,
                    neto_pagado_antes: netPaidBefore,
                    neto_pagado_despues: netPaidAfter,
                    refund_result: refundResult ? {
                        refundId: refundResult.refundId,
                        movementId: refundResult.movementId,
                    } : null,
                }),
                userId,
            ]
        );

        const syncedPlan = await syncTreatmentPlanState(dbHelpers, planId, {
            forceStatus: 'cancelled',
        });

        await recordAudit(dbHelpers, {
            userId,
            action: 'cancelar_plan',
            entity: 'plan_tratamiento',
            entityId: planId,
            payload: {
                estado_anterior: plan.estado,
                estado_nuevo: syncedPlan?.estado || 'cancelado',
                politica_cancelacion: policy,
                motivo: reason,
                monto_reembolsado: refundAmount,
                monto_conservado: keptAmount,
            },
        });

        await recordClinicalAudit(dbHelpers, {
            userId,
            patientId: plan.paciente_id,
            action: 'cancelar_plan_tratamiento',
            module: 'tratamientos',
            detail: {
                plan_id: planId,
                politica_cancelacion: policy,
                motivo: reason,
                monto_reembolsado: refundAmount,
                monto_conservado: keptAmount,
            },
        });

        return {
            planId,
            patientId: plan.paciente_id,
            policy,
            refundAmount,
            keptAmount,
        };
    });

    return {
        ...transactionResult,
        detail: await getTreatmentPlanDetail(db, transactionResult.planId),
        summary: await getPatientFinancialSummary(db, transactionResult.patientId),
    };
}

async function deleteTreatmentPlan(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

    return withTransaction(dbHelpers, async () => {
        const planId = Number(payload.plan_id || payload.planId || payload.id || 0);
        const userId = resolveUserId(payload) || null;

        if (!planId) throw new Error('Plan de tratamiento invalido');

        const plan = await dbHelpers.get(
            `SELECT id, paciente_id, estado
             FROM planes_tratamiento
             WHERE id = ?`,
            [planId]
        );
        if (!plan) throw new Error('Plan de tratamiento no encontrado');

        const normalizedStatus = normalizePlanStatusValue(plan.estado);
        if (NON_REMOVABLE_PLAN_STATUSES.has(normalizedStatus)) {
            throw new Error('No se puede eliminar este tratamiento porque ya fue iniciado. Para quitarlo, primero debes cancelarlo.');
        }

        const appliedPayments = await dbHelpers.get(
            `SELECT COUNT(*) AS total
             FROM pagos
             WHERE plan_tratamiento_id = ?
               AND COALESCE(estado, 'aplicado') = 'aplicado'`,
            [planId]
        );
        if (Number(appliedPayments?.total || 0) > 0) {
            throw new Error('No se puede eliminar un plan con pagos aplicados. Cancela o devuelve los pagos primero.');
        }

        const deleteStatements = [
            {
                table: 'pagos_aplicaciones',
                sql: 'DELETE FROM pagos_aplicaciones WHERE cuota_financiamiento_id IN (SELECT id FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?)',
                params: [planId],
            },
            {
                table: 'facturas_simuladas',
                sql: 'DELETE FROM facturas_simuladas WHERE plan_tratamiento_id = ? OR pago_id IN (SELECT id FROM pagos WHERE plan_tratamiento_id = ?)',
                params: [planId, planId],
            },
            {
                table: 'cobranza_recordatorios',
                sql: 'DELETE FROM cobranza_recordatorios WHERE plan_tratamiento_id = ?',
                params: [planId],
            },
            {
                table: 'pagos',
                sql: 'DELETE FROM pagos WHERE plan_tratamiento_id = ?',
                params: [planId],
            },
            {
                table: 'cuotas_financiamiento',
                sql: 'DELETE FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?',
                params: [planId],
            },
            {
                table: 'planes_financiamiento',
                sql: 'DELETE FROM planes_financiamiento WHERE plan_tratamiento_id = ?',
                params: [planId],
            },
            {
                table: 'planes_tratamiento_medicinas',
                sql: 'DELETE FROM planes_tratamiento_medicinas WHERE plan_id = ?',
                params: [planId],
            },
            {
                table: 'comunicacion_especialistas',
                sql: 'DELETE FROM comunicacion_especialistas WHERE plan_id = ?',
                params: [planId],
            },
            {
                table: 'planes_tratamiento_versiones',
                sql: 'DELETE FROM planes_tratamiento_versiones WHERE plan_tratamiento_id = ?',
                params: [planId],
            },
            {
                table: 'planes_tratamiento_cancelaciones',
                sql: 'DELETE FROM planes_tratamiento_cancelaciones WHERE plan_id = ?',
                params: [planId],
            },
            {
                table: 'planes_tratamiento_diagnosticos',
                sql: 'DELETE FROM planes_tratamiento_diagnosticos WHERE plan_id = ?',
                params: [planId],
            },
            {
                table: 'planes_tratamiento_historial',
                sql: 'DELETE FROM planes_tratamiento_historial WHERE plan_id = ?',
                params: [planId],
            },
        ];

        for (const statement of deleteStatements) {
            if (!(await tableExists(dbHelpers, statement.table))) continue;
            await dbHelpers.run(statement.sql, statement.params);
        }

        await dbHelpers.run('DELETE FROM planes_tratamiento WHERE id = ?', [planId]);

        await recordAudit(dbHelpers, {
            userId,
            action: 'eliminar_plan',
            entity: 'plan_tratamiento',
            entityId: planId,
            payload: {
                paciente_id: plan.paciente_id,
                estado_anterior: plan.estado,
            },
        });

        await recordClinicalAudit(dbHelpers, {
            userId,
            patientId: plan.paciente_id,
            action: 'eliminar_plan_tratamiento',
            module: 'tratamientos',
            detail: {
                plan_id: planId,
                estado_anterior: plan.estado,
            },
        });

        return { ok: true, planId, patientId: plan.paciente_id };
    });
}

async function registerPayment(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

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
            if (normalizePlanStatusValue(plan.estado_general || plan.estado) === 'cancelled') {
                throw new Error('No se puede registrar un pago sobre un plan cancelado.');
            }
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

        const ledgerMovement = await ensureLedgerMovementForPayment(dbHelpers, paymentInsert.lastID);

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

            await syncTreatmentPlanState(dbHelpers, planId);
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
            movementId: ledgerMovement.id,
            cajaId,
            simulatedInvoice,
            summary: await getPatientFinancialSummary(db, patientId),
        };
    });
}

async function registerRefundLegacyUnused(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

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

        const ledgerMovement = await ensureLedgerMovementForPayment(dbHelpers, refundInsert.lastID);

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

            await syncTreatmentPlanState(dbHelpers, planId);
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
            movementId: ledgerMovement.id,
            cajaId,
            simulatedInvoice,
            summary: await getPatientFinancialSummary(db, patientId),
        };
    });
}

async function registerRefundWithDbHelpers(dbHelpers, db, payload = {}) {
    const patientId = Number(payload.paciente_id || 0);
    const userId = resolveUserId(payload);
    const amount = clampMoney(payload.monto, 0);
    const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;

    if (!patientId) throw new Error('Paciente invalido');
    if (!userId) throw new Error('Usuario invalido: se requiere usuario_id (o user_id)');
    if (amount <= 0) throw new Error('El monto de devolucion debe ser mayor a 0');

    const cajaId = await getOpenCajaByUser(dbHelpers, userId);
    if (!cajaId) throw new Error('Debe abrir una caja propia para registrar la devolucion');

    if (planId) {
        const planNetPaid = await getNetPaidForPlan(dbHelpers, planId);
        if (amount > planNetPaid) {
            throw new Error('La devolucion excede lo pagado en el plan');
        }
    } else {
        const summary = await getPatientFinancialSummary(db, patientId);
        if (amount > summary.summary.net_paid) {
            throw new Error('La devolucion excede el neto pagado por el paciente');
        }
    }

    const refundInsert = await dbHelpers.run(
        `INSERT INTO pagos
         (paciente_id, fecha, monto, descripcion, metodo, plan_tratamiento_id, tipo, estado, usuario_id, caja_id, moneda, referencia_externa)
         VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'devolucion', 'aplicado', ?, ?, ?, ?)`,
        [
            patientId,
            amount,
            payload.descripcion || 'Devolucion',
            payload.metodo || 'Devolucion',
            planId,
            userId,
            cajaId,
            payload.moneda || 'MXN',
            payload.referencia_externa || null,
        ]
    );

    const ledgerMovement = await ensureLedgerMovementForPayment(dbHelpers, refundInsert.lastID);

    if (planId) {
        const installments = await getPlanInstallments(dbHelpers, planId);
        if (installments.length) {
            const reversal = reverseAmountFromInstallments(installments, amount);
            if (reversal.remaining > 0.01) {
                throw new Error('No se pudo revertir la devolucion contra las cuotas pagadas');
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

        await syncTreatmentPlanState(dbHelpers, planId);
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
        movementId: ledgerMovement.id,
        cajaId,
        simulatedInvoice,
    };
}

async function registerRefund(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);

    return withTransaction(dbHelpers, async () => {
        const result = await registerRefundWithDbHelpers(dbHelpers, db, payload);
        return {
            ...result,
            summary: await getPatientFinancialSummary(db, Number(payload.paciente_id || 0)),
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
    const invoiceId = payload.factura_id ? Number(payload.factura_id) : payload.id ? Number(payload.id) : null;
    const patientId = payload.paciente_id ? Number(payload.paciente_id) : null;
    const planId = payload.plan_tratamiento_id ? Number(payload.plan_tratamiento_id) : null;
    const paymentId = payload.pago_id ? Number(payload.pago_id) : null;

    const where = [];
    const params = [];

    if (invoiceId) {
        where.push('fs.id = ?');
        params.push(invoiceId);
    }
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

async function getOverdueAccounts(db, options = {}) {
    const dbHelpers = createDbHelpers(db);
    await ensureTreatmentPlanSchema(dbHelpers);
    const asOfDate = formatDate(options.asOfDate || new Date()) || formatDate(new Date());
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
         WHERE date(cf.fecha_vencimiento) < date(?)
           AND round(cf.monto_pagado, 2) < round(cf.monto_programado, 2)
           AND lower(trim(COALESCE(pt.estado, ''))) NOT IN ('cancelado', 'cancelled', 'canceled')
         ORDER BY date(cf.fecha_vencimiento) ASC, p.apellido ASC, p.nombre ASC`
        ,
        [asOfDate]
    );

    const morososByPatient = new Map();
    const overdueInstallments = rows.map(row => {
        const overdueAmount = clampMoney(row.monto_programado - row.monto_pagado, 0);
        const entry = {
            ...row,
            monto_vencido: overdueAmount,
            dias_vencido: Math.max(
                0,
                Math.floor(
                    (new Date(`${asOfDate}T00:00:00`).getTime() - new Date(`${row.fecha_vencimiento}T00:00:00`).getTime()) / 86400000
                )
            ),
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
        as_of_date: asOfDate,
        installments: overdueInstallments,
        patients: Array.from(morososByPatient.values()).sort((left, right) => right.monto_vencido - left.monto_vencido),
    };
}

async function getCashFlowSummary(dbHelpers, startDate, endDate) {
    const ledger = await dbHelpers.get(
        `SELECT
            COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0) AS ingresos_totales,
            COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' AND m.pago_id IS NOT NULL THEN m.monto ELSE 0 END), 0) AS ingresos_pago,
            COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' AND m.pago_id IS NULL THEN m.monto ELSE 0 END), 0) AS ingresos_standalone,
            COALESCE(SUM(
                CASE
                    WHEN m.tipo = 'egreso'
                     AND (
                        lower(COALESCE(p.tipo, '')) = 'devolucion'
                        OR lower(COALESCE(m.origen, '')) LIKE 'devolucion%'
                     )
                    THEN m.monto
                    ELSE 0
                END
            ), 0) AS devoluciones,
            COALESCE(SUM(
                CASE
                    WHEN m.tipo = 'egreso'
                     AND NOT (
                        lower(COALESCE(p.tipo, '')) = 'devolucion'
                        OR lower(COALESCE(m.origen, '')) LIKE 'devolucion%'
                     )
                    THEN m.monto
                    ELSE 0
                END
            ), 0) AS egresos_operativos,
            COUNT(*) AS movimientos
         FROM movimientos_caja m
         LEFT JOIN pagos p ON p.id = m.pago_id
         WHERE date(m.fecha) BETWEEN date(?) AND date(?)`,
        [startDate, endDate]
    );

    const paymentIncome = roundMoney(ledger?.ingresos_pago || 0);
    const standaloneIncome = roundMoney(ledger?.ingresos_standalone || 0);
    const grossIncome = roundMoney(ledger?.ingresos_totales || 0);
    const refunds = roundMoney(ledger?.devoluciones || 0);
    const standaloneExpenses = roundMoney(ledger?.egresos_operativos || 0);
    const netIncome = roundMoney(grossIncome - refunds - standaloneExpenses);

    return {
        payment_income: paymentIncome,
        standalone_income: standaloneIncome,
        gross_income: grossIncome,
        refunds,
        cash_expenses: standaloneExpenses,
        net_income: netIncome,
        total_movements: Number(ledger?.movimientos || 0),
    };
}

async function getCashFlowMonthly(dbHelpers, startDate, endDate) {
    const rows = await dbHelpers.all(
        `SELECT
            strftime('%Y-%m', m.fecha) AS mes,
            COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END), 0) AS neto
         FROM movimientos_caja m
         WHERE date(m.fecha) BETWEEN date(?) AND date(?)
         GROUP BY mes
         ORDER BY mes ASC`,
        [startDate, endDate]
    );

    return rows
        .filter((row) => row?.mes)
        .map((row) => ({
            key: row.mes,
            label: row.mes,
            value: roundMoney(row.neto || 0),
        }))
        .sort((left, right) => left.key.localeCompare(right.key))
        .map(({ key, label, value }) => ({
            key,
            label,
            value,
        }));
}

function mapAppointmentStatus(rows = []) {
    const buckets = {
        completadas: 0,
        pendientes: 0,
        canceladas: 0,
        noAsistio: 0,
    };

    rows.forEach((row) => {
        const status = String(row?.estado || '').trim().toLowerCase();
        const total = Number(row?.total || 0);
        if (status === 'atendido') {
            buckets.completadas += total;
            return;
        }
        if (status === 'cancelado') {
            buckets.canceladas += total;
            return;
        }
        if (status === 'no-asiste' || status === 'no_asiste') {
            buckets.noAsistio += total;
            return;
        }
        if (status) {
            buckets.pendientes += total;
        }
    });

    return buckets;
}

function getWeekdayLabel(weekdayNumber) {
    const labels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return labels[Number(weekdayNumber)] || 'Sin datos';
}

function getInclusiveDays(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function calculateChange(currentValue, previousValue) {
    const current = roundMoney(currentValue || 0);
    const previous = roundMoney(previousValue || 0);
    if (previous === 0) return current > 0 ? 100 : 0;
    return roundMoney(((current - previous) / previous) * 100);
}

async function getAppointmentInsights(dbHelpers, startDate, endDate, appointmentTotal = 0) {
    const [busiestDay, peakHour] = await Promise.all([
        dbHelpers.get(
            `SELECT
                strftime('%w', fecha_hora) AS weekday,
                date(fecha_hora) AS dia,
                COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
               AND estado = 'atendido'
             GROUP BY dia, weekday
             ORDER BY total DESC, dia ASC
             LIMIT 1`,
            [startDate, endDate]
        ),
        dbHelpers.get(
            `SELECT
                strftime('%H:00', fecha_hora) AS hora,
                COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
               AND estado = 'atendido'
             GROUP BY hora
             ORDER BY total DESC, hora ASC
             LIMIT 1`,
            [startDate, endDate]
        ),
    ]);

    return {
        busiest_day: busiestDay?.weekday != null ? getWeekdayLabel(busiestDay.weekday) : 'Sin datos',
        busiest_day_date: busiestDay?.dia || null,
        peak_hour: peakHour?.hora || 'Sin datos',
        average_per_day: roundMoney(Number(appointmentTotal || 0) / getInclusiveDays(startDate, endDate)),
    };
}

async function getPatientRisk(dbHelpers, referenceDate) {
    const safeReferenceDate = formatDate(referenceDate) || formatDate(new Date());
    const [rows, totalPatientsRow] = await Promise.all([
        dbHelpers.all(
            `SELECT *
             FROM (
                SELECT
                    p.id AS paciente_id,
                    p.nombre,
                    p.apellido,
                    p.telefono,
                    p.email,
                    COALESCE(
                        MAX(CASE WHEN c.estado = 'atendido' THEN date(c.fecha_hora) END),
                        date(COALESCE(p.created_at, p.fecha_registro))
                    ) AS ultima_actividad
                FROM pacientes p
                LEFT JOIN citas c ON c.paciente_id = p.id
                GROUP BY p.id
             ) riesgo
             WHERE ultima_actividad IS NOT NULL
               AND julianday(date(?)) - julianday(date(ultima_actividad)) >= 180
             ORDER BY date(ultima_actividad) ASC, apellido ASC, nombre ASC
             LIMIT 100`,
            [safeReferenceDate]
        ),
        dbHelpers.get('SELECT COUNT(*) AS total FROM pacientes'),
    ]);

    const patients = rows.map((row) => ({
        paciente_id: row.paciente_id,
        nombre: row.nombre,
        apellido: row.apellido,
        telefono: row.telefono,
        email: row.email,
        ultima_actividad: row.ultima_actividad,
        dias_sin_actividad: Math.max(
            0,
            Math.floor(
                (new Date(`${safeReferenceDate}T00:00:00`).getTime() - new Date(`${row.ultima_actividad}T00:00:00`).getTime()) / 86400000
            )
        ),
    }));

    return {
        as_of_date: safeReferenceDate,
        total_patients: Number(totalPatientsRow?.total || 0),
        patients,
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
    await ensureTreatmentPlanSchema(dbHelpers);
    const { prevStart, prevEnd } = getPeriodRange(startDate, endDate);

    const [
        currentCashFlow,
        previousCashFlow,
        citas,
        citasPrevias,
        appointmentStatusRows,
        newPatients,
        monthlyIncome,
        specialistProduction,
        treatments,
        overdue,
        patientRisk,
    ] = await Promise.all([
        getCashFlowSummary(dbHelpers, startDate, endDate),
        getCashFlowSummary(dbHelpers, prevStart, prevEnd),
        dbHelpers.get(
            `SELECT COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
               AND estado = 'atendido'`,
            [startDate, endDate]
        ),
        dbHelpers.get(
            `SELECT COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
               AND estado = 'atendido'`,
            [prevStart, prevEnd]
        ),
        dbHelpers.all(
            `SELECT lower(estado) AS estado, COUNT(*) AS total
             FROM citas
             WHERE date(fecha_hora) BETWEEN date(?) AND date(?)
             GROUP BY lower(estado)`,
            [startDate, endDate]
        ),
        dbHelpers.get(
            `SELECT COUNT(*) AS total
             FROM pacientes
             WHERE date(COALESCE(created_at, fecha_registro)) BETWEEN date(?) AND date(?)`,
            [startDate, endDate]
        ),
        getCashFlowMonthly(dbHelpers, startDate, endDate),
        dbHelpers.all(
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
        ),
        dbHelpers.all(
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
        ),
        getOverdueAccounts(db, { asOfDate: endDate }),
        getPatientRisk(dbHelpers, endDate),
    ]);

    const appointments = Number(citas?.total || 0);
    const previousAppointments = Number(citasPrevias?.total || 0);
    const appointmentInsights = await getAppointmentInsights(dbHelpers, startDate, endDate, appointments);
    const incomeChange = calculateChange(currentCashFlow.net_income, previousCashFlow.net_income);
    const appointmentsChange = calculateChange(appointments, previousAppointments);
    const ticket = appointments > 0 ? roundMoney(currentCashFlow.gross_income / appointments) : 0;
    const atRiskPatients = Number(patientRisk.patients.length || 0);
    const retentionRate = patientRisk.total_patients > 0
        ? roundMoney(((patientRisk.total_patients - atRiskPatients) / patientRisk.total_patients) * 100)
        : 100;

    return {
        summary: {
            gross_income: currentCashFlow.gross_income,
            refunds: currentCashFlow.refunds,
            cash_expenses: currentCashFlow.cash_expenses,
            standalone_income: currentCashFlow.standalone_income,
            net_income: currentCashFlow.net_income,
            total_movements: currentCashFlow.total_movements,
            appointments,
            appointments_change: appointmentsChange,
            new_patients: Number(newPatients?.total || 0),
            total_patients: Number(patientRisk.total_patients || 0),
            ticket_average: ticket,
            income_change: incomeChange,
            overdue_amount: roundMoney(overdue.patients.reduce((sum, item) => sum + roundMoney(item.monto_vencido), 0)),
            overdue_patients: overdue.patients.length,
            at_risk_patients: atRiskPatients,
            retention_rate: retentionRate,
        },
        monthlyIncome,
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
        appointmentStatus: mapAppointmentStatus(appointmentStatusRows),
        appointmentInsights,
        overdue,
        patientRisk,
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
            pt.estado AS plan_estado,
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
    if (normalizePlanStatusValue(quota.plan_estado) === 'cancelled') {
        throw new Error('No se puede enviar cobranza de un plan cancelado.');
    }

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
        if (error.code === 'MAIL_SERVICE_UNAVAILABLE' || String(error.message || '').includes('MAIL_SERVICE')) {
            throw new Error('El servicio oficial de correo no esta disponible');
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
    buildPlanLifecycle,
    saveTreatmentPlan,
    getTreatmentPlanDetail,
    getPatientFinancialSummary,
    updateTreatmentPlanProgress,
    setTreatmentPlanStatus,
    cancelTreatmentPlan,
    deleteTreatmentPlan,
    registerPayment,
    registerRefund,
    generateSimulatedInvoice,
    getSimulatedInvoices,
    getOverdueAccounts,
    getFinanceReport,
    sendCollectionReminder,
};
