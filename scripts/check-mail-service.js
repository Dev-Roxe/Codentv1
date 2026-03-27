require('dotenv').config({ quiet: true });

const {
  getDeliveryStatus,
  getMailDeliveryMode,
  getMailServiceConfig,
} = require('../src/main/google/gmail-service');
const { resolveConfiguredSenderEmail } = require('../src/main/google/fixed-sender-policy');
const { resolveBundledSystemMailTokenPath } = require('../src/main/google/system-mail-auth');

async function main() {
  const status = await getDeliveryStatus();
  const mailConfig = getMailServiceConfig();

  const summary = {
    deliveryMode: getMailDeliveryMode(),
    officialSenderEmail: resolveConfiguredSenderEmail(),
    tokenPath: mailConfig.tokenPath,
    bundledTokenPath: resolveBundledSystemMailTokenPath(),
    transport: mailConfig.transport,
    status,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = status.connected ? 0 : 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exitCode = 1;
});
