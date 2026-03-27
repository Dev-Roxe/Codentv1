const sqlite3 = require('sqlite3');

const {
    getPeriodontogram,
    savePeriodontogram,
    saveTreatmentRecord,
    listTreatmentHistory,
    listPrescriptions,
} = require('../../main/clinical-service');

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

function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

async function seedTreatmentDb({ extended = true } = {}) {
    const db = openMemoryDb();
    const baseColumns = `
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        diente TEXT,
        procedimiento TEXT NOT NULL,
        costo REAL DEFAULT 0,
        notas TEXT
    `;
    const extraColumns = extended
        ? `,
        catalogo_id INTEGER,
        fecha TEXT,
        registro_tipo TEXT
    `
        : '';

    await exec(db, `CREATE TABLE tratamientos (${baseColumns}${extraColumns});`);
    return db;
}

async function seedPeriodontogramDb() {
    return openMemoryDb();
}

describe('Clinical Service', () => {
    test('saveTreatmentRecord persiste un registro clinico con columnas extendidas', async () => {
        const db = await seedTreatmentDb({ extended: true });

        try {
            const row = await saveTreatmentRecord(db, {
                paciente_id: 7,
                diente: '11',
                procedimiento: 'Restauracion',
                costo: 450.75,
                notas: 'Caras: mesial, distal',
                catalogo_id: 3,
                fecha: '2026-03-16T10:00:00.000Z',
                registro_tipo: 'tratamiento',
            });

            expect(row.paciente_id).toBe(7);
            expect(row.diente).toBe('11');
            expect(row.procedimiento).toBe('Restauracion');
            expect(Number(row.costo)).toBe(450.75);
            expect(row.catalogo_id).toBe(3);
            expect(row.registro_tipo).toBe('tratamiento');
        } finally {
            await close(db);
        }
    });

    test('saveTreatmentRecord funciona tambien sobre un esquema minimo heredado', async () => {
        const db = await seedTreatmentDb({ extended: false });

        try {
            const row = await saveTreatmentRecord(db, {
                paciente_id: 9,
                diente: null,
                procedimiento: 'Receta: General',
                costo: 120,
                notas: 'Ibuprofeno cada 8h',
                registro_tipo: 'receta',
            });

            expect(row.paciente_id).toBe(9);
            expect(row.diente).toBeNull();
            expect(row.procedimiento).toBe('Receta: General');
            expect(Number(row.costo)).toBe(120);
            expect(row.notas).toBe('Ibuprofeno cada 8h');
        } finally {
            await close(db);
        }
    });
});

describe('Clinical Service - periodontograma', () => {
    test('savePeriodontogram conserva imagenes existentes cuando llega un guardado vacio', async () => {
        const db = await seedPeriodontogramDb();

        try {
            await savePeriodontogram(db, {
                paciente_id: 7,
                datos: {
                    version: 2,
                    teeth: {
                        18: { imagen_v: 'data:image/png;base64,AAA', imagen_p: 'data:image/png;base64,BBB' },
                    },
                },
                dientes_imagenes: {
                    18: { imagen_v: 'data:image/png;base64,AAA', imagen_p: 'data:image/png;base64,BBB' },
                },
                dientes_bloqueados: 1,
            });

            await savePeriodontogram(db, {
                paciente_id: 7,
                datos: {
                    version: 2,
                    teeth: {
                        18: { imagen_v: '', imagen_p: '', imagen_url: '' },
                    },
                },
                dientes_imagenes: {
                    18: { imagen_v: '', imagen_p: '', imagen_url: '' },
                },
                dientes_bloqueados: 1,
            });

            const restored = await getPeriodontogram(db, 7);
            const storedImages = JSON.parse(restored.dientes_imagenes);
            const storedData = JSON.parse(restored.datos);

            expect(storedImages['18'].imagen_v).toBe('data:image/png;base64,AAA');
            expect(storedImages['18'].imagen_p).toBe('data:image/png;base64,BBB');
            expect(storedData.teeth['18'].imagen_v).toBe('data:image/png;base64,AAA');
            expect(storedData.teeth['18'].imagen_p).toBe('data:image/png;base64,BBB');
        } finally {
            await close(db);
        }
    });
});

