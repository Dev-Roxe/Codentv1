const { createDbHelpers } = require('./db-helpers');

const ALLOWED_TEMPLATE_TYPES = new Set(['email', 'reminder', 'sms']);
const ALLOWED_CAMPAIGN_TYPES = new Set(['email', 'sms']);
const ALLOWED_CAMPAIGN_STATUSES = new Set(['draft', 'scheduled', 'active', 'completed']);
const ALLOWED_AUDIENCES = new Set(['all', 'active', 'inactive', 'upcoming', 'custom']);
const ALLOWED_REMINDER_CHANNELS = new Set(['email', 'sms', 'whatsapp']);
const ALLOWED_REMINDER_STATUSES = new Set(['pendiente', 'sent', 'failed']);

function normalizeId(value, label = 'Registro') {
    const parsed = Number(value || 0);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${label} invalido`);
    }
    return parsed;
}

function normalizeOptionalText(value, { maxLength = 20000 } = {}) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
}

function normalizeRequiredText(value, label, options = {}) {
    const normalized = normalizeOptionalText(value, options);
    if (!normalized) {
        throw new Error(`${label} requerido`);
    }
    return normalized;
}

function normalizeTemplateType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!ALLOWED_TEMPLATE_TYPES.has(normalized)) {
        throw new Error('Tipo de plantilla no soportado');
    }
    return normalized;
}

function normalizeCampaignType(value) {
    const normalized = String(value || 'email').trim().toLowerCase();
    if (!ALLOWED_CAMPAIGN_TYPES.has(normalized)) {
        throw new Error('Tipo de campana no soportado');
    }
    return normalized;
}

function normalizeCampaignStatus(value) {
    const normalized = String(value || 'draft').trim().toLowerCase();
    if (!ALLOWED_CAMPAIGN_STATUSES.has(normalized)) {
        throw new Error('Estado de campana no soportado');
    }
    return normalized;
}

function normalizeAudience(value) {
    const normalized = String(value || 'all').trim().toLowerCase();
    if (!ALLOWED_AUDIENCES.has(normalized)) {
        throw new Error('Audiencia no soportada');
    }
    return normalized;
}

function normalizeReminderChannel(value) {
    const normalized = String(value || 'email').trim().toLowerCase();
    if (!ALLOWED_REMINDER_CHANNELS.has(normalized)) {
        throw new Error('Canal de recordatorio no soportado');
    }
    return normalized;
}

function normalizeReminderStatus(value) {
    const normalized = String(value || 'pendiente').trim().toLowerCase();
    if (!ALLOWED_REMINDER_STATUSES.has(normalized)) {
        throw new Error('Estado de recordatorio no soportado');
    }
    return normalized;
}

function normalizeCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return raw;
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

async function getTemplateById(dbHelpers, templateId) {
    return dbHelpers.get('SELECT * FROM crm_templates WHERE id = ?', [templateId]);
}

async function getCampaignById(dbHelpers, campaignId) {
    return dbHelpers.get('SELECT * FROM crm_campaigns WHERE id = ?', [campaignId]);
}

async function getSurveyTemplateById(dbHelpers, templateId) {
    return dbHelpers.get('SELECT * FROM crm_encuestas_plantillas WHERE id = ?', [templateId]);
}

async function saveTemplate(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const template = {
        id: payload.id ? normalizeId(payload.id, 'Plantilla') : null,
        nombre: normalizeRequiredText(payload.nombre, 'Nombre', { maxLength: 255 }),
        asunto: normalizeOptionalText(payload.asunto, { maxLength: 255 }),
        contenido: normalizeRequiredText(payload.contenido, 'Contenido'),
        imagen: normalizeOptionalText(payload.imagen, { maxLength: 5000000 }),
        tipo: normalizeTemplateType(payload.tipo),
    };

    if (template.id) {
        await dbHelpers.run(
            `UPDATE crm_templates
             SET nombre = ?, asunto = ?, contenido = ?, imagen = ?, tipo = ?, fecha_actualizacion = datetime('now')
             WHERE id = ?`,
            [template.nombre, template.asunto, template.contenido, template.imagen, template.tipo, template.id]
        );
        return getTemplateById(dbHelpers, template.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO crm_templates
         (nombre, asunto, contenido, imagen, tipo, activo, fecha_creacion, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [template.nombre, template.asunto, template.contenido, template.imagen, template.tipo]
    );
    return getTemplateById(dbHelpers, insert.lastID);
}

async function archiveTemplate(db, templateId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(templateId, 'Plantilla');
    const template = await getTemplateById(dbHelpers, id);
    if (!template) throw new Error('Plantilla no encontrada');
    if (Number(template.es_predeterminada || 0) === 1) {
        throw new Error('Las plantillas predeterminadas no se pueden archivar');
    }
    await dbHelpers.run(
        `UPDATE crm_templates
         SET activo = 0, fecha_actualizacion = datetime('now')
         WHERE id = ?`,
        [id]
    );
    return getTemplateById(dbHelpers, id);
}

async function restoreTemplate(db, templateId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(templateId, 'Plantilla');
    const template = await getTemplateById(dbHelpers, id);
    if (!template) throw new Error('Plantilla no encontrada');
    await dbHelpers.run(
        `UPDATE crm_templates
         SET activo = 1, fecha_actualizacion = datetime('now')
         WHERE id = ?`,
        [id]
    );
    return getTemplateById(dbHelpers, id);
}

async function duplicateTemplate(db, templateId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(templateId, 'Plantilla');
    const template = await getTemplateById(dbHelpers, id);
    if (!template) throw new Error('Plantilla no encontrada');

    const insert = await dbHelpers.run(
        `INSERT INTO crm_templates
         (nombre, asunto, contenido, imagen, tipo, activo, es_predeterminada, fecha_creacion, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))`,
        [`${template.nombre} (Copia)`, template.asunto, template.contenido, template.imagen, template.tipo]
    );
    return getTemplateById(dbHelpers, insert.lastID);
}

async function setDefaultReminderTemplate(db, templateId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(templateId, 'Plantilla');
    const template = await getTemplateById(dbHelpers, id);
    if (!template) throw new Error('Plantilla no encontrada');
    if (String(template.tipo || '').toLowerCase() !== 'reminder') {
        throw new Error('Solo las plantillas de recordatorio pueden ser predeterminadas');
    }

    await dbHelpers.run(
        `UPDATE crm_templates
         SET es_predeterminada = CASE WHEN id = ? THEN 1 ELSE 0 END,
             fecha_actualizacion = datetime('now')
         WHERE tipo = 'reminder'`,
        [id]
    );
    return getTemplateById(dbHelpers, id);
}

async function saveCampaign(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const campaign = {
        id: payload.id ? normalizeId(payload.id, 'Campana') : null,
        nombre: normalizeRequiredText(payload.nombre, 'Nombre', { maxLength: 255 }),
        descripcion: normalizeOptionalText(payload.descripcion, { maxLength: 1000 }),
        tipo: normalizeCampaignType(payload.tipo),
        estado: normalizeCampaignStatus(payload.estado),
        audiencia: normalizeAudience(payload.audiencia),
        audiencia_ids: normalizeOptionalText(payload.audiencia_ids),
        template_id: payload.template_id ? normalizeId(payload.template_id, 'Plantilla') : null,
        asunto: normalizeOptionalText(payload.asunto, { maxLength: 255 }),
        contenido: normalizeOptionalText(payload.contenido),
        programada_para: normalizeDateTime(payload.programada_para),
    };

    if (campaign.id) {
        await dbHelpers.run(
            `UPDATE crm_campaigns
             SET nombre = ?, descripcion = ?, tipo = ?, estado = ?, audiencia = ?, audiencia_ids = ?,
                 template_id = ?, asunto = ?, contenido = ?, programada_para = ?, fecha_actualizacion = datetime('now')
             WHERE id = ?`,
            [
                campaign.nombre,
                campaign.descripcion,
                campaign.tipo,
                campaign.estado,
                campaign.audiencia,
                campaign.audiencia_ids,
                campaign.template_id,
                campaign.asunto,
                campaign.contenido,
                campaign.programada_para,
                campaign.id,
            ]
        );
        return getCampaignById(dbHelpers, campaign.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO crm_campaigns
         (nombre, descripcion, tipo, estado, audiencia, audiencia_ids, template_id, asunto, contenido, programada_para, fecha_actualizacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
            campaign.nombre,
            campaign.descripcion,
            campaign.tipo,
            campaign.estado,
            campaign.audiencia,
            campaign.audiencia_ids,
            campaign.template_id,
            campaign.asunto,
            campaign.contenido,
            campaign.programada_para,
        ]
    );
    return getCampaignById(dbHelpers, insert.lastID);
}

async function deleteCampaign(db, campaignId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(campaignId, 'Campana');
    const campaign = await getCampaignById(dbHelpers, id);
    if (!campaign) throw new Error('Campana no encontrada');
    const result = await dbHelpers.run('DELETE FROM crm_campaigns WHERE id = ?', [id]);
    return { ok: true, changes: result.changes };
}

async function logSurveyDispatch(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const title = normalizeRequiredText(payload.titulo, 'Titulo', { maxLength: 255 });
    const link = normalizeRequiredText(payload.link, 'Link', { maxLength: 1000 });
    const recipients = normalizeCount(payload.destinatarios);
    if (recipients <= 0) {
        throw new Error('Destinatarios invalidos');
    }

    const insert = await dbHelpers.run(
        'INSERT INTO crm_encuestas (titulo, link, destinatarios) VALUES (?, ?, ?)',
        [title, link, recipients]
    );
    return dbHelpers.get('SELECT * FROM crm_encuestas WHERE id = ?', [insert.lastID]);
}

async function recordReminderDeliveries(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    if (!entries.length) {
        return { ok: true, inserted: 0 };
    }

    return withTransaction(dbHelpers, async () => {
        let inserted = 0;
        for (const entry of entries) {
            const patientId = normalizeId(entry.paciente_id, 'Paciente');
            const appointmentId = entry.cita_id ? normalizeId(entry.cita_id, 'Cita') : null;
            const templateId = entry.template_id ? normalizeId(entry.template_id, 'Plantilla') : null;
            const channel = normalizeReminderChannel(entry.canal);
            const status = normalizeReminderStatus(entry.estado);
            const errorMessage = normalizeOptionalText(entry.error, { maxLength: 1000 });
            const sentAt = normalizeDateTime(entry.enviado_en);

            await dbHelpers.run(
                `INSERT INTO crm_recordatorios
                 (paciente_id, cita_id, template_id, canal, estado, enviado_en, error)
                 VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`,
                [patientId, appointmentId, templateId, channel, status, sentAt, errorMessage]
            );
            inserted += 1;
        }

        return { ok: true, inserted };
    });
}

async function saveSurveyTemplate(db, payload = {}) {
    const dbHelpers = createDbHelpers(db);
    const template = {
        id: payload.id ? normalizeId(payload.id, 'Plantilla') : null,
        nombre: normalizeRequiredText(payload.nombre, 'Nombre', { maxLength: 255 }),
        titulo: normalizeRequiredText(payload.titulo, 'Titulo', { maxLength: 255 }),
        link: normalizeRequiredText(payload.link, 'Link', { maxLength: 1000 }),
        descripcion: normalizeOptionalText(payload.descripcion, { maxLength: 1000 }),
    };

    if (template.id) {
        await dbHelpers.run(
            `UPDATE crm_encuestas_plantillas
             SET nombre = ?, titulo = ?, link = ?, descripcion = ?, fecha_actualizacion = datetime('now')
             WHERE id = ?`,
            [template.nombre, template.titulo, template.link, template.descripcion, template.id]
        );
        return getSurveyTemplateById(dbHelpers, template.id);
    }

    const insert = await dbHelpers.run(
        `INSERT INTO crm_encuestas_plantillas (nombre, titulo, link, descripcion)
         VALUES (?, ?, ?, ?)`,
        [template.nombre, template.titulo, template.link, template.descripcion]
    );
    return getSurveyTemplateById(dbHelpers, insert.lastID);
}

async function archiveSurveyTemplate(db, templateId) {
    const dbHelpers = createDbHelpers(db);
    const id = normalizeId(templateId, 'Plantilla');
    const template = await getSurveyTemplateById(dbHelpers, id);
    if (!template) throw new Error('Plantilla no encontrada');
    await dbHelpers.run(
        'UPDATE crm_encuestas_plantillas SET activo = 0, fecha_actualizacion = datetime(\'now\') WHERE id = ?',
        [id]
    );
    return getSurveyTemplateById(dbHelpers, id);
}

async function seedDefaultTemplates(db) {
    const dbHelpers = createDbHelpers(db);

    try {
        // Restaurar plantillas archivadas
        const restoreResult = await dbHelpers.run(
            `UPDATE crm_templates SET activo = 1, fecha_actualizacion = datetime('now') WHERE activo = 0 AND tipo = 'email'`
        );
        if (restoreResult && restoreResult.changes > 0) {
            console.log(`[CRM] Restauradas ${restoreResult.changes} plantilla(s) archivada(s)`);
        }

        // Verificar si la tabla está vacía de plantillas de email
        const row = await dbHelpers.get("SELECT count(*) as count FROM crm_templates WHERE tipo = 'email'");
        if (row && row.count === 0) {
            console.log('[CRM] Tabla de plantillas vacía, resembrando defaults...');
            const defaultTemplates = [
                {
                    nombre: 'Bienvenida al consultorio',
                    tipo: 'email',
                    asunto: '¡Bienvenido(a) a Sonalía Dental, {nombre}!',
                    contenido: `Estimado(a) {nombre} {apellido},

