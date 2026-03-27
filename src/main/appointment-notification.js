const { sendEmail } = require('./google/gmail-service');

const WINDOWS_1252_BYTES = {
    '\u20AC': 0x80,
    '\u201A': 0x82,
    '\u0192': 0x83,
    '\u201E': 0x84,
    '\u2026': 0x85,
    '\u2020': 0x86,
    '\u2021': 0x87,
    '\u02C6': 0x88,
    '\u2030': 0x89,
    '\u0160': 0x8A,
    '\u2039': 0x8B,
    '\u0152': 0x8C,
    '\u017D': 0x8E,
    '\u2018': 0x91,
    '\u2019': 0x92,
    '\u201C': 0x93,
    '\u201D': 0x94,
    '\u2022': 0x95,
    '\u2013': 0x96,
    '\u2014': 0x97,
    '\u02DC': 0x98,
    '\u2122': 0x99,
    '\u0161': 0x9A,
    '\u203A': 0x9B,
    '\u0153': 0x9C,
    '\u017E': 0x9E,
    '\u0178': 0x9F
};

const NOTIFICATION_VARIANTS = {
    created: {
        subject: 'Cita Agendada - Confirmacion',
        title: 'Cita Agendada',
        subtitle: 'Su cita ha sido confirmada exitosamente',
        intro: 'Le confirmamos que su cita ha sido agendada con los siguientes detalles:',
        headerGradient: 'linear-gradient(135deg, #1D5D69 0%, #4EABBE 100%)',
        detailsBorder: '#4EABBE',
        noteBackground: '#FFF9E6',
        noteBorder: '#FFC107',
        noteColor: '#856404',
        noteHtml: '<strong>Importante:</strong> Por favor, llegue 10 minutos antes de su cita. Si necesita cancelar o reprogramar, contactenos con al menos 24 horas de anticipacion.',
        closingText: 'Esperamos verle pronto.'
    },
    cancelled: {
        subject: 'Cita Cancelada - Aviso',
        title: 'Cita Cancelada',
        subtitle: 'Su cita fue cancelada',
        intro: 'Le informamos que su cita fue cancelada. Estos eran los datos registrados:',
        headerGradient: 'linear-gradient(135deg, #7F1D1D 0%, #EF4444 100%)',
        detailsBorder: '#EF4444',
        noteBackground: '#FEF2F2',
        noteBorder: '#F87171',
        noteColor: '#991B1B',
        noteHtml: '<strong>Siguiente paso:</strong> Si desea reprogramar, contactenos para asignarle una nueva fecha.',
        closingText: 'Quedamos atentos para ayudarle a reagendar.'
    },
    no_show: {
        subject: 'Inasistencia de Cita - Aviso',
        title: 'Inasistencia Registrada',
        subtitle: 'Se registro que no asistio a su cita',
        intro: 'Le informamos que la cita fue marcada como no asistida. Estos son los datos registrados:',
        headerGradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)',
        detailsBorder: '#F59E0B',
        noteBackground: '#FFFBEB',
        noteBorder: '#FBBF24',
        noteColor: '#92400E',
        noteHtml: '<strong>Siguiente paso:</strong> Si hubo un error o desea reagendar, contactenos lo antes posible.',
        closingText: 'Seguimos disponibles para apoyarle con una nueva cita.'
    }
};

function toWindows1252Bytes(text) {
    return Uint8Array.from(String(text), (char) => {
        const code = char.charCodeAt(0);
        return code <= 0xFF ? code : (WINDOWS_1252_BYTES[char] ?? 0x3F);
    });
}

function repairMojibake(value) {
    let text = String(value ?? '');

    for (let index = 0; index < 2; index += 1) {
        if (!/[ÃÂâðï]/.test(text)) {
            break;
        }

        const repaired = Buffer.from(toWindows1252Bytes(text)).toString('utf8');

        if (!repaired || repaired === text) {
            break;
        }

        text = repaired;
    }

    return text;
}

function toAsciiText(value) {
    return repairMojibake(value)
        .replace(/\u00A0/g, ' ')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u00BF/g, '?')
        .replace(/\u00A1/g, '!')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeHtmlText(value) {
    return escapeHtml(toAsciiText(value));
}

function normalizeNotificationType(value) {
    const normalized = toAsciiText(value || 'created')
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

    if (!normalized || normalized === 'created' || normalized === 'agendada' || normalized === 'confirmada') {
        return 'created';
    }

    if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'cancelado' || normalized === 'cancelada') {
        return 'cancelled';
    }

    if (
        normalized === 'no_show' ||
        normalized === 'no_asiste' ||
        normalized === 'inasistencia' ||
        normalized === 'noasistio'
    ) {
        return 'no_show';
    }

    return 'created';
}

