const sqlite3 = require('sqlite3');

const {
    getAppSettings,
    getClinicConfig,
    getSystemConfig,
    saveAppSettings,
    saveClinicConfig,
    saveSystemConfig,
} = require('../../main/clinic-config-service');

function openMemoryDb() {
    return new sqlite3.Database(':memory:');
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

describe('Clinic Config Service', () => {
    test('crea admin_config automaticamente y persiste identidad clinica', async () => {
        const db = openMemoryDb();

        try {
            const saveResult = await saveClinicConfig(db, {
                clinica_nombre: 'Clinica Central',
                clinica_titular: 'Dra. Rivera',
                clinica_telefono: '555-0101',
            });

            const config = await getClinicConfig(db);
            const table = await get(
                db,
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_config'"
            );

            expect(table?.name).toBe('admin_config');
            expect(saveResult.ok).toBe(true);
            expect(saveResult.saved).toBe(3);
            expect(saveResult.clinicIdentity).toMatchObject({
                clinica_nombre: 'Clinica Central',
                clinica_titular: 'Dra. Rivera',
                clinica_telefono: '555-0101',
            });
            expect(config).toMatchObject({
                clinica_nombre: 'Clinica Central',
                clinica_titular: 'Dra. Rivera',
                clinica_telefono: '555-0101',
            });
        } finally {
            await close(db);
        }
    });

    test('ignora claves no permitidas y normaliza valores vacios', async () => {
        const db = openMemoryDb();

        try {
            await saveClinicConfig(db, {
                clinica_nombre: '  Dental Norte  ',
                clinica_rfc: '   ',
                clave_invalida: 'no debe guardarse',
            });

            const config = await getClinicConfig(db);
            const invalidRow = await get(
                db,
                'SELECT valor FROM admin_config WHERE clave = ?',
                ['clave_invalida']
            );

            expect(config.clinica_nombre).toBe('Dental Norte');
            expect(config.clinica_rfc).toBe('');
            expect(invalidRow).toBeNull();
        } finally {
            await close(db);
        }
    });

    test('persiste y recupera configuracion general con tipos normalizados', async () => {
        const db = openMemoryDb();

        try {
            const saved = await saveAppSettings(db, {
                theme: 'dark',
                compactMode: 'true',
                weeklyView: 0,
                workStart: '07:30',
                firstDayWeek: '0',
                workDays: ['0', '2', '2', 5],
                autoLock: 'never',
                clave_invalida: 'ignorada'
            });

            const settings = await getAppSettings(db);

            expect(saved).toMatchObject({
                theme: 'dark',
                compactMode: true,
                weeklyView: false,
                workStart: '07:30',
                firstDayWeek: '0',
                autoLock: 'never',
                workDays: [0, 2, 5],
            });
            expect(settings).toEqual(saved);
            expect(settings.clave_invalida).toBeUndefined();
        } finally {
            await close(db);
        }
    });

    test('saveSystemConfig actualiza settings e identidad en una sola lectura consistente', async () => {
        const db = openMemoryDb();

        try {
            await saveSystemConfig(db, {
                settings: {
                    theme: 'light',
                    fontSize: 'large',
                    currency: 'USD',
                    firstDayWeek: '0',
                },
                clinicIdentity: {
                    clinica_nombre: 'Dental Norte',
                    clinica_direccion: 'Av. Siempre Viva 123',
                }
            });

            const systemConfig = await getSystemConfig(db);

            expect(systemConfig.settings).toMatchObject({
                theme: 'light',
                fontSize: 'large',
                currency: 'USD',
                firstDayWeek: '0',
            });
            expect(systemConfig.clinicIdentity).toMatchObject({
                clinica_nombre: 'Dental Norte',
                clinica_direccion: 'Av. Siempre Viva 123',
            });
        } finally {
            await close(db);
        }
    });
});
