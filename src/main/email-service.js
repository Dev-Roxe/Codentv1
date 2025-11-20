/**
 * Servicio de Email con Nodemailer
 * Maneja envíos masivos de correos con soporte para variables personalizadas
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

// Crear transporte SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Reemplaza variables en el template con valores personalizados
 * @param {string} template - Texto con variables {variable}
 * @param {object} data - Datos del paciente { nombre, fecha_cita, doctor }
 * @returns {string} Texto con variables reemplazadas
 */
function replaceVariables(template, data) {
  let result = template;
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, data[key] || '');
  });
  return result;
}

/**
 * Envía un email individual con personalización
 * @param {object} params
 * @returns {Promise}
 */
async function sendEmail({ to, subject, body, variables = {} }) {
  try {
    const personalizedSubject = replaceVariables(subject, variables);
    const personalizedBody = replaceVariables(body, variables);

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_USER}>`,
      to,
      subject: personalizedSubject,
      html: personalizedBody.replace(/\n/g, '<br>'),
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error enviando email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envía emails masivos a una lista de destinatarios
 * @param {array} recipients - Array de { email, nombre, fecha_cita, doctor, ... }
 * @param {string} subject - Asunto con posibles variables
 * @param {string} body - Cuerpo del mensaje con posibles variables
 * @param {function} onProgress - Callback para reportar progreso (índice, total)
 * @returns {Promise<object>} { success, sent, failed, results }
 */
async function sendBulkEmail({ recipients, subject, body, onProgress }) {
  const results = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    
    try {
      const result = await sendEmail({
        to: recipient.email,
        subject,
        body,
        variables: {
          nombre: recipient.nombre || '',
          fecha_cita: recipient.fecha_cita || '',
          doctor: recipient.doctor || '',
        },
      });

      if (result.success) {
        sent++;
        results.push({ email: recipient.email, status: 'enviado' });
      } else {
        failed++;
        results.push({ email: recipient.email, status: 'error', error: result.error });
      }
    } catch (error) {
      failed++;
      results.push({ email: recipient.email, status: 'error', error: error.message });
    }

    // Reportar progreso
    if (onProgress) {
      onProgress(i + 1, recipients.length);
    }

    // Pequeño delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    success: failed === 0,
    sent,
    failed,
    results,
  };
}

/**
 * Verifica la configuración SMTP
 * @returns {Promise<boolean>}
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✅ Conexión SMTP verificada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error en la conexión SMTP:', error.message);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendBulkEmail,
  verifyConnection,
  replaceVariables,
};