function formatAppointmentDate(appointmentDate) {
    const dateObj = new Date(`${appointmentDate}T00:00:00`);
    const dateFormatted = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const normalized = toAsciiText(dateFormatted);
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : normalized;
}

function buildEmailHtml(variant, details) {
    const {
        safePatientName,
        safeDate,
        safeTime,
        safeEndTime,
        safeReason,
        safeProfessionalName
    } = details;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${variant.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: ${variant.headerGradient}; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                                ${variant.title}
                            </h1>
                            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                                ${variant.subtitle}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                Estimado/a <strong>${safePatientName}</strong>,
                            </p>
                            <p style="margin: 0 0 30px 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                ${variant.intro}
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F7F7; border-radius: 8px; border-left: 4px solid ${variant.detailsBorder}; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <div style="margin-bottom: 20px;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                Fecha
                                            </div>
                                            <div style="color: #0F2532; font-size: 18px; font-weight: 600;">
                                                ${safeDate}
                                            </div>
                                        </div>
                                        <div style="margin-bottom: 20px;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                Hora
                                            </div>
                                            <div style="color: #0F2532; font-size: 18px; font-weight: 600;">
                                                ${safeTime} - ${safeEndTime}
                                            </div>
                                        </div>
                                        ${safeProfessionalName ? `
                                        <div style="margin-bottom: 20px;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                Profesional
                                            </div>
                                            <div style="color: #0F2532; font-size: 18px; font-weight: 600;">
                                                ${safeProfessionalName}
                                            </div>
                                        </div>
                                        ` : ''}
                                        ${safeReason ? `
                                        <div style="margin-bottom: 0;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                Motivo
                                            </div>
                                            <div style="color: #0F2532; font-size: 16px;">
                                                ${safeReason}
                                            </div>
                                        </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${variant.noteBackground}; border-radius: 8px; border-left: 4px solid ${variant.noteBorder}; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: ${variant.noteColor}; font-size: 14px; line-height: 1.6;">
                                            ${variant.noteHtml}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 10px 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                ${variant.closingText}
                            </p>
                            <p style="margin: 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                Saludos cordiales,<br>
                                <strong>El equipo del consultorio</strong>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #F8F7F7; padding: 30px; text-align: center; border-top: 1px solid #E6E6E6;">
                            <p style="margin: 0 0 10px 0; color: #0F2532; opacity: 0.6; font-size: 14px;">
                                Este es un mensaje automatico, por favor no responda a este correo.
                            </p>
                            <p style="margin: 0; color: #0F2532; opacity: 0.6; font-size: 12px;">
                                (c) ${new Date().getFullYear()} Consultorio Dental. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * Sends appointment notifications using an ASCII-safe template to avoid mojibake.
 * Supported types: created, cancelled, no_show.
 * @param {Object} appointmentData
 * @returns {Promise<boolean>}
 */
async function sendAppointmentNotification(appointmentData) {
    try {
        const {
            patientEmail,
            patientName,
            appointmentDate,
            appointmentTime,
            reason,
            dentistName,
            duration = 30,
            notificationType = 'created'
        } = appointmentData || {};

        if (!patientEmail || !patientName || !appointmentDate || !appointmentTime) {
            console.warn('[Appointment Notification] Missing required data for notification email.');
            return false;
        }

        const type = normalizeNotificationType(notificationType);
        const variant = NOTIFICATION_VARIANTS[type] || NOTIFICATION_VARIANTS.created;
        const dateFormatted = formatAppointmentDate(appointmentDate);

        const [hours, minutes] = String(appointmentTime).split(':').map(Number);
        const endTime = new Date(2000, 0, 1, hours, minutes);
        endTime.setMinutes(endTime.getMinutes() + Number(duration || 30));
        const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

        const emailHtml = buildEmailHtml(variant, {
            safePatientName: sanitizeHtmlText(patientName),
            safeDate: sanitizeHtmlText(dateFormatted),
            safeTime: sanitizeHtmlText(appointmentTime),
            safeEndTime: sanitizeHtmlText(endTimeStr),
            safeReason: sanitizeHtmlText(reason),
            safeProfessionalName: sanitizeHtmlText(dentistName)
        });

        await sendEmail({
            to: String(patientEmail).trim(),
            subject: variant.subject,
            html: emailHtml
        });

        console.log(`[Appointment Notification] ${type} email sent successfully to ${patientEmail}`);
        return true;
    } catch (error) {
        if (error.code === 'MAIL_SERVICE_UNAVAILABLE' || String(error.message || '').includes('MAIL_SERVICE')) {
            console.warn('[Appointment Notification] Mail service unavailable. Appointment notification was not sent.');
            return false;
        }

        console.error('[Appointment Notification] Failed to send appointment notification:', error);
        return false;
    }
}

module.exports = {
    sendAppointmentNotification
};
