const fs = require('fs');
const os = require('os');
const path = require('path');

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

async function waitForCrmSchema(db) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const row = await get(
            db,
            "SELECT COUNT(*) AS total FROM sqlite_master WHERE type IN ('table', 'trigger') AND name IN ('crm_templates', 'crm_encuestas_plantillas', 'trg_crm_templates_block_delete', 'trg_crm_survey_templates_block_delete')"
        );
        if (Number(row?.total || 0) === 4) {
            return;
        }
        await wait(50);
    }
    throw new Error('CRM schema did not initialize in time');
}

describe('CRM template delete guards', () => {
    let dbPath;
    let db;

    beforeAll(async () => {
        dbPath = path.join(os.tmpdir(), `codent-template-guards-${Date.now()}-${process.pid}.sqlite`);
        process.env.CODEX_DB_PATH = dbPath;
        jest.resetModules();
        db = require('../../db/database');
        await waitForCrmSchema(db);
    });

    afterAll(async () => {
        if (db) {
            await close(db);
        }
        delete process.env.CODEX_DB_PATH;
        try {
            if (dbPath && fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
            }
        } catch (error) {
            // ignore cleanup errors on Windows file locking edge cases
        }
    });

    test('bloquea el borrado fisico de plantillas CRM y de encuesta', async () => {
        const emailTemplate = await run(
            db,
            'INSERT INTO crm_templates (nombre, tipo, asunto, contenido, activo) VALUES (?, ?, ?, ?, 1)',
            ['Promo abril', 'email', 'Revision', 'Agenda tu cita']
        );
        const surveyTemplate = await run(
            db,
            'INSERT INTO crm_encuestas_plantillas (nombre, titulo, link, descripcion, activo) VALUES (?, ?, ?, ?, 1)',
            ['Encuesta abril', 'Como fue tu cita?', 'https://encuesta.test/abril', 'Seguimiento']
        );

        await expect(run(db, 'DELETE FROM crm_templates WHERE id = ?', [emailTemplate.lastID])).rejects.toThrow(/archivala/i);
        await expect(run(db, 'DELETE FROM crm_encuestas_plantillas WHERE id = ?', [surveyTemplate.lastID])).rejects.toThrow(/archivala/i);

        await expect(get(db, 'SELECT activo FROM crm_templates WHERE id = ?', [emailTemplate.lastID])).resolves.toEqual({ activo: 1 });
        await expect(get(db, 'SELECT activo FROM crm_encuestas_plantillas WHERE id = ?', [surveyTemplate.lastID])).resolves.toEqual({ activo: 1 });
    });
});
