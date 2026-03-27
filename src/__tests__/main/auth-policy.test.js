const {
    GOOGLE_AUTH_MODES,
    hasGoogleLinkedAccount,
    hasLocalPassword,
    mapUserRow,
    normalizeEmail,
    normalizeRole,
    isAuthorizedUser,
    resolveGoogleAuthDecision,
} = require('../../main/auth-policy');

describe('auth-policy', () => {
    test('normaliza email y rol de forma consistente', () => {
        expect(normalizeEmail('  USER@Example.COM ')).toBe('user@example.com');
        expect(normalizeRole('admin')).toBe('Administrador');
        expect(normalizeRole('especialista')).toBe('Especialista');
        expect(normalizeRole('desconocido')).toBe('');
    });

    test('marca como autorizada solo a una cuenta completa', () => {
        expect(isAuthorizedUser({
            registration_completed: 1,
            profile_completed: 1,
            accepted_terms: 1,
        })).toBe(true);

        expect(isAuthorizedUser({
            registration_completed: 1,
            profile_completed: 0,
            accepted_terms: 1,
        })).toBe(false);
    });

    test('detecta si una cuenta tiene Google vinculado y contrasena local', () => {
        expect(hasGoogleLinkedAccount({ google_id: 'gid-1' })).toBe(true);
        expect(hasGoogleLinkedAccount({ googleId: 'gid-2' })).toBe(true);
        expect(hasGoogleLinkedAccount({})).toBe(false);
        expect(hasGoogleLinkedAccount(null)).toBe(false);

        expect(hasLocalPassword({ password: '$2a$10$abc' })).toBe(true);
        expect(hasLocalPassword({ has_password: 1 })).toBe(true);
        expect(hasLocalPassword({ hasPassword: true })).toBe(true);
        expect(hasLocalPassword({ password: '' })).toBe(false);
        expect(hasLocalPassword(null)).toBe(false);
    });

    test('mapea una cuenta con Google y contrasena como cuenta hibrida', () => {
        const user = mapUserRow({
            id: 9,
            nombre: 'Ana',
            apellido: 'Lopez',
            email: 'ana@example.com',
            rol: 'Administrador',
            google_id: 'gid-9',
            password: '$2a$10$abc',
        });

        expect(user.authProvider).toBe('hybrid');
        expect(user.hasPassword).toBe(true);
    });

    test('usuario nuevo desde login con Google debe pasar a registro, no a acceso directo', () => {
        const decision = resolveGoogleAuthDecision({
            mode: GOOGLE_AUTH_MODES.LOGIN,
            googleProfile: {
                email: 'nuevo@example.com',
                googleId: 'gid-1',
                emailVerified: true,
            },
            userByGoogleId: null,
            userByEmail: null,
        });

        expect(decision.kind).toBe('start-registration');
        expect(decision.mode).toBe(GOOGLE_AUTH_MODES.LOGIN);
    });

    test('una cuenta local con el mismo correo se vincula automaticamente con Google', () => {
        const decision = resolveGoogleAuthDecision({
            mode: GOOGLE_AUTH_MODES.REGISTER,
            googleProfile: {
                email: 'local@example.com',
                googleId: 'gid-2',
                emailVerified: true,
            },
            userByGoogleId: null,
            userByEmail: {
                id: 10,
                email: 'local@example.com',
                auth_provider: 'local',
                password: '$2a$10$abc',
                registration_completed: 1,
                profile_completed: 1,
                accepted_terms: 1,
            },
        });

        expect(decision.kind).toBe('attach-google-id-and-login');
    });

    test('si el correo ya esta vinculado a otro google_id se rechaza', () => {
        const decision = resolveGoogleAuthDecision({
            mode: GOOGLE_AUTH_MODES.LOGIN,
            googleProfile: {
                email: 'same@example.com',
                googleId: 'gid-new',
                emailVerified: true,
            },
            userByGoogleId: null,
            userByEmail: {
                id: 11,
                email: 'same@example.com',
                google_id: 'gid-old',
                auth_provider: 'google',
            },
        });

        expect(decision.kind).toBe('error');
        expect(decision.code).toBe('GOOGLE_ID_ALREADY_LINKED');
    });

    test('usuario Google existente y completo puede iniciar sesion', () => {
        const decision = resolveGoogleAuthDecision({
            mode: GOOGLE_AUTH_MODES.LOGIN,
            googleProfile: {
                email: 'google@example.com',
                googleId: 'gid-3',
                emailVerified: true,
            },
            userByGoogleId: {
                id: 5,
                email: 'google@example.com',
                auth_provider: 'google',
                registration_completed: 1,
                profile_completed: 1,
                accepted_terms: 1,
            },
            userByEmail: null,
        });

        expect(decision.kind).toBe('login-existing-google');
    });

    test('usuario Google existente pero incompleto debe completar registro', () => {
        const decision = resolveGoogleAuthDecision({
            mode: GOOGLE_AUTH_MODES.LOGIN,
            googleProfile: {
                email: 'pending@example.com',
                googleId: 'gid-4',
                emailVerified: true,
            },
            userByGoogleId: {
                id: 6,
                email: 'pending@example.com',
                auth_provider: 'google',
                registration_completed: 0,
                profile_completed: 0,
                accepted_terms: 0,
            },
            userByEmail: null,
        });

        expect(decision.kind).toBe('complete-existing-google');
    });
});
