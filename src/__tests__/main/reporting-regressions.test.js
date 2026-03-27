const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const {
    getFinanceReport,
    getOverdueAccounts,
} = require('../../main/finance-service');

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

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

async function seedReportingDb() {
    const db = openMemoryDb();

    await exec(db, `
        CREATE TABLE pagos (
            id INTEGER PRIMARY KEY,
            fecha TEXT,
            tipo TEXT,
            estado TEXT,
            monto REAL,
            metodo TEXT,
            descripcion TEXT,
            plan_tratamiento_id INTEGER
        );
        CREATE TABLE movimientos_caja (
            id INTEGER PRIMARY KEY,
            fecha TEXT,
            tipo TEXT,
            monto REAL,
            pago_id INTEGER,
            metodo TEXT,
            origen TEXT
        );
        CREATE TABLE pacientes (
            id INTEGER PRIMARY KEY,
            nombre TEXT,
            apellido TEXT,
            email TEXT,
            telefono TEXT,
            created_at TEXT,
            fecha_registro TEXT
        );
        CREATE TABLE citas (
            id INTEGER PRIMARY KEY,
            fecha_hora TEXT,
            estado TEXT,
            paciente_id INTEGER,
            dentista_id INTEGER,
            especialista_id INTEGER,
            monto REAL
        );
        CREATE TABLE tratamientos_catalogo (
            id INTEGER PRIMARY KEY,
            nombre TEXT
        );
        CREATE TABLE planes_tratamiento (
            id INTEGER PRIMARY KEY,
            paciente_id INTEGER,
            catalogo_id INTEGER
        );
        CREATE TABLE cuotas_financiamiento (
            id INTEGER PRIMARY KEY,
            plan_tratamiento_id INTEGER,
            numero INTEGER,
            es_anticipo INTEGER,
            fecha_vencimiento TEXT,
            monto_programado REAL,
            monto_pagado REAL
        );
        CREATE TABLE planes_tratamiento_historial (
            id INTEGER PRIMARY KEY,
            especialista_ejecuto TEXT,
            fecha_ejecucion TEXT,
            costo_total REAL,
            catalogo_id INTEGER,
            descripcion_procedimiento TEXT
        );
        CREATE TABLE tratamientos (
            id INTEGER PRIMARY KEY,
            procedimiento TEXT,
            costo REAL,
            fecha TEXT
        );
    `);

    await run(
        db,
        `INSERT INTO pacientes (id, nombre, apellido, email, telefono, created_at, fecha_registro)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 'Ana', 'Ruiz', 'ana@example.com', '5551111111', '2025-01-01', '2025-01-01']
    );
    await run(
        db,
        `INSERT INTO pacientes (id, nombre, apellido, email, telefono, created_at, fecha_registro)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [2, 'Luis', 'Perez', 'luis@example.com', '5552222222', '2026-03-05', '2026-03-05']
    );

    await run(db, `INSERT INTO tratamientos_catalogo (id, nombre) VALUES (?, ?)`, [1, 'Ortodoncia']);
    await run(db, `INSERT INTO planes_tratamiento (id, paciente_id, catalogo_id) VALUES (?, ?, ?)`, [1, 1, 1]);

    await run(
        db,
        `INSERT INTO cuotas_financiamiento
         (id, plan_tratamiento_id, numero, es_anticipo, fecha_vencimiento, monto_programado, monto_pagado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [1, 1, 1, 0, '2026-03-15', 500, 200]
    );
    await run(
        db,
        `INSERT INTO cuotas_financiamiento
         (id, plan_tratamiento_id, numero, es_anticipo, fecha_vencimiento, monto_programado, monto_pagado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [2, 1, 2, 0, '2026-04-15', 500, 0]
    );

    await run(
        db,
        `INSERT INTO pagos (id, fecha, tipo, estado, monto, metodo, descripcion, plan_tratamiento_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [1, '2026-03-02', 'pago', 'aplicado', 1000, 'tarjeta', 'Pago marzo', 1]
    );
    await run(
        db,
        `INSERT INTO pagos (id, fecha, tipo, estado, monto, metodo, descripcion, plan_tratamiento_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [2, '2026-03-03', 'devolucion', 'aplicado', 100, 'tarjeta', 'Devolucion marzo', 1]
    );
    await run(
        db,
        `INSERT INTO pagos (id, fecha, tipo, estado, monto, metodo, descripcion, plan_tratamiento_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [3, '2026-02-15', 'pago', 'aplicado', 400, 'efectivo', 'Pago febrero', 1]
    );
    await run(
        db,
        `INSERT INTO pagos (id, fecha, tipo, estado, monto, metodo, descripcion, plan_tratamiento_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [4, '2026-03-18', 'pago', 'aplicado', 999, 'efectivo', 'Pago huerfano', 1]
    );

    await run(
        db,
        `INSERT INTO movimientos_caja (id, fecha, tipo, monto, pago_id, metodo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [1, '2026-03-02', 'ingreso', 1000, 1, 'tarjeta']
    );
    await run(
        db,
        `INSERT INTO movimientos_caja (id, fecha, tipo, monto, pago_id, metodo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [2, '2026-03-03', 'egreso', 100, 2, 'tarjeta']
    );
    await run(
        db,
        `INSERT INTO movimientos_caja (id, fecha, tipo, monto, pago_id, metodo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [3, '2026-02-15', 'ingreso', 400, 3, 'efectivo']
    );
    await run(
        db,
        `INSERT INTO movimientos_caja (id, fecha, tipo, monto, pago_id, metodo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [4, '2026-03-08', 'ingreso', 250, null, 'efectivo']
    );
    await run(
        db,
        `INSERT INTO movimientos_caja (id, fecha, tipo, monto, pago_id, metodo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [5, '2026-03-09', 'egreso', 60, null, 'transferencia']
    );

    const appointments = [
        [1, '2026-03-04 10:00:00', 'atendido', 2, null, null, 300],
        [2, '2026-03-04 10:30:00', 'atendido', 2, null, null, 300],
        [3, '2026-03-04 11:00:00', 'atendido', 2, null, null, 300],
        [4, '2026-03-06 09:00:00', 'atendido', 2, null, null, 300],
        [5, '2026-03-07 08:00:00', 'cancelado', 2, null, null, 0],
        [6, '2026-03-07 12:00:00', 'pendiente', 2, null, null, 0],
        [7, '2026-03-08 12:00:00', 'no-asiste', 2, null, null, 0],
        [8, '2026-02-20 09:00:00', 'atendido', 2, null, null, 200],
        [9, '2026-02-21 09:00:00', 'atendido', 2, null, null, 200],
        [10, '2025-08-01 09:00:00', 'atendido', 1, null, null, 150],
    ];

    for (const appointment of appointments) {
        await run(
            db,
            `INSERT INTO citas (id, fecha_hora, estado, paciente_id, dentista_id, especialista_id, monto)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            appointment
        );
    }

    await run(
        db,
        `INSERT INTO planes_tratamiento_historial
         (id, especialista_ejecuto, fecha_ejecucion, costo_total, catalogo_id, descripcion_procedimiento)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [1, 'Dr. Uno', '2026-03-10', 600, 1, 'Ortodoncia integral']
    );
    await run(
        db,
        `INSERT INTO tratamientos (id, procedimiento, costo, fecha)
         VALUES (?, ?, ?, ?)`,
        [1, 'Limpieza', 300, '2026-03-12']
    );

    return db;
}

describe('Reporting regressions', () => {
    let db;

    beforeEach(async () => {
        db = await seedReportingDb();
    });

    afterEach(async () => {
        if (db) await close(db);
        db = null;
    });

    test('getFinanceReport usa movimientos_caja como fuente financiera y recalcula KPIs reales', async () => {
        const report = await getFinanceReport(db, {
            startDate: '2026-03-01',
            endDate: '2026-03-31',
        });

        expect(report.summary.gross_income).toBe(1250);
        expect(report.summary.refunds).toBe(100);
        expect(report.summary.cash_expenses).toBe(60);
        expect(report.summary.standalone_income).toBe(250);
        expect(report.summary.net_income).toBe(1090);
        expect(report.summary.income_change).toBe(172.5);
        expect(report.summary.appointments).toBe(4);
        expect(report.summary.appointments_change).toBe(100);
        expect(report.summary.new_patients).toBe(1);
        expect(report.summary.total_patients).toBe(2);
        expect(report.summary.ticket_average).toBe(312.5);
        expect(report.summary.overdue_amount).toBe(300);
        expect(report.summary.overdue_patients).toBe(1);
        expect(report.summary.at_risk_patients).toBe(1);
        expect(report.summary.retention_rate).toBe(50);

        const marchRow = report.monthlyIncome.find((row) => row.key === '2026-03');
        expect(marchRow).toEqual(expect.objectContaining({ value: 1090 }));
        expect(report.summary.gross_income).not.toBe(2249);
        expect(report.appointmentStatus).toEqual({
            completadas: 4,
            pendientes: 1,
            canceladas: 1,
            noAsistio: 1,
        });
        expect(report.appointmentInsights.peak_hour).toBe('10:00');
        expect(report.appointmentInsights.average_per_day).toBeCloseTo(0.13, 2);
        expect(report.overdue.as_of_date).toBe('2026-03-31');
        expect(report.treatments.map((row) => row.nombre)).toEqual(expect.arrayContaining(['Ortodoncia', 'Limpieza']));
    });

    test('getOverdueAccounts usa la fecha de corte en lugar de la fecha del sistema', async () => {
        const beforeDue = await getOverdueAccounts(db, { asOfDate: '2026-03-10' });
        const afterDue = await getOverdueAccounts(db, { asOfDate: '2026-03-31' });

        expect(beforeDue.as_of_date).toBe('2026-03-10');
        expect(beforeDue.patients).toHaveLength(0);
        expect(afterDue.as_of_date).toBe('2026-03-31');
        expect(afterDue.patients).toHaveLength(1);
        expect(afterDue.patients[0]).toEqual(expect.objectContaining({
            paciente_id: 1,
            cuotas_vencidas: 1,
            monto_vencido: 300,
        }));
        expect(afterDue.installments[0].dias_vencido).toBe(16);
    });
});

describe('Main report IPC wiring', () => {
    test('usa los exports correctos del servicio en los handlers finales', () => {
        const mainSource = fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8');

        expect(mainSource).toContain("return financeService.getOverdueAccounts(db, payload || {});");
        expect(mainSource).toContain("return financeService.getFinanceReport(db, payload || {});");
        expect(mainSource).toContain("return cajasReportService.getSaldosPorMetodo(db, payload || {});");
        expect(mainSource).not.toContain("return financeService.getReport(db, payload || {});");
        expect(mainSource).not.toContain("return cajasReportService.getSaldosMetodo(db, payload || {});");
    });
});

describe('Cash ledger guardrails', () => {
    test('database define triggers para sincronizar pagos con movimientos_caja', () => {
        const dbSource = fs.readFileSync(path.join(__dirname, '../../db/database.js'), 'utf8');

        expect(dbSource).toContain('trg_pagos_sync_movimiento_insert');
        expect(dbSource).toContain('trg_pagos_sync_movimiento_update');
        expect(dbSource).toContain('trg_pagos_sync_movimiento_delete');
        expect(dbSource).toContain('trg_movimientos_caja_pago_unico_insert');
    });

    test('finance-service valida que el ledger se haya sincronizado al registrar pagos y devoluciones', () => {
        const financeSource = fs.readFileSync(path.join(__dirname, '../../main/finance-service.js'), 'utf8');

        expect(financeSource).toContain('async function ensureLedgerMovementForPayment');
        expect(financeSource).toContain('movementId: ledgerMovement.id');
    });
});