Nos complace darle la bienvenida a nuestro consultorio dental Sonalía. Estamos comprometidos con brindarle la mejor atención dental en un ambiente cómodo y profesional.

Nuestros servicios incluyen:
• Limpieza dental y profilaxis
• Ortodoncia y alineadores
• Implantes dentales
• Blanqueamiento profesional
• Tratamiento de encías

Su primera cita está programada para el {fecha_cita}. Por favor, llega 10 minutos antes para completar tu expediente.

Si tienes alguna pregunta, puedes contactarnos directamente. ¡Estamos aquí para ayudarte!

Con gusto,
El equipo de Sonalía Dental`,
                    es_predeterminada: 1
                },
                {
                    nombre: 'Recordatorio de cita',
                    tipo: 'email',
                    asunto: 'Recordatorio: Tu cita dental es el {fecha_cita}',
                    contenido: `Estimado(a) {nombre},

Te recordamos que tienes una cita dental programada próximamente.

📅 Fecha y hora: {fecha_cita}
👨‍⚕️ Atenderá: {doctor}
📍 Consultorio: Sonalía Dental

Por tu comodidad, te pedimos:
✓ Llegar 5 minutos antes de tu cita
✓ Avisar con 24 horas de anticipación si necesitas reagendar
✓ Traer tu identificación oficial

