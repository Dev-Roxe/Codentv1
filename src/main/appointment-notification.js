const { sendEmail } = require('./google/gmail-service');

/**
 * Envía una notificación por email cuando se crea una cita
 * @param {Object} appointmentData - Datos de la cita
 * @param {string} appointmentData.patientEmail - Email del paciente
 * @param {string} appointmentData.patientName - Nombre completo del paciente
 * @param {string} appointmentData.appointmentDate - Fecha de la cita (YYYY-MM-DD)
 * @param {string} appointmentData.appointmentTime - Hora de la cita (HH:MM)
 * @param {string} appointmentData.reason - Motivo de la cita (opcional)
 * @param {string} appointmentData.dentistName - Nombre del dentista (opcional)
 * @param {number} appointmentData.duration - Duración en minutos (opcional)
 * @returns {Promise<boolean>} - true si se envió correctamente
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
            duration = 30
        } = appointmentData;

        // Validar que tenemos los datos mínimos necesarios
        if (!patientEmail || !patientName || !appointmentDate || !appointmentTime) {
            console.warn('[Appointment Notification] Datos insuficientes para enviar notificación');
            return false;
        }

        // Formatear fecha en español
        const dateObj = new Date(appointmentDate + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Calcular hora de fin
        const [hours, minutes] = appointmentTime.split(':').map(Number);
        const endTime = new Date(2000, 0, 1, hours, minutes);
        endTime.setMinutes(endTime.getMinutes() + duration);
        const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

        // Construir el HTML del email
        const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cita Agendada</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1D5D69 0%, #4EABBE 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                                Cita Agendada
                            </h1>
                            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                                Su cita ha sido confirmada exitosamente
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                Estimado/a <strong>${patientName}</strong>,
                            </p>
                            <p style="margin: 0 0 30px 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                Le confirmamos que su cita ha sido agendada con los siguientes detalles:
                            </p>
                            
                            <!-- Appointment Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F7F7; border-radius: 8px; border-left: 4px solid #4EABBE; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <!-- Date -->
                                        <div style="margin-bottom: 20px;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                📅 Fecha
                                            </div>
                                            <div style="color: #0F2532; font-size: 18px; font-weight: 600;">
                                                ${dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)}
                                            </div>
                                        </div>
                                        
                                        <!-- Time -->
                                        <div style="margin-bottom: 20px;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                🕐 Hora
                                            </div>
                                            <div style="color: #0F2532; font-size: 18px; font-weight: 600;">
                                                ${appointmentTime} - ${endTimeStr}
                                            </div>
                                        </div>
                                        
                                        ${dentistName ? `
                                        <!-- Dentist -->
                                        <div style="margin-bottom: 20px;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                👨‍⚕️ Dentista
                                            </div>
                                            <div style="color: #0F2532; font-size: 18px; font-weight: 600;">
                                                ${dentistName}
                                            </div>
                                        </div>
                                        ` : ''}
                                        
                                        ${reason ? `
                                        <!-- Reason -->
                                        <div style="margin-bottom: 0;">
                                            <div style="color: #0F2532; opacity: 0.6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                                                📋 Motivo
                                            </div>
                                            <div style="color: #0F2532; font-size: 16px;">
                                                ${reason}
                                            </div>
                                        </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Important Note -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFF9E6; border-radius: 8px; border-left: 4px solid #FFC107; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                                            <strong>⚠️ Importante:</strong> Por favor, llegue 10 minutos antes de su cita. Si necesita cancelar o reprogramar, contáctenos con al menos 24 horas de anticipación.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 10px 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                Esperamos verle pronto.
                            </p>
                            <p style="margin: 0; color: #0F2532; font-size: 16px; line-height: 1.6;">
                                Saludos cordiales,<br>
                                <strong>El equipo del consultorio</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F8F7F7; padding: 30px; text-align: center; border-top: 1px solid #E6E6E6;">
                            <p style="margin: 0 0 10px 0; color: #0F2532; opacity: 0.6; font-size: 14px;">
                                Este es un mensaje automático, por favor no responda a este correo.
                            </p>
                            <p style="margin: 0; color: #0F2532; opacity: 0.6; font-size: 12px;">
                                © ${new Date().getFullYear()} Consultorio Dental. Todos los derechos reservados.
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

        // Enviar el email
        await sendEmail({
            to: patientEmail,
            subject: 'Cita Agendada - Confirmacion',
            html: emailHtml
        });

        console.log(`[Appointment Notification] Email enviado exitosamente a ${patientEmail}`);
        return true;

    } catch (error) {
        // Si el error es NO_TOKEN, significa que Gmail no está configurado
        if (error.message === 'NO_TOKEN') {
            console.warn('[Appointment Notification] Gmail no está configurado. No se puede enviar notificación.');
            return false;
        }

        console.error('[Appointment Notification] Error al enviar notificación:', error);
        return false;
    }
}

module.exports = {
    sendAppointmentNotification
};
