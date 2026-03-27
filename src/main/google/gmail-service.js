const {
  buildAuthorizationRequiredMessage,
  getOfficialMailStatus,
  resolveBundledSystemMailTokenPath,
  resolveSystemMailTokenPath,
  sendOfficialEmail,
} = require('./system-mail-auth');

function getMailDeliveryMode() {
  return 'system_google_oauth';
}

function getMailServiceConfig() {
  return {
    bundledTokenPath: resolveBundledSystemMailTokenPath(),
    tokenPath: resolveSystemMailTokenPath(),
    transport: 'gmail_oauth_official_sender',
  };
}

function isRemoteMailServiceConfigured() {
  return false;
}

function shouldUseRemoteMailService() {
  return false;
}

async function getDeliveryStatus() {
  return {
    ...(await getOfficialMailStatus()),
    deliveryMode: getMailDeliveryMode(),
    senderLocked: true,
    requiresLocalAuthorization: false,
  };
}

async function sendEmail({ to, subject, html, attachments }) {
  return sendOfficialEmail({ to, subject, html, attachments });
}

async function sendEmailViaRemoteService() {
  throw Object.assign(new Error(buildAuthorizationRequiredMessage()), {
    code: 'MAIL_SERVICE_UNAVAILABLE',
  });
}

module.exports = {
  getDeliveryStatus,
  getMailDeliveryMode,
  getMailServiceConfig,
  isRemoteMailServiceConfigured,
  sendEmail,
  sendEmailViaRemoteService,
  shouldUseRemoteMailService,
};
