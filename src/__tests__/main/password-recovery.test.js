/**
 * Pruebas Unitarias para el Servicio de Recuperación de Contraseña
 * 
 * Estas pruebas verifican el funcionamiento correcto del módulo
 * password-recovery-service.js
 */

const crypto = require('crypto');

// Mock de la base de datos
const mockDb = {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
};

// Mock del módulo de base de datos
jest.mock('../../db/database', () => mockDb);

// Mock del servicio de Gmail
jest.mock('../../main/google/gmail-service', () => ({
    sendEmail: jest.fn().mockResolvedValue(true)
}));

// Mock de setInterval para evitar timers activos
const originalSetInterval = global.setInterval;
beforeAll(() => {
    global.setInterval = jest.fn();
});

afterAll(() => {
    global.setInterval = originalSetInterval;
});

const passwordRecoveryService = require('../../main/password-recovery-service');
const { sendEmail } = require('../../main/google/gmail-service');

// Aumentar timeout para pruebas asíncronas
jest.setTimeout(15000);

describe('Password Recovery Service', () => {

    beforeEach(() => {
        // Limpiar todos los mocks antes de cada prueba
        jest.clearAllMocks();
    });

    describe('requestPasswordReset', () => {

        test('debe generar un token y enviar email cuando el usuario existe', async () => {
            // Simular usuario existente
            const mockUser = {
                id: 1,
                nombre: 'Juan',
                email: 'juan@example.com',
                auth_provider: null
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockUser);
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(null);
            });

            const result = await passwordRecoveryService.requestPasswordReset('juan@example.com');

            expect(result.success).toBe(true);
            expect(result.message).toContain('correo con instrucciones');
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                ['juan@example.com'],
                expect.any(Function)
            );
            expect(mockDb.run).toHaveBeenCalled();
            expect(sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'juan@example.com',
                    subject: expect.stringContaining('Recuperación de Contraseña')
                })
            );
        });

        test('debe retornar mensaje genérico cuando el usuario no existe (seguridad)', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null); // Usuario no encontrado
            });

            const result = await passwordRecoveryService.requestPasswordReset('noexiste@example.com');

            expect(result.success).toBe(true);
            expect(result.message).toContain('Si el correo existe');
            expect(sendEmail).not.toHaveBeenCalled();
        });

        test('debe retornar mensaje genérico para usuarios OAuth (Google)', async () => {
            const mockOAuthUser = {
                id: 2,
                nombre: 'María',
                email: 'maria@example.com',
                auth_provider: 'google'
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockOAuthUser);
            });

            const result = await passwordRecoveryService.requestPasswordReset('maria@example.com');

            expect(result.success).toBe(true);
            expect(result.message).toContain('Si el correo existe');
            expect(sendEmail).not.toHaveBeenCalled();
        });

        test('debe manejar errores de base de datos correctamente', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('Database error'), null);
            });

            await expect(
                passwordRecoveryService.requestPasswordReset('test@example.com')
            ).rejects.toThrow('Database error');
        });
    });

    describe('validateResetToken', () => {

        test('debe validar correctamente un token válido', async () => {
            const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hora en el futuro
            const mockToken = {
                user_id: 1,
                expires_at: futureDate,
                used: 0
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockToken);
            });

            const result = await passwordRecoveryService.validateResetToken('valid-token-123');

            expect(result.valid).toBe(true);
            expect(result.userId).toBe(1);
        });

        test('debe rechazar un token inválido (no existe)', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await passwordRecoveryService.validateResetToken('invalid-token');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('inválido');
        });

        test('debe rechazar un token ya usado', async () => {
            const mockUsedToken = {
                user_id: 1,
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                used: 1
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockUsedToken);
            });

            const result = await passwordRecoveryService.validateResetToken('used-token');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('ya fue utilizado');
        });

        test('debe rechazar un token expirado', async () => {
            const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hora en el pasado
            const mockExpiredToken = {
                user_id: 1,
                expires_at: pastDate,
                used: 0
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockExpiredToken);
            });

            const result = await passwordRecoveryService.validateResetToken('expired-token');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('expirado');
        });
    });

    describe('resetPassword', () => {

        test('debe resetear la contraseña con un token válido', async () => {
            const futureDate = new Date(Date.now() + 3600000).toISOString();
            const mockToken = {
                user_id: 1,
                expires_at: futureDate,
                used: 0
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockToken);
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (typeof callback === 'function') {
                    callback(null);
                }
            });

            const result = await passwordRecoveryService.resetPassword('valid-token', 'newPassword123');

            expect(result.success).toBe(true);
            expect(result.message).toContain('actualizada correctamente');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE usuarios'),
                expect.any(Array),
                expect.any(Function)
            );
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE password_reset_tokens'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        test('debe rechazar reseteo con token inválido', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await passwordRecoveryService.resetPassword('invalid-token', 'newPassword');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('cleanupExpiredTokens', () => {

        test('debe eliminar tokens expirados sin errores', () => {
            mockDb.run.mockImplementation((query, callback) => {
                callback(null);
            });

            // No debe lanzar error
            expect(() => {
                passwordRecoveryService.cleanupExpiredTokens();
            }).not.toThrow();

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM password_reset_tokens'),
                expect.any(Function)
            );
        });

        test('debe manejar errores durante la limpieza', () => {
            mockDb.run.mockImplementation((query, callback) => {
                callback(new Error('Cleanup error'));
            });

            // No debe lanzar error (solo loguearlo)
            expect(() => {
                passwordRecoveryService.cleanupExpiredTokens();
            }).not.toThrow();
        });
    });
});
