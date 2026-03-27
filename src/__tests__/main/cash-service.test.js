const sqlite3 = require('sqlite3');

const {
    openCashBox,
    closeCashBox,
    recordMovement,
} = require('../../main/cash-service');

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

async function seedCashDb() {
    const db = openMemoryDb();

    await exec(db, `
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY,
            nombre TEXT,
            rol TEXT
        );
        CREATE TABLE cajas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_cierre DATETIME,
            saldo_inicial REAL DEFAULT 0,
            saldo_final REAL,
            estado TEXT DEFAULT 'abierta',
            notas TEXT,
            arqueo TEXT
        );
        CREATE TABLE movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caja_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            monto REAL NOT NULL,
            concepto TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            usuario_id INTEGER,
            pago_id INTEGER,
            paciente_id INTEGER,
            metodo TEXT,
            origen TEXT DEFAULT 'manual'
        );
        CREATE TABLE auditoria_financiera (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            accion TEXT NOT NULL,
            entidad TEXT NOT NULL,
            entidad_id INTEGER,
            payload TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await run(db, 'INSERT INTO usuarios (id, nombre, rol) VALUES (?, ?, ?)', [1, 'Admin', 'Administrador']);
    await run(db, 'INSERT INTO usuarios (id, nombre, rol) VALUES (?, ?, ?)', [2, 'Caja Uno', 'Recepcionista']);
    await run(db, 'INSERT INTO usuarios (id, nombre, rol) VALUES (?, ?, ?)', [3, 'Caja Dos', 'Recepcionista']);

    return db;
}

describe('Cash Service', () => {
    test('openCashBox crea la caja y registra auditoria', async () => {
        const db = await seedCashDb();

        try {
            const result = await openCashBox(db, {
                usuario_id: 2,
                saldo_inicial: 150.25,
                notas: 'Turno matutino',
            });

            expect(result.ok).toBe(true);
            expect(result.usuario_id).toBe(2);

            const caja = await get(db, 'SELECT * FROM cajas WHERE id = ?', [result.caja_id]);
            expect(caja.estado).toBe('abierta');
            expect(Number(caja.saldo_inicial)).toBe(150.25);

            const audit = await get(
                db,
                "SELECT accion, entidad, entidad_id FROM auditoria_financiera WHERE accion = 'abrir_caja' ORDER BY id DESC LIMIT 1"
            );
            expect(audit).toEqual({
                accion: 'abrir_caja',
                entidad: 'caja',
                entidad_id: result.caja_id,
            });
        } finally {
            await close(db);
        }
    });

    test('openCashBox bloquea abrir dos cajas simultaneas para el mismo usuario', async () => {
        const db = await seedCashDb();

        try {
            await openCashBox(db, { usuario_id: 2, saldo_inicial: 100 });

            await expect(openCashBox(db, { usuario_id: 2, saldo_inicial: 50 })).rejects.toMatchObject({
                code: 'OPEN_BOX_EXISTS',
            });
        } finally {
            await close(db);
        }
    });

    test('closeCashBox permite cierre administrativo sobre caja ajena y guarda arqueo', async () => {
        const db = await seedCashDb();

        try {
            const opened = await openCashBox(db, { usuario_id: 2, saldo_inicial: 80 });
            const arqueo = {
                billetes: { 500: 1 },
                monedas: { 10: 2 },
                totalContado: 520,
                diferencia: 440,
            };

            const result = await closeCashBox(db, {
                caja_id: opened.caja_id,
                usuario_id: 1,
                saldo_final: 520,
                diferencia: 440,
                arqueo,
            });

            expect(result.ok).toBe(true);
            expect(result.estado).toBe('cerrada');

            const caja = await get(db, 'SELECT estado, saldo_final, arqueo FROM cajas WHERE id = ?', [opened.caja_id]);
            expect(caja.estado).toBe('cerrada');
            expect(Number(caja.saldo_final)).toBe(520);
            expect(JSON.parse(caja.arqueo)).toEqual(arqueo);
        } finally {
            await close(db);
        }
    });

    test('recordMovement usa la caja propia abierta del usuario cuando no se envia caja_id', async () => {
        const db = await seedCashDb();

        try {
            const opened = await openCashBox(db, { usuario_id: 2, saldo_inicial: 40 });
            const result = await recordMovement(db, {
                usuario_id: 2,
                tipo: 'ingreso',
                monto: 125.5,
                concepto: 'Receta rapida',
                paciente_id: 99,
                origen: 'receta_rapida',
            });

            expect(result.ok).toBe(true);
            expect(result.caja_id).toBe(opened.caja_id);

            const movement = await get(db, 'SELECT caja_id, tipo, monto, origen, paciente_id FROM movimientos_caja WHERE id = ?', [result.movimiento_id]);
            expect(movement).toEqual({
                caja_id: opened.caja_id,
                tipo: 'ingreso',
                monto: 125.5,
                origen: 'receta_rapida',
                paciente_id: 99,
            });
        } finally {
            await close(db);
        }
    });

    test('recordMovement rechaza registrar movimientos en cajas ajenas sin privilegios', async () => {
        const db = await seedCashDb();

        try {
            const opened = await openCashBox(db, { usuario_id: 2, saldo_inicial: 40 });

            await expect(recordMovement(db, {
                usuario_id: 3,
                caja_id: opened.caja_id,
                tipo: 'egreso',
                monto: 10,
                concepto: 'Ajuste',
                origen: 'manual',
            })).rejects.toThrow(/permisos/i);
        } finally {
            await close(db);
        }
    });
});
