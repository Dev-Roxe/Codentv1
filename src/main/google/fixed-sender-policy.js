const OFFICIAL_SYSTEM_SENDER_EMAIL = 'softwaresonalia@gmail.com';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveConfiguredSenderEmail() {
  return OFFICIAL_SYSTEM_SENDER_EMAIL;
}

function evaluateFixedSenderStatus({ connected = false, email = null, error = null } = {}) {
  const expectedEmail = resolveConfiguredSenderEmail();
  const actualEmail = normalizeEmail(email);

  if (error) {
    return {
      connected: false,
      email: actualEmail || expectedEmail,
      expectedEmail,
      error,
    };
  }

  if (actualEmail && actualEmail !== expectedEmail) {
    return {
      connected: false,
      email: actualEmail,
      expectedEmail,
      error: `El remitente oficial del sistema es ${expectedEmail}.`,
    };
  }

  return {
    connected: !!connected,
    email: expectedEmail,
    expectedEmail,
    error: null,
  };
}

function validateAuthorizedSender({ authorizedSenderEmail, expectedSenderEmail } = {}) {
  const expectedEmail = normalizeEmail(expectedSenderEmail) || resolveConfiguredSenderEmail();
  const actualEmail = normalizeEmail(authorizedSenderEmail);

  if (actualEmail && actualEmail !== expectedEmail) {
    throw new Error(`El remitente oficial del sistema es ${expectedEmail}.`);
  }

  return expectedEmail;
}

module.exports = {
  OFFICIAL_SYSTEM_SENDER_EMAIL,
  evaluateFixedSenderStatus,
  normalizeEmail,
  resolveConfiguredSenderEmail,
  validateAuthorizedSender,
};
