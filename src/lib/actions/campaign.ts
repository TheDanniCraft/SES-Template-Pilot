"use server";

import { SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import { db } from "@/lib/db";
import { sentEmails } from "@/lib/schema";
import { getSesSendingQuota } from "@/lib/ses-quota";
import { getServerSessionUser } from "@/lib/server-auth";
import { getUserSesClients } from "@/lib/user-ses";
import { campaignSchema, type CampaignInput } from "@/lib/validators";

const SEND_RATE_HEADROOM = 0.9;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRecipientTemplateDataMap(input: string) {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const mapped: Record<string, Record<string, string>> = {};

    for (const [recipient, value] of Object.entries(record)) {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
      }
      mapped[recipient] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
          key,
          String(nestedValue ?? "")
        ])
      );
    }

    return mapped;
  } catch {
    return null;
  }
}

export async function sendCampaignAction(input: CampaignInput) {
  const user = await getServerSessionUser();
  if (!user) {
    return {
      success: false,
      error: "Unauthorized"
    };
  }

  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid campaign payload"
    };
  }

  const { recipients, templateData, templateName } = parsed.data;
  const recipientTemplateDataMap = parseRecipientTemplateDataMap(templateData);
  if (!recipientTemplateDataMap) {
    return {
      success: false,
      error: "Template Variables JSON must be a per-recipient object map"
    };
  }

  const missingRecipients = recipients.filter(
    (recipient) => !recipientTemplateDataMap[recipient]
  );
  if (missingRecipients.length > 0) {
    return {
      success: false,
      error: `Template Variables JSON is missing entries for: ${missingRecipients.join(", ")}`
    };
  }

  const campaignResults: Array<{
    recipient: string;
    status: "sent" | "failed";
    messageId?: string;
    error?: string;
  }> = [];

  const ses = await getUserSesClients(user.id);
  if (!ses.success) {
    return {
      success: false,
      error: ses.error
    };
  }
  const sourceEmail = ses.data.sourceEmail;
  if (!sourceEmail) {
    return {
      success: false,
      error: "SES source email is not configured. Open /app/settings and set sourceEmail."
    };
  }

  const quotaResult = await getSesSendingQuota(user.id);
  if (!quotaResult.success) {
    return {
      success: false,
      error: `Failed to fetch SES quota: ${quotaResult.error}`
    };
  }

  const availableSends = Math.floor(quotaResult.data.remaining24HourSend);
  if (availableSends <= 0) {
    return {
      success: false,
      error: "SES daily sending quota is exhausted"
    };
  }

  if (recipients.length > availableSends) {
    return {
      success: false,
      error: `Not enough SES quota. Remaining 24h sends: ${availableSends}, recipients requested: ${recipients.length}`
    };
  }

  const effectiveRate = quotaResult.data.maxSendRate * SEND_RATE_HEADROOM;
  const minDelayMs = effectiveRate > 0 ? Math.ceil(1000 / effectiveRate) : 0;
  let lastSendStartedAt = 0;

  for (const recipient of recipients) {
    try {
      if (minDelayMs > 0 && lastSendStartedAt > 0) {
        const elapsed = Date.now() - lastSendStartedAt;
        if (elapsed < minDelayMs) {
          await sleep(minDelayMs - elapsed);
        }
      }
      lastSendStartedAt = Date.now();

      const templateDataForRecipient = recipientTemplateDataMap[recipient] ?? {};

      const response = await ses.data.sesClient.send(
        new SendTemplatedEmailCommand({
          Source: sourceEmail,
          Destination: { ToAddresses: [recipient] },
          Template: templateName,
          TemplateData: JSON.stringify(templateDataForRecipient)
        })
      );

      campaignResults.push({
        recipient,
        status: "sent",
        messageId: response.MessageId
      });

      await db.insert(sentEmails).values({
        userId: user.id,
        recipient,
        templateUsed: templateName,
        status: "SENT",
        messageId: response.MessageId ?? null
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send email";

      campaignResults.push({
        recipient,
        status: "failed",
        error: message
      });

      await db.insert(sentEmails).values({
        userId: user.id,
        recipient,
        templateUsed: templateName,
        status: "FAILED",
        error: message
      });
    }
  }

  return {
    success: true,
    data: campaignResults
  };
}