Para confirmar o reagendar tu cita, responde a este correo o llámanos directamente.

¡Te esperamos!
Sonalía Dental`,
                    es_predeterminada: 1
                },
                {
                    nombre: 'Pago pendiente',
                    tipo: 'email',
                    asunto: 'Recordatorio de saldo pendiente - Sonalía Dental',
                    contenido: `Estimado(a) {nombre},

Te contactamos del consultorio Sonalía Dental para informarte que tienes un saldo pendiente en tu cuenta.

Para regularizar tu situación y continuar con tu plan de tratamiento sin interrupciones, te invitamos a realizar tu pago.

Métodos de pago disponibles:
• Efectivo en consultorio
• Transferencia bancaria
• Tarjeta de crédito/débito

Si ya realizaste tu pago, por favor ignora este mensaje o notifícanos para actualizar tu expediente.

Cualquier duda, estamos a tus órdenes.

Atentamente,
Sonalía Dental`,
                    es_predeterminada: 0
                },
                {
                    nombre: 'Confirmación de pago',
                    tipo: 'email',
                    asunto: 'Confirmación de pago recibido - Sonalía Dental',
                    contenido: `Estimado(a) {nombre},

Hemos recibido tu pago correctamente. Muchas gracias por mantener tu cuenta al corriente.