// ---------------------------------------------------------------------------
// listTreatmentHistory & listPrescriptions
// ---------------------------------------------------------------------------

async function seedHistorialDb() {
    const db = openMemoryDb();
    await exec(db, `
        CREATE TABLE tratamientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            diente TEXT,
            procedimiento TEXT NOT NULL,
            costo REAL DEFAULT 0,
            notas TEXT,
            catalogo_id INTEGER,
            fecha TEXT,
            registro_tipo TEXT
        );
        CREATE TABLE tratamientos_catalogo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            categoria TEXT,
            descripcion TEXT
        );
        CREATE TABLE planes_tratamiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            catalogo_id INTEGER,
            estado TEXT DEFAULT 'pendiente',
            costo_total REAL DEFAULT 0,
            fecha_inicio TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    // catalogo item
    await exec(db, `INSERT INTO tratamientos_catalogo (id, nombre, categoria, descripcion) VALUES (1, 'Extraccion', 'Cirugia', 'Extraccion simple');`);
    // planes_tratamiento rows for paciente 1
    await exec(db, `INSERT INTO planes_tratamiento (paciente_id, catalogo_id, estado, costo_total) VALUES (1, 1, 'pendiente', 500);`);
    await exec(db, `INSERT INTO planes_tratamiento (paciente_id, catalogo_id, estado, costo_total) VALUES (1, 1, 'completado', 500);`);
    // legacy tratamientos (non-receta) for paciente 1
    await exec(db, `INSERT INTO tratamientos (paciente_id, procedimiento, costo, registro_tipo) VALUES (1, 'Limpieza', 200, 'tratamiento');`);
    // recetas for paciente 1
    await exec(db, `INSERT INTO tratamientos (paciente_id, procedimiento, costo, registro_tipo) VALUES (1, 'Receta: General', 150, 'receta');`);
    await exec(db, `INSERT INTO tratamientos (paciente_id, procedimiento, costo, registro_tipo) VALUES (1, 'Receta: Especial', 300, 'receta');`);
    // data for paciente 2 (should never appear in paciente-1 queries)
    await exec(db, `INSERT INTO tratamientos (paciente_id, procedimiento, costo) VALUES (2, 'Limpieza', 200);`);
    return db;
}

describe('Clinical Service – listTreatmentHistory y listPrescriptions', () => {
    let db;

    beforeAll(async () => {
        db = await seedHistorialDb();
    });

    afterAll(async () => {
        await close(db);
    });

    test('listTreatmentHistory devuelve planes y legacy del paciente', async () => {
        const { planes, legacy } = await listTreatmentHistory(db, 1);

        expect(Array.isArray(planes)).toBe(true);
        expect(planes).toHaveLength(2);
        expect(planes[0].tratamiento_nombre).toBe('Extraccion');

        expect(Array.isArray(legacy)).toBe(true);
        expect(legacy).toHaveLength(1);
        expect(legacy[0].procedimiento).toBe('Limpieza');
    });

    test('listTreatmentHistory no mezcla datos de otro paciente', async () => {
        const { planes, legacy } = await listTreatmentHistory(db, 2);
        expect(planes).toHaveLength(0);
        expect(legacy).toHaveLength(1);
        expect(legacy[0].paciente_id).toBe(2);
    });

    test('listTreatmentHistory con patientId invalido retorna vacios', async () => {
        const result = await listTreatmentHistory(db, 0);
        expect(result).toEqual({ planes: [], legacy: [] });

        const result2 = await listTreatmentHistory(db, null);
        expect(result2).toEqual({ planes: [], legacy: [] });
    });

    test('listPrescriptions devuelve solo filas LIKE Receta% para el paciente', async () => {
        const recetas = await listPrescriptions(db, 1);

        expect(Array.isArray(recetas)).toBe(true);
        expect(recetas).toHaveLength(2);
        expect(recetas.every(r => r.procedimiento.includes('Receta'))).toBe(true);
    });

    test('listPrescriptions con patientId invalido retorna array vacio', async () => {
        expect(await listPrescriptions(db, 0)).toEqual([]);
        expect(await listPrescriptions(db, null)).toEqual([]);
    });
});
