/**
 * Pruebas unitarias para el servicio de recuperacion de contrasena.
 */

const mockDb = {
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
};

jest.mock('../../db/database', () => mockDb);

jest.mock('../../main/google/gmail-service', () => ({
    sendEmail: jest.fn().mockResolvedValue(true)
}));

const originalSetInterval = global.setInterval;
beforeAll(() => {
    global.setInterval = jest.fn();
});

afterAll(() => {
    global.setInterval = originalSetInterval;
});

const passwordRecoveryService = require('../../main/password-recovery-service');
const { sendEmail } = require('../../main/google/gmail-service');

jest.setTimeout(15000);

describe('Password Recovery Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('requestPasswordReset', () => {
        test('debe generar un token y enviar email cuando el usuario existe', async () => {
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
            expect(result.codeSent).toBe(true);
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
                    subject: expect.stringContaining('Recuperacion de Contrasena')
                })
            );
        });

        test('debe retornar mensaje generico cuando el usuario no existe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await passwordRecoveryService.requestPasswordReset('noexiste@example.com');

            expect(result.success).toBe(true);
            expect(result.codeSent).toBe(false);
            expect(result.message).toContain('Si existe una cuenta con ese correo');
            expect(sendEmail).not.toHaveBeenCalled();
        });

        test('debe enviar codigo tambien para usuarios OAuth de Google', async () => {
            const mockOAuthUser = {
                id: 2,
                nombre: 'Maria',
                email: 'maria@example.com',
                auth_provider: 'google'
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, mockOAuthUser);
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(null);
            });

            const result = await passwordRecoveryService.requestPasswordReset('maria@example.com');

            expect(result.success).toBe(true);
            expect(result.codeSent).toBe(true);
            expect(result.message).toContain('crear o restablecer tu contrasena');
            expect(sendEmail).toHaveBeenCalledTimes(1);
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
        test('debe validar correctamente un token valido', async () => {
            const futureDate = new Date(Date.now() + 3600000).toISOString();
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

        test('debe rechazar un token invalido cuando no existe', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await passwordRecoveryService.validateResetToken('invalid-token');

            expect(result.valid).toBe(false);
            expect(result.error).toContain('invalido');
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
            const pastDate = new Date(Date.now() - 3600000).toISOString();
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
        test('debe resetear la contrasena con un token valido', async () => {
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

        test('debe rechazar reseteo con token invalido', async () => {
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

            expect(() => {
                passwordRecoveryService.cleanupExpiredTokens();
            }).not.toThrow();
        });
    });
});
