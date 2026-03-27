const sqlite3 = require('sqlite3');

const {
    saveTemplate,
    archiveTemplate,
    restoreTemplate,
    duplicateTemplate,
    setDefaultReminderTemplate,
    saveCampaign,
    deleteCampaign,
    logSurveyDispatch,
    recordReminderDeliveries,
    saveSurveyTemplate,
    archiveSurveyTemplate,
} = require('../../main/crm-service');

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

async function seedCrmDb() {
    const db = openMemoryDb();

    await exec(db, `
        CREATE TABLE pacientes (
            id INTEGER PRIMARY KEY,
            nombre TEXT
        );
        CREATE TABLE citas (
            id INTEGER PRIMARY KEY,
            paciente_id INTEGER
        );
        CREATE TABLE crm_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL,
            asunto TEXT,
            contenido TEXT NOT NULL,
            imagen TEXT,
            activo INTEGER DEFAULT 1,
            es_predeterminada INTEGER DEFAULT 0,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME
        );
        CREATE TABLE crm_campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            tipo TEXT NOT NULL,
            estado TEXT DEFAULT 'draft',
            audiencia TEXT DEFAULT 'all',
            audiencia_ids TEXT,
            template_id INTEGER,
            asunto TEXT,
            contenido TEXT,
            programada_para DATETIME,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME
        );
        CREATE TABLE crm_recordatorios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            cita_id INTEGER,
            template_id INTEGER,
            canal TEXT DEFAULT 'email',
            estado TEXT DEFAULT 'pendiente',
            enviado_en DATETIME,
            error TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE crm_encuestas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            link TEXT NOT NULL,
            destinatarios INTEGER DEFAULT 0,
            enviado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE crm_encuestas_plantillas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            titulo TEXT NOT NULL,
            link TEXT NOT NULL,
            descripcion TEXT,
            activo INTEGER DEFAULT 1,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion DATETIME
        );
    `);

    await run(db, 'INSERT INTO pacientes (id, nombre) VALUES (?, ?), (?, ?)', [1, 'Ana', 2, 'Luis']);
    await run(db, 'INSERT INTO citas (id, paciente_id) VALUES (?, ?), (?, ?)', [11, 1, 12, 2]);

    return db;
}

