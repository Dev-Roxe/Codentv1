jest.mock('fs', () => ({
    existsSync: jest.fn(() => false),
    unlinkSync: jest.fn(),
}));

const mockRunLoopbackOAuthFlow = jest.fn();
const mockLoadGoogleCredentials = jest.fn();
const mockReadJsonIfExists = jest.fn();
const mockSecureWriteJson = jest.fn();
const mockGetUserDataDir = jest.fn(() => 'C:\\test-user-data');

jest.mock('../../../main/google/oauth-loopback-helper', () => ({
    getUserDataDir: mockGetUserDataDir,
    loadGoogleCredentials: mockLoadGoogleCredentials,
    readJsonIfExists: mockReadJsonIfExists,
    runLoopbackOAuthFlow: mockRunLoopbackOAuthFlow,
    secureWriteJson: mockSecureWriteJson,
}));

describe('google-oauth-service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('reenvia loginHint al flujo OAuth cuando se proporciona', async () => {
        const verifyIdToken = jest.fn().mockResolvedValue({
            getPayload: () => ({
                sub: 'gid-1',
                email: 'google@example.com',
                given_name: 'Ana',
                family_name: 'Lopez',
                email_verified: true,
                picture: 'https://example.com/avatar.png',
            }),
        });

        mockLoadGoogleCredentials.mockReturnValue({ clientId: 'client-123' });
        mockRunLoopbackOAuthFlow.mockResolvedValue({
            client: { verifyIdToken },
            tokens: { id_token: 'id-token-123' },
            redirectUri: 'http://127.0.0.1:3000/oauth/google/callback',
        });

        const { authenticateWithGoogle } = require('../../../main/google/google-oauth-service');
        const user = await authenticateWithGoogle({ loginHint: 'google@example.com' });

        expect(mockRunLoopbackOAuthFlow).toHaveBeenCalledWith(expect.objectContaining({
            callbackPath: '/oauth/google/callback',
            loginHint: 'google@example.com',
        }));
        expect(verifyIdToken).toHaveBeenCalledWith({
            idToken: 'id-token-123',
            audience: 'client-123',
        });
        expect(user.email).toBe('google@example.com');
        expect(mockSecureWriteJson).toHaveBeenCalled();
    });

    test('no envia loginHint cuando no se proporciona', async () => {
        const verifyIdToken = jest.fn().mockResolvedValue({
            getPayload: () => ({
                sub: 'gid-2',
                email: 'sin-hint@example.com',
                given_name: 'Luis',
                family_name: 'Perez',
                email_verified: true,
            }),
        });

        mockLoadGoogleCredentials.mockReturnValue({ clientId: 'client-456' });
        mockRunLoopbackOAuthFlow.mockResolvedValue({
            client: { verifyIdToken },
            tokens: { id_token: 'id-token-456' },
            redirectUri: 'http://127.0.0.1:3000/oauth/google/callback',
        });

        jest.resetModules();
        const { authenticateWithGoogle } = require('../../../main/google/google-oauth-service');
        await authenticateWithGoogle();

        expect(mockRunLoopbackOAuthFlow).toHaveBeenCalledWith(expect.not.objectContaining({
            loginHint: expect.anything(),
        }));
    });
});