Tu expediente ha sido actualizado y puedes continuar con tu plan de tratamiento sin contratiempos.

Si tienes alguna pregunta sobre tu estado de cuenta o próximas citas, no dudes en contactarnos.

También puedes solicitar tu comprobante de pago directamente en el consultorio.

¡Gracias por confiar en Sonalía Dental!

Con aprecio,
El equipo de Sonalía Dental`,
                    es_predeterminada: 0
                },
                {
                    nombre: 'Cita cancelada',
                    tipo: 'email',
                    asunto: 'Tu cita ha sido cancelada - Sonalía Dental',
                    contenido: `Estimado(a) {nombre},

Te informamos que tu cita dental del {fecha_cita} ha sido cancelada.

Entendemos que los imprevistos ocurren y estaremos encantados de reagendar tu cita en el horario que mejor te convenga.

Para agendar una nueva cita, puedes:
• Responder a este correo
• Llamarnos directamente
• Visitar nuestro consultorio

Recuerda que tu salud dental es importante. Te recomendamos reagendar tu cita lo antes posible para mantener el seguimiento de tu tratamiento.

Esperamos verte pronto en Sonalía Dental.

Con gusto,
Sonalía Dental`,
                    es_predeterminada: 0
                }
            ];

            for (const t of defaultTemplates) {
                await dbHelpers.run(
                    `INSERT INTO crm_templates (nombre, tipo, asunto, contenido, activo, es_predeterminada, fecha_creacion, fecha_actualizacion)
                     VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
                    [t.nombre, t.tipo, t.asunto, t.contenido, t.es_predeterminada]
                );
            }
            console.log('[CRM] Plantillas predeterminadas creadas exitosamente');
        }
    } catch (e) {
        console.error('[CRM] Error en seedDefaultTemplates:', e);
    }
}

module.exports = {
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
    seedDefaultTemplates,
};
