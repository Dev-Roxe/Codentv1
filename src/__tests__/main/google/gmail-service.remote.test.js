jest.mock('../../../main/google/system-mail-auth', () => ({
  buildAuthorizationRequiredMessage: jest.fn(() => 'bootstrap requerido'),
  getOfficialMailStatus: jest.fn(async () => ({
    connected: true,
    email: 'softwaresonalia@gmail.com',
    expectedEmail: 'softwaresonalia@gmail.com',
    managedBy: 'system_google_oauth',
  })),
  resolveBundledSystemMailTokenPath: jest.fn(() => 'C:/bundle/official-mail-token.json'),
  resolveSystemMailTokenPath: jest.fn(() => 'C:/tokens/official-mail-token.json'),
  sendOfficialEmail: jest.fn(async () => true),
}));

describe('gmail-service official sender mode', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('getDeliveryStatus reports the official sender status', async () => {
    const { getDeliveryStatus, getMailDeliveryMode, getMailServiceConfig } = require('../../../main/google/gmail-service');

    const status = await getDeliveryStatus();

    expect(getMailDeliveryMode()).toBe('system_google_oauth');
    expect(getMailServiceConfig()).toEqual({
      bundledTokenPath: 'C:/bundle/official-mail-token.json',
      tokenPath: 'C:/tokens/official-mail-token.json',
      transport: 'gmail_oauth_official_sender',
    });
    expect(status).toMatchObject({
      connected: true,
      email: 'softwaresonalia@gmail.com',
      expectedEmail: 'softwaresonalia@gmail.com',
      managedBy: 'system_google_oauth',
      deliveryMode: 'system_google_oauth',
      senderLocked: true,
      requiresLocalAuthorization: false,
    });
  });

  test('sendEmail delegates to the official sender service', async () => {
    const { sendOfficialEmail } = require('../../../main/google/system-mail-auth');
    const { sendEmail } = require('../../../main/google/gmail-service');

    const result = await sendEmail({
      to: 'patient@example.com',
      subject: 'Hola',
      html: '<p>Prueba</p>',
      attachments: [],
    });

    expect(result).toBe(true);
    expect(sendOfficialEmail).toHaveBeenCalledWith({
      to: 'patient@example.com',
      subject: 'Hola',
      html: '<p>Prueba</p>',
      attachments: [],
    });
  });

  test('sendEmailViaRemoteService is disabled on the official sender mode', async () => {
    const { sendEmailViaRemoteService } = require('../../../main/google/gmail-service');

    await expect(sendEmailViaRemoteService()).rejects.toMatchObject({
      code: 'MAIL_SERVICE_UNAVAILABLE',
      message: 'bootstrap requerido',
    });
  });
});
