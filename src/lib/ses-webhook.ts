const CONFIG_SET_PREFIX = "stp-";
const SNS_TOPIC_PREFIX = "stp-webhook-";
export const SES_EVENT_DESTINATION_NAME = "stp-webhook-events";

function sanitizeIdentifier(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function getUserConfigurationSetName(userId: string) {
  const suffix = sanitizeIdentifier(userId);
  // SES configuration set names max out at 64 characters.
  return `${CONFIG_SET_PREFIX}${suffix}`.slice(0, 64);
}

export function getUserWebhookTopicName(userId: string) {
  const suffix = sanitizeIdentifier(userId);
  // Keep topic names short and deterministic.
  return `${SNS_TOPIC_PREFIX}${suffix}`.slice(0, 128);
}

export function getSesWebhookEndpoint() {
  const explicitWebhookUrl = process.env.SES_WEBHOOK_URL?.trim();
  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.SES_WEBHOOK_SECRET?.trim();

  const baseWebhookUrl =
    explicitWebhookUrl || (appBaseUrl ? `${appBaseUrl}/api/webhooks/ses` : "");

  if (!baseWebhookUrl || !secret) {
    return null;
  }

  if (/([?&])secret=/.test(baseWebhookUrl)) {
    return baseWebhookUrl;
  }

  const joiner = baseWebhookUrl.includes("?") ? "&" : "?";
  return `${baseWebhookUrl}${joiner}secret=${encodeURIComponent(secret)}`;
}
