const sqlite3 = require('sqlite3');

const { cancelTreatmentPlan } = require('../../main/finance-service');

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

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

async function seedFinanceDb({ paymentAmount = 0 } = {}) {
    const db = openMemoryDb();

    await exec(db, `
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY,
            nombre TEXT,
            apellido TEXT,
            apellidos TEXT,
            email TEXT
        );
        CREATE TABLE cajas (
            id INTEGER PRIMARY KEY,
            usuario_id INTEGER,
            estado TEXT,
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE auditoria_financiera (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            accion TEXT,
            entidad TEXT,
            entidad_id INTEGER,
            payload TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caja_id INTEGER,
            pago_id INTEGER,
            tipo TEXT,
            monto REAL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            origen TEXT,
            paciente_id INTEGER,
            usuario_id INTEGER
        );
        CREATE TABLE tratamientos_catalogo (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            costo_base REAL DEFAULT 0,
            costo_medicina_estandar REAL DEFAULT 0,
            costo_miscelanea_estandar REAL DEFAULT 0
        );
        CREATE TABLE planes_tratamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            catalogo_id INTEGER NOT NULL,
            estado TEXT DEFAULT 'pendiente',
            fecha_inicio TEXT,
            fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP,
            fecha_finalizacion TEXT,
            costo_total REAL DEFAULT 0,
            total_final REAL DEFAULT 0,
            subtotal_neto REAL DEFAULT 0,
            descuento_tipo TEXT DEFAULT 'ninguno',
            descuento_valor REAL DEFAULT 0,
            descuento_monto REAL DEFAULT 0,
            impuesto_tipo TEXT DEFAULT 'ninguno',
            impuesto_valor REAL DEFAULT 0,
            impuesto_monto REAL DEFAULT 0,
            version_comercial INTEGER DEFAULT 1,
            progreso INTEGER DEFAULT 0,
            progreso_clinico INTEGER DEFAULT 0,
            estado_clinico TEXT DEFAULT 'pendiente',
            especialista_asignado TEXT,
            notas TEXT,
            diente TEXT,
            caras TEXT
        );
        CREATE TABLE planes_financiamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER,
            frecuencia TEXT,
            numero_cuotas INTEGER,
            anticipo REAL DEFAULT 0,
            interes_porcentaje REAL DEFAULT 0,
            fecha_primer_vencimiento TEXT,
            activo INTEGER DEFAULT 1,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE cuotas_financiamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_financiamiento_id INTEGER,
            plan_tratamiento_id INTEGER NOT NULL,
            numero INTEGER,
            es_anticipo INTEGER DEFAULT 0,
            fecha_vencimiento TEXT,
            monto_programado REAL DEFAULT 0,
            monto_pagado REAL DEFAULT 0,
            estado TEXT DEFAULT 'pendiente',
            fecha_ultimo_pago DATETIME
        );
        CREATE TABLE pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            monto REAL NOT NULL,
            descripcion TEXT,
            metodo TEXT,
            plan_tratamiento_id INTEGER,
            tipo TEXT DEFAULT 'pago',
            estado TEXT DEFAULT 'aplicado',
            usuario_id INTEGER,
            caja_id INTEGER,
            moneda TEXT DEFAULT 'MXN',
            referencia_externa TEXT
        );
        CREATE TABLE pagos_aplicaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pago_id INTEGER,
            cuota_financiamiento_id INTEGER,
            monto_aplicado REAL
        );
        CREATE TABLE facturas_simuladas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT,
            fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
            paciente_id INTEGER,
            plan_tratamiento_id INTEGER,
            pago_id INTEGER,
            tipo TEXT,
            estado TEXT DEFAULT 'emitida',
            moneda TEXT DEFAULT 'MXN',
            subtotal REAL DEFAULT 0,
            descuento REAL DEFAULT 0,
            impuesto REAL DEFAULT 0,
            total REAL DEFAULT 0,
            metodo_pago TEXT,
            concepto TEXT,
            observaciones TEXT,
            creado_por INTEGER,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE planes_tratamiento_historial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER,
            paciente_id INTEGER,
            catalogo_id INTEGER,
            especialista_ejecuto TEXT,
            costo_total REAL DEFAULT 0,
            fecha_ejecucion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE planes_tratamiento_versiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_tratamiento_id INTEGER,
            version_num INTEGER,
            estado_version TEXT DEFAULT 'vigente',
            motivo_cambio TEXT,
            costo_total REAL DEFAULT 0,
            descuento_tipo TEXT DEFAULT 'ninguno',
            descuento_valor REAL DEFAULT 0,
            descuento_monto REAL DEFAULT 0,
            subtotal_neto REAL DEFAULT 0,
            impuesto_tipo TEXT DEFAULT 'ninguno',
            impuesto_valor REAL DEFAULT 0,
            impuesto_monto REAL DEFAULT 0,
            total_final REAL DEFAULT 0,
            diente TEXT,
            caras TEXT,
            notas TEXT,
            financiamiento_json TEXT,
            snapshot_json TEXT,
            creado_por INTEGER,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TRIGGER trg_test_payment_ledger
        AFTER INSERT ON pagos
        BEGIN
            INSERT INTO movimientos_caja (caja_id, pago_id, tipo, monto, fecha, origen, paciente_id, usuario_id)
            VALUES (
                NEW.caja_id,
                NEW.id,
                CASE WHEN lower(COALESCE(NEW.tipo, 'pago')) = 'devolucion' THEN 'egreso' ELSE 'ingreso' END,
                NEW.monto,
                COALESCE(NEW.fecha, CURRENT_TIMESTAMP),
                COALESCE(NEW.tipo, 'pago'),
                NEW.paciente_id,
                NEW.usuario_id
            );
        END;
    `);

    await run(db, 'INSERT INTO usuarios (id, nombre, apellido, email) VALUES (7, ?, ?, ?)', ['Demo', 'Tester', 'demo@example.com']);
    await run(db, 'INSERT INTO cajas (id, usuario_id, estado) VALUES (1, 7, ?)', ['abierta']);
    await run(
        db,
        'INSERT INTO tratamientos_catalogo (id, nombre, descripcion, costo_base) VALUES (1, ?, ?, ?)',
        ['Endodoncia', 'Tratamiento dental', 1000]
    );

    const planInsert = await run(
        db,
        `INSERT INTO planes_tratamiento
         (paciente_id, catalogo_id, estado, fecha_inicio, fecha_creacion, costo_total, total_final, subtotal_neto, descuento_tipo, descuento_valor, descuento_monto, impuesto_tipo, impuesto_valor, impuesto_monto, version_comercial, progreso, progreso_clinico, estado_clinico, especialista_asignado, notas, diente, caras)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ninguno', 0, 0, 'ninguno', 0, 0, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
            1,
            1,
            'en_progreso',
            '2026-03-01',
            '2026-03-01',
            1000,
            1000,
            1000,
            paymentAmount > 0 ? 45 : 0,
            paymentAmount > 0 ? 45 : 0,
            paymentAmount > 0 ? 'en_progreso' : 'pendiente',
            'Dr. Test',
            'Plan de prueba',
            '11',
            JSON.stringify(['mesial']),
        ]
    );

    await run(
        db,
        `INSERT INTO cuotas_financiamiento
         (plan_tratamiento_id, numero, es_anticipo, fecha_vencimiento, monto_programado, monto_pagado, estado, fecha_ultimo_pago)
         VALUES (?, 1, 0, ?, ?, ?, ?, CASE WHEN ? > 0 THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        [
            planInsert.lastID,
            '2026-04-10',
            1000,
            paymentAmount,
            paymentAmount > 0 && paymentAmount < 1000 ? 'parcial' : (paymentAmount >= 1000 ? 'pagada' : 'pendiente'),
            paymentAmount,
        ]
    );

    if (paymentAmount > 0) {
        const paymentInsert = await run(
            db,
            `INSERT INTO pagos
             (paciente_id, fecha, monto, descripcion, metodo, plan_tratamiento_id, tipo, estado, usuario_id, caja_id, moneda)
             VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'pago', 'aplicado', ?, ?, 'MXN')`,
            [1, paymentAmount, 'Pago inicial', 'Efectivo', planInsert.lastID, 7, 1]
        );

        const quota = await get(db, 'SELECT id FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?', [planInsert.lastID]);
        await run(
            db,
            'INSERT INTO pagos_aplicaciones (pago_id, cuota_financiamiento_id, monto_aplicado) VALUES (?, ?, ?)',
            [paymentInsert.lastID, quota.id, paymentAmount]
        );
    }

    return { db, planId: planInsert.lastID };
}

describe('Finance Service cancellation flow', () => {
    test('cancela con devolucion total y limpia la proyeccion pendiente', async () => {
        const { db, planId } = await seedFinanceDb({ paymentAmount: 600 });

        try {
            const result = await cancelTreatmentPlan(db, {
                plan_id: planId,
                usuario_id: 7,
                politica_cancelacion: 'devolucion_total',
                motivo: 'Paciente abandono el tratamiento',
            });

            expect(result.policy).toBe('refund_full');
            expect(result.refundAmount).toBe(600);
            expect(result.detail.estado_general).toBe('cancelado');
            expect(result.detail.financial_summary.pending).toBe(0);
            expect(result.summary.summary.total_planned).toBe(0);
            expect(result.summary.summary.total_pending).toBe(0);

            const refundRow = await get(db, "SELECT monto FROM pagos WHERE plan_tratamiento_id = ? AND tipo = 'devolucion'", [planId]);
            const quotaRow = await get(db, 'SELECT estado, monto_pagado FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
            const planRow = await get(db, 'SELECT politica_cancelacion, monto_reembolsado, monto_conservado FROM planes_tratamiento WHERE id = ?', [planId]);
            const cancellationRow = await get(db, 'SELECT politica, monto_reembolsado, monto_conservado FROM planes_tratamiento_cancelaciones WHERE plan_id = ?', [planId]);

            expect(refundRow.monto).toBe(600);
            expect(quotaRow.estado).toBe('cancelada');
            expect(quotaRow.monto_pagado).toBe(0);
            expect(planRow.politica_cancelacion).toBe('refund_full');
            expect(planRow.monto_reembolsado).toBe(600);
            expect(planRow.monto_conservado).toBe(0);
            expect(cancellationRow.politica).toBe('refund_full');
        } finally {
            await close(db);
        }
    });

    test('cancela sin devolucion y conserva el ingreso auditado', async () => {
        const { db, planId } = await seedFinanceDb({ paymentAmount: 400 });

        try {
            const result = await cancelTreatmentPlan(db, {
                plan_id: planId,
                usuario_id: 7,
                politica_cancelacion: 'sin_devolucion',
                motivo: 'Cambio de decision clinica',
            });

            expect(result.policy).toBe('keep_income');
            expect(result.refundAmount).toBe(0);
            expect(result.keptAmount).toBe(400);
            expect(result.detail.estado_general).toBe('cancelado');
            expect(result.detail.financial_summary.net_paid).toBe(400);
            expect(result.summary.summary.total_planned).toBe(0);
            expect(result.summary.summary.total_pending).toBe(0);

            const refundRow = await get(db, "SELECT id FROM pagos WHERE plan_tratamiento_id = ? AND tipo = 'devolucion'", [planId]);
            const planRow = await get(db, 'SELECT monto_reembolsado, monto_conservado FROM planes_tratamiento WHERE id = ?', [planId]);

            expect(refundRow).toBeNull();
            expect(planRow.monto_reembolsado).toBe(0);
            expect(planRow.monto_conservado).toBe(400);
        } finally {
            await close(db);
        }
    });

    test('cancela con devolucion parcial y recalcula el neto retenido', async () => {
        const { db, planId } = await seedFinanceDb({ paymentAmount: 600 });

        try {
            const result = await cancelTreatmentPlan(db, {
                plan_id: planId,
                usuario_id: 7,
                politica_cancelacion: 'devolucion_parcial',
                monto_reembolsado: 250,
                motivo: 'Ajuste comercial autorizado',
            });

            expect(result.policy).toBe('refund_partial');
            expect(result.refundAmount).toBe(250);
            expect(result.keptAmount).toBe(350);
            expect(result.detail.estado_general).toBe('cancelado');
            expect(result.detail.financial_summary.net_paid).toBe(350);
            expect(result.summary.summary.net_paid).toBe(350);
            expect(result.summary.summary.total_planned).toBe(0);
            expect(result.summary.summary.total_pending).toBe(0);

            const refundRow = await get(db, "SELECT monto FROM pagos WHERE plan_tratamiento_id = ? AND tipo = 'devolucion'", [planId]);
            const quotaRow = await get(db, 'SELECT estado, monto_pagado FROM cuotas_financiamiento WHERE plan_tratamiento_id = ?', [planId]);
            const planRow = await get(db, 'SELECT monto_reembolsado, monto_conservado FROM planes_tratamiento WHERE id = ?', [planId]);

            expect(refundRow.monto).toBe(250);
            expect(quotaRow.estado).toBe('cancelada');
            expect(quotaRow.monto_pagado).toBe(350);
            expect(planRow.monto_reembolsado).toBe(250);
            expect(planRow.monto_conservado).toBe(350);
        } finally {
            await close(db);
        }
    });
});
