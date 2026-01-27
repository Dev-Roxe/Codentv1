const crypto = require('crypto');
const db = require('../db/database');
const { sendEmail } = require('./google/gmail-service');

/**
 * Generate a secure random token for password reset
 */
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a password reset token and send email
 * @param {string} email - User's email address
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function requestPasswordReset(email) {
    return new Promise((resolve, reject) => {
        // Find user by email
        db.get(
            'SELECT id, nombre, email, auth_provider FROM usuarios WHERE email = ?',
            [email],
            async (err, user) => {
                if (err) {
                    return reject(err);
                }

                // For security, don't reveal if email exists or not
                if (!user) {
                    return resolve({
                        success: true,
                        message: 'Si el correo existe, recibirás un enlace de recuperación'
                    });
                }

                // Check if user is OAuth user (no password to reset)
                if (user.auth_provider === 'google') {
                    return resolve({
                        success: true,
                        message: 'Si el correo existe, recibirás un enlace de recuperación'
                    });
                }

                // Generate token
                const token = generateResetToken();
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

                // Store token in database
                db.run(
                    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                    [user.id, token, expiresAt.toISOString()],
                    async (err) => {
                        if (err) {
                            return reject(err);
                        }

                        // Send email with reset link
                        try {
                            const resetLink = `codent://reset-password?token=${token}`;
                            const emailHtml = `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                    <h2 style="color: #1D5D69;">Recuperación de Contraseña</h2>
                                    <p>Hola ${user.nombre},</p>
                                    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Sonalia.</p>
                                    <p>Para restablecer tu contraseña, copia y pega el siguiente código en la aplicación:</p>
                                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                        <code style="font-size: 18px; font-weight: bold; color: #1D5D69;">${token}</code>
                                    </div>
                                    <p>Este código expirará en 1 hora.</p>
                                    <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
                                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                    <p style="color: #666; font-size: 12px;">
                                        Este es un correo automático, por favor no respondas a este mensaje.
                                    </p>
                                </div>
                            `;

                            await sendEmail({
                                to: user.email,
                                subject: 'Recuperación de Contraseña - Sonalia',
                                html: emailHtml
                            });

                            resolve({
                                success: true,
                                message: 'Se ha enviado un correo con instrucciones para restablecer tu contraseña'
                            });
                        } catch (emailErr) {
                            console.error('Error sending password reset email:', emailErr);
                            reject(new Error('No se pudo enviar el correo de recuperación'));
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
            (err, row) => {
                if (err) {
                    return reject(err);
                }

                if (!row) {
                    return resolve({ valid: false, error: 'Token inválido' });
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
    const bcrypt = require('bcryptjs');

    // Validate token first
    const validation = await validateResetToken(token);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    return new Promise((resolve, reject) => {
        // Hash new password
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        // Update user password
        db.run(
            'UPDATE usuarios SET password = ? WHERE id = ?',
            [hashedPassword, validation.userId],
            function (err) {
                if (err) {
                    return reject(err);
                }

                // Mark token as used
                db.run(
                    'UPDATE password_reset_tokens SET used = 1 WHERE token = ?',
                    [token],
                    (err) => {
                        if (err) {
                            console.error('Error marking token as used:', err);
                        }

                        resolve({
                            success: true,
                            message: 'Contraseña actualizada correctamente'
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
        'DELETE FROM password_reset_tokens WHERE expires_at < datetime("now")',
        (err) => {
            if (err) {
                console.error('Error cleaning up expired tokens:', err);
            } else {
                console.log('Cleaned up expired password reset tokens');
            }
        }
    );
}

// Run cleanup on module load and then every hour
cleanupExpiredTokens();
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = {
    requestPasswordReset,
    validateResetToken,
    resetPassword,
    cleanupExpiredTokens
};
