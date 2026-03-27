const net = require('net');

const {
    DEFAULT_HOST,
    resolveLoopbackPort,
} = require('../../../main/google/oauth-loopback-helper');

function listen(server, port, host) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server.address()));
    });
}

function close(server) {
    if (!server) return Promise.resolve();
    return new Promise((resolve) => server.close(() => resolve()));
}

describe('oauth-loopback-helper', () => {
    let blocker = null;

    afterEach(async () => {
        await close(blocker);
        blocker = null;
    });

    test('usa el puerto preferido si esta libre', async () => {
        const result = await resolveLoopbackPort({
            preferredPort: 0,
            host: DEFAULT_HOST,
            credentials: { clientType: 'desktop', redirectUris: [] },
        });

        expect(Number.isInteger(result.port)).toBe(true);
        expect(result.port).toBeGreaterThan(0);
        expect(result.fallbackUsed).toBe(false);
    });

    test('si el puerto preferido esta ocupado en desktop, usa otro libre', async () => {
        blocker = net.createServer();
        const address = await listen(blocker, 0, DEFAULT_HOST);
        const busyPort = address.port;

        const result = await resolveLoopbackPort({
            preferredPort: busyPort,
            host: DEFAULT_HOST,
            credentials: { clientType: 'desktop', redirectUris: [] },
        });

        expect(result.requestedPort).toBe(busyPort);
        expect(result.port).not.toBe(busyPort);
        expect(result.port).toBeGreaterThan(0);
        expect(result.fallbackUsed).toBe(true);
    });
});
