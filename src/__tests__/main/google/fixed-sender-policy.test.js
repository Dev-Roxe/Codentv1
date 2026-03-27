const {
  OFFICIAL_SYSTEM_SENDER_EMAIL,
  evaluateFixedSenderStatus,
  normalizeEmail,
  resolveConfiguredSenderEmail,
  validateAuthorizedSender,
} = require('../../../main/google/fixed-sender-policy');

describe('fixed-sender-policy', () => {
  test('normalizeEmail trims and lowercases the address', () => {
    expect(normalizeEmail('  Admin@Example.COM ')).toBe('admin@example.com');
  });

  test('resolveConfiguredSenderEmail always returns the official sender', () => {
    expect(resolveConfiguredSenderEmail()).toBe(OFFICIAL_SYSTEM_SENDER_EMAIL);
    expect(resolveConfiguredSenderEmail({
      SYSTEM_SENDER_EMAIL: 'other@example.com',
    })).toBe(OFFICIAL_SYSTEM_SENDER_EMAIL);
  });

  test('evaluateFixedSenderStatus rejects a mismatched sender from the remote service', () => {
    expect(evaluateFixedSenderStatus({
      connected: true,
      email: 'otro@example.com',
    })).toEqual({
      connected: false,
      email: 'otro@example.com',
      expectedEmail: OFFICIAL_SYSTEM_SENDER_EMAIL,
      error: `El remitente oficial del sistema es ${OFFICIAL_SYSTEM_SENDER_EMAIL}.`,
    });
  });

  test('validateAuthorizedSender rejects non-official addresses', () => {
    expect(() => validateAuthorizedSender({
      authorizedSenderEmail: 'wrong@example.com',
      expectedSenderEmail: OFFICIAL_SYSTEM_SENDER_EMAIL,
    })).toThrow(`El remitente oficial del sistema es ${OFFICIAL_SYSTEM_SENDER_EMAIL}.`);
  });

  test('validateAuthorizedSender returns the official sender when allowed', () => {
    expect(validateAuthorizedSender({
      authorizedSenderEmail: OFFICIAL_SYSTEM_SENDER_EMAIL,
      expectedSenderEmail: OFFICIAL_SYSTEM_SENDER_EMAIL,
    })).toBe(OFFICIAL_SYSTEM_SENDER_EMAIL);
  });
});