describe('CRM Service', () => {
    test('saveTemplate crea, duplica, archiva y restaura plantillas', async () => {
        const db = await seedCrmDb();

        try {
            const created = await saveTemplate(db, {
                nombre: 'Promo marzo',
                asunto: 'Revision semestral',
                contenido: 'Agenda tu cita',
                imagen: null,
                tipo: 'email',
            });

            expect(created.nombre).toBe('Promo marzo');
            expect(created.activo).toBe(1);

            const copy = await duplicateTemplate(db, created.id);
            expect(copy.nombre).toBe('Promo marzo (Copia)');
            expect(copy.es_predeterminada).toBe(0);

            const archived = await archiveTemplate(db, created.id);
            expect(archived.activo).toBe(0);

            const restored = await restoreTemplate(db, created.id);
            expect(restored.activo).toBe(1);
        } finally {
            await close(db);
        }
    });

    test('setDefaultReminderTemplate deja una sola plantilla recordatorio como predeterminada', async () => {
        const db = await seedCrmDb();

        try {
            const first = await saveTemplate(db, {
                nombre: 'Recordatorio base',
                asunto: 'Cita cercana',
                contenido: 'Te esperamos',
                tipo: 'reminder',
            });
            const second = await saveTemplate(db, {
                nombre: 'Recordatorio tarde',
                asunto: 'No olvides tu cita',
                contenido: 'Confirmacion',
                tipo: 'reminder',
            });

            await setDefaultReminderTemplate(db, second.id);

            const refreshedFirst = await get(db, 'SELECT es_predeterminada FROM crm_templates WHERE id = ?', [first.id]);
            const refreshedSecond = await get(db, 'SELECT es_predeterminada FROM crm_templates WHERE id = ?', [second.id]);
            expect(refreshedFirst.es_predeterminada).toBe(0);
            expect(refreshedSecond.es_predeterminada).toBe(1);
        } finally {
            await close(db);
        }
    });

    test('saveCampaign actualiza campañas existentes y deleteCampaign las elimina', async () => {
        const db = await seedCrmDb();

        try {
            const template = await saveTemplate(db, {
                nombre: 'Campana de revision',
                asunto: 'Agenda tu revision',
                contenido: 'Tenemos espacios disponibles',
                tipo: 'email',
            });

            const created = await saveCampaign(db, {
                nombre: 'Campana abril',
                descripcion: 'Pacientes activos',
                tipo: 'email',
                estado: 'scheduled',
                audiencia: 'active',
                template_id: template.id,
                asunto: 'Revision dental',
                contenido: 'Reserva ahora',
                programada_para: '2026-04-01 09:00',
            });

            expect(created.nombre).toBe('Campana abril');
            expect(created.estado).toBe('scheduled');

            const updated = await saveCampaign(db, {
                id: created.id,
                nombre: 'Campana abril ajustada',
                descripcion: 'Pacientes activos VIP',
                tipo: 'email',
                estado: 'active',
                audiencia: 'custom',
                audiencia_ids: '1,2',
                template_id: template.id,
                asunto: 'Revision prioritaria',
                contenido: 'Confirma tu horario',
                programada_para: '2026-04-01 10:00',
            });

            expect(updated.nombre).toBe('Campana abril ajustada');
            expect(updated.estado).toBe('active');
            expect(updated.audiencia).toBe('custom');

            await expect(deleteCampaign(db, created.id)).resolves.toEqual({ ok: true, changes: 1 });
            await expect(get(db, 'SELECT * FROM crm_campaigns WHERE id = ?', [created.id])).resolves.toBeNull();
        } finally {
            await close(db);
        }
    });

    test('logSurveyDispatch y recordReminderDeliveries persisten auditoria de envios', async () => {
        const db = await seedCrmDb();

        try {
            const reminderTemplate = await saveTemplate(db, {
                nombre: 'Recordatorio email',
                asunto: 'Te esperamos hoy',
                contenido: 'Tu cita es importante',
                tipo: 'reminder',
            });

            const surveyLog = await logSurveyDispatch(db, {
                titulo: 'Encuesta NPS',
                link: 'https://encuesta.test/nps',
                destinatarios: 18,
            });
            expect(surveyLog.titulo).toBe('Encuesta NPS');
            expect(surveyLog.destinatarios).toBe(18);

            const delivery = await recordReminderDeliveries(db, {
                entries: [
                    {
                        paciente_id: 1,
                        cita_id: 11,
                        template_id: reminderTemplate.id,
                        canal: 'email',
                        estado: 'sent',
                    },
                    {
                        paciente_id: 2,
                        cita_id: 12,
                        template_id: reminderTemplate.id,
                        canal: 'email',
                        estado: 'failed',
                        error: 'smtp timeout',
                    },
                ],
            });

            expect(delivery).toEqual({ ok: true, inserted: 2 });
            await expect(get(db, 'SELECT COUNT(*) AS total FROM crm_recordatorios', [])).resolves.toEqual({ total: 2 });
        } finally {
            await close(db);
        }
    });

    test('recordReminderDeliveries hace rollback si una entrada es invalida', async () => {
        const db = await seedCrmDb();

        try {
            const reminderTemplate = await saveTemplate(db, {
                nombre: 'Recordatorio transaccional',
                asunto: 'Cita programada',
                contenido: 'No faltes',
                tipo: 'reminder',
            });

            await expect(recordReminderDeliveries(db, {
                entries: [
                    {
                        paciente_id: 1,
                        cita_id: 11,
                        template_id: reminderTemplate.id,
                        canal: 'email',
                        estado: 'sent',
                    },
                    {
                        paciente_id: 2,
                        cita_id: 12,
                        template_id: reminderTemplate.id,
                        canal: 'fax',
                        estado: 'sent',
                    },
                ],
            })).rejects.toThrow(/Canal de recordatorio no soportado/i);

            await expect(get(db, 'SELECT COUNT(*) AS total FROM crm_recordatorios', [])).resolves.toEqual({ total: 0 });
        } finally {
            await close(db);
        }
    });

    test('saveSurveyTemplate actualiza y archiveSurveyTemplate desactiva plantillas', async () => {
        const db = await seedCrmDb();

        try {
            const created = await saveSurveyTemplate(db, {
                nombre: 'Encuesta post consulta',
                titulo: 'Como fue tu visita?',
                link: 'https://encuesta.test/post-consulta',
                descripcion: 'Seguimiento de calidad',
            });

            expect(created.nombre).toBe('Encuesta post consulta');
            expect(created.activo).toBe(1);

            const updated = await saveSurveyTemplate(db, {
                id: created.id,
                nombre: 'Encuesta post consulta v2',
                titulo: 'Como fue tu visita hoy?',
                link: 'https://encuesta.test/post-consulta-v2',
                descripcion: 'Seguimiento afinado',
            });

            expect(updated.nombre).toBe('Encuesta post consulta v2');
            expect(updated.link).toBe('https://encuesta.test/post-consulta-v2');

            const archived = await archiveSurveyTemplate(db, created.id);
            expect(archived.activo).toBe(0);
        } finally {
            await close(db);
        }
    });
});
