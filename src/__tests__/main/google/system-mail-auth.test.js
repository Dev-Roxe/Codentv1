describe('system-mail-auth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('resolveSystemMailTokenPath uses SYSTEM_MAIL_TOKEN_PATH when configured', () => {
    process.env.SYSTEM_MAIL_TOKEN_PATH = '.tokens/official-system-mail.json';

    const { resolveSystemMailTokenPath } = require('../../../main/google/system-mail-auth');

    expect(resolveSystemMailTokenPath()).toContain('.tokens');
    expect(resolveSystemMailTokenPath()).toContain('official-system-mail.json');
  });

  test('resolveBundledSystemMailTokenPath uses SYSTEM_MAIL_BUNDLED_TOKEN_PATH when configured', () => {
    process.env.SYSTEM_MAIL_BUNDLED_TOKEN_PATH = 'src/main/google/custom-bundled-official-mail-token.json';

    const { resolveBundledSystemMailTokenPath } = require('../../../main/google/system-mail-auth');

    expect(resolveBundledSystemMailTokenPath()).toContain('src');
    expect(resolveBundledSystemMailTokenPath()).toContain('custom-bundled-official-mail-token.json');
  });

  test('getOfficialMailStatus requests bootstrap when no token exists', async () => {
    process.env.SYSTEM_MAIL_TOKEN_PATH = '.tokens/missing-official-system-mail.json';
    process.env.SYSTEM_MAIL_BUNDLED_TOKEN_PATH = '.tokens/missing-bundled-official-system-mail.json';

    const { getOfficialMailStatus } = require('../../../main/google/system-mail-auth');
    const status = await getOfficialMailStatus();

    expect(status).toMatchObject({
      connected: false,
      email: 'softwaresonalia@gmail.com',
      expectedEmail: 'softwaresonalia@gmail.com',
      managedBy: 'system_google_oauth',
      requiresBootstrap: true,
    });
    expect(status.bundledTokenPath).toContain('missing-bundled-official-system-mail.json');
    expect(status.error).toContain('empaquetar el token oficial');
  });

  test('buildAuthorizationRequiredMessage points to the official sender packaging flow', () => {
    const { buildAuthorizationRequiredMessage } = require('../../../main/google/system-mail-auth');

    expect(buildAuthorizationRequiredMessage()).toContain('softwaresonalia@gmail.com');
    expect(buildAuthorizationRequiredMessage()).toContain('empaquetar el token oficial');
  });
});
