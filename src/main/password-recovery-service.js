const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { sendEmail } = require('./google/gmail-service');

const GENERIC_RESET_RESPONSE = {
    success: true,
    codeSent: false,
    message: 'Si existe una cuenta con ese correo, te enviaremos un codigo de recuperacion.'
};

const RESET_EMAIL_SENT_RESPONSE = {
    success: true,
    codeSent: true,
    message: 'Se ha enviado un correo con instrucciones para crear o restablecer tu contrasena'
};

/**
 * Generate a secure random token for password reset
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a password reset token and send email
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, codeSent?: boolean, message?: string, error?: string}>}
 */
async function requestPasswordReset(email) {
    return new Promise((resolve, reject) => {
        const normalizedEmail = String(email || '').trim().toLowerCase();

        db.get(
            'SELECT id, nombre, email, auth_provider FROM usuarios WHERE lower(email) = ?',
            [normalizedEmail],
            async (lookupErr, user) => {
                if (lookupErr) {
                    return reject(lookupErr);
                }

                // Keep the same public response when the account cannot receive a reset code.
                if (!user) {
                    return resolve({ ...GENERIC_RESET_RESPONSE });
                }

                const token = generateResetToken();
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1D5D69;">Recuperacion de Contrasena</h2>
                        <p>Hola ${user.nombre},</p>
                        <p>Recibimos una solicitud para crear o restablecer la contrasena de tu cuenta en Sonalia.</p>
                        <p>Para continuar, copia y pega el siguiente codigo en la aplicacion:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <code style="font-size: 18px; font-weight: bold; color: #1D5D69;">${token}</code>
                        </div>
                        <p>Este codigo expirara en 1 hora.</p>
                        <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #666; font-size: 12px;">
                            Este es un correo automatico, por favor no respondas a este mensaje.
                        </p>
                    </div>
                `;

                db.run(
                    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                    [user.id, token, expiresAt.toISOString()],
                    async (insertErr) => {
                        if (insertErr) {
                            return reject(insertErr);
                        }

                        try {
                            await sendEmail({
                                to: user.email,
                                subject: 'Recuperacion de Contrasena - Sonalia',
                                html: emailHtml
                            });

                            resolve({ ...RESET_EMAIL_SENT_RESPONSE });
                        } catch (emailErr) {
                            console.error('Error sending password reset email:', emailErr);
                            reject(new Error('No se pudo enviar el correo de recuperacion'));
                        }
                    }
                );
            }
        );
    });
}

/**
 * Validate a password reset token
 * @param {string} token - Reset token
 * @returns {Promise<{valid: boolean, userId?: number, error?: string}>}
 */
async function validateResetToken(token) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT user_id, expires_at, used
             FROM password_reset_tokens
             WHERE token = ?`,
            [token],
            (lookupErr, row) => {
                if (lookupErr) {
                    return reject(lookupErr);
                }

                if (!row) {
                    return resolve({ valid: false, error: 'Token invalido' });
                }

                if (row.used === 1) {
                    return resolve({ valid: false, error: 'Este token ya fue utilizado' });
                }

                const expiresAt = new Date(row.expires_at);
                if (expiresAt < new Date()) {
                    return resolve({ valid: false, error: 'El token ha expirado' });
                }

                resolve({ valid: true, userId: row.user_id });
            }
        );
    });
}

/**
 * Reset password using a valid token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password (will be hashed)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function resetPassword(token, newPassword) {
    const validation = await validateResetToken(token);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    return new Promise((resolve, reject) => {
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        db.run(
            `UPDATE usuarios
             SET password = ?,
                 auth_provider = CASE
                   WHEN trim(COALESCE(google_id, '')) <> '' THEN 'hybrid'
                   ELSE COALESCE(NULLIF(auth_provider, ''), 'local')
                 END
             WHERE id = ?`,
            [hashedPassword, validation.userId],
            function onPasswordUpdated(updateErr) {
                if (updateErr) {
                    return reject(updateErr);
                }

                db.run(
                    'UPDATE password_reset_tokens SET used = 1 WHERE token = ?',
                    [token],
                    (markErr) => {
                        if (markErr) {
                            console.error('Error marking token as used:', markErr);
                        }

                        resolve({
                            success: true,
                            message: 'Contrasena actualizada correctamente'
                        });
                    }
                );
            }
        );
    });
}

/**
 * Clean up expired tokens (should be run periodically)
 */
function cleanupExpiredTokens() {
    db.run(
        'DELETE FROM password_reset_tokens WHERE datetime(expires_at) < datetime("now")',
        (cleanupErr) => {
            if (cleanupErr) {
                console.error('Error cleaning up expired tokens:', cleanupErr);
            } else {
                console.log('Cleaned up expired password reset tokens');
            }
        }
    );
}

cleanupExpiredTokens();
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
    requestPasswordReset,
    validateResetToken,
    resetPassword,
    cleanupExpiredTokens
};
