"use server";

import {
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  DeleteTemplateCommand,
  GetAccountSendingEnabledCommand,
  GetSendQuotaCommand,
  GetTemplateCommand,
  GetIdentityVerificationAttributesCommand,
  ListTemplatesCommand,
  SESClient,
  SendEmailCommand,
  UpdateConfigurationSetEventDestinationCommand,
  UpdateTemplateCommand
} from "@aws-sdk/client-ses";
import type { EventType } from "@aws-sdk/client-ses";
import {
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SNSClient,
  SubscribeCommand
} from "@aws-sdk/client-sns";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { nowSql, organizationSesConfigs, sentEmails } from "@/lib/schema";
import { sanitizeSesTagValue } from "@/lib/ses-tags";
import {
  getSesWebhookEndpoint,
  getUserConfigurationSetName,
  getUserWebhookTopicName,
  SES_EVENT_DESTINATION_NAME
} from "@/lib/ses-webhook";
import { getServerSessionUser } from "@/lib/server-auth";
import { encryptToken } from "@/lib/token-crypto";
import { normalizeUserSesConfig } from "@/lib/user-ses";

const sesSettingsSchema = z.object({
  awsRegion: z.string().trim().optional(),
  accessKeyId: z.string().trim().optional(),
  secretAccessKey: z.string().trim().optional(),
  sessionToken: z.string().trim().optional(),
  sourceEmail: z.string().trim().optional(),
  openTrackingEnabled: z.boolean().optional(),
  clickTrackingEnabled: z.boolean().optional()
});

const emailSchema = z.string().trim().email("Source email must be a valid email address");

function hasAnyValue(input: z.infer<typeof sesSettingsSchema>) {
  return [
    input.awsRegion,
    input.accessKeyId,
    input.secretAccessKey,
    input.sessionToken,
    input.sourceEmail
  ].some((value) => Boolean(value?.trim()));
}

function sesAad(
  organizationId: string,
  field: "accessKeyId" | "secretAccessKey" | "sessionToken"
) {
  return `ses-config:${organizationId}:${field}`;
}

function getSesClientFromConfig(config: ReturnType<typeof normalizeUserSesConfig>) {
  return new SESClient({
    region: config.awsRegion!,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
      sessionToken: config.sessionToken ?? undefined
    }
  });
}

function getSnsClientFromConfig(config: ReturnType<typeof normalizeUserSesConfig>) {
  return new SNSClient({
    region: config.awsRegion!,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
      sessionToken: config.sessionToken ?? undefined
    }
  });
}

function getFriendlyAwsError(prefix: string, error: unknown) {
  if (error instanceof Error) {
    return `${prefix}: ${error.message}`;
  }
  return `${prefix}: unknown error`;
}

function isAuthorizationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("not authorized") ||
    message.includes("accessdenied") ||
    message.includes("access denied") ||
    message.includes("unauthorized")
  );
}

function getScopeError(action: string) {
  return `Missing SES permission: ${action}. Attach SES full access before saving.`;
}

async function validateSesAppPermissions(sesClient: SESClient) {
  try {
    await sesClient.send(new ListTemplatesCommand({ MaxItems: 1 }));
  } catch (error) {
    if (isAuthorizationError(error)) {
      return {
        success: false as const,
        error: getScopeError("ses:ListTemplates")
      };
    }
    return {
      success: false as const,
      error: getFriendlyAwsError("Unable to validate SES template access", error)
    };
  }

  try {
    await sesClient.send(new GetSendQuotaCommand({}));
  } catch (error) {
    if (isAuthorizationError(error)) {
      return {
        success: false as const,
        error: getScopeError("ses:GetSendQuota")
      };
    }
    return {
      success: false as const,
      error: getFriendlyAwsError("Unable to validate SES quota access", error)
    };
  }

  const probeTemplateName = `stp-scope-probe-${Date.now().toString(36)}`;

  try {
    await sesClient.send(new GetTemplateCommand({ TemplateName: probeTemplateName }));
  } catch (error) {
    if (isAuthorizationError(error)) {
      return {
        success: false as const,
        error: getScopeError("ses:GetTemplate")
      };
    }
  }

  try {
    await sesClient.send(
      new UpdateTemplateCommand({
        Template: {
          TemplateName: probeTemplateName,
          SubjectPart: "probe",
          HtmlPart: "<p>probe</p>",
          TextPart: "probe"
        }
      })
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return {
        success: false as const,
        error: getScopeError("ses:UpdateTemplate")
      };
    }
  }

  try {
    await sesClient.send(new DeleteTemplateCommand({ TemplateName: probeTemplateName }));
  } catch (error) {
    if (isAuthorizationError(error)) {
      return {
        success: false as const,
        error: getScopeError("ses:DeleteTemplate")
      };
    }
  }

  return { success: true as const };
}

async function ensureSesWebhookPipeline(
  userId: string,
  config: ReturnType<typeof normalizeUserSesConfig>,
  sesClient: SESClient,
  tracking: { openTrackingEnabled: boolean; clickTrackingEnabled: boolean }
) {
  const endpoint = getSesWebhookEndpoint();
  if (!endpoint) {
    return {
      success: false as const,
      error:
        "Set SES_WEBHOOK_URL (or APP_BASE_URL) and SES_WEBHOOK_SECRET to auto-configure SES webhooks."
    };
  }

  const snsClient = getSnsClientFromConfig(config);
  const configurationSetName = getUserConfigurationSetName(userId);
  const topicName = getUserWebhookTopicName(userId);

  try {
    await sesClient.send(
      new CreateConfigurationSetCommand({
        ConfigurationSet: { Name: configurationSetName }
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("already")) {
      return {
        success: false as const,
        error: getFriendlyAwsError("Failed to create SES configuration set", error)
      };
    }
  }

  let topicArn = "";
  try {
    const topic = await snsClient.send(new CreateTopicCommand({ Name: topicName }));
    topicArn = topic.TopicArn ?? "";
  } catch (error) {
    return {
      success: false as const,
      error: getFriendlyAwsError("Failed to create SNS topic for SES webhooks", error)
    };
  }

  if (!topicArn) {
    return {
      success: false as const,
      error: "SNS topic ARN is missing after topic creation."
    };
  }

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowSESPublish",
        Effect: "Allow",
        Principal: { Service: "ses.amazonaws.com" },
        Action: "SNS:Publish",
        Resource: topicArn
      }
    ]
  });

  try {
    await snsClient.send(
      new SetTopicAttributesCommand({
        TopicArn: topicArn,
        AttributeName: "Policy",
        AttributeValue: policy
      })
    );
  } catch (error) {
    return {
      success: false as const,
      error: getFriendlyAwsError("Failed to set SNS topic policy for SES", error)
    };
  }

  try {
    await snsClient.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "https",
        Endpoint: endpoint,
        ReturnSubscriptionArn: true
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("exists")) {
      return {
        success: false as const,
        error: getFriendlyAwsError("Failed to subscribe webhook endpoint to SNS", error)
      };
    }
  }

  const matchingEventTypes: EventType[] = [
    "send",
    "delivery",
    "bounce",
    "complaint",
    "reject",
    "renderingFailure"
  ];
  if (tracking.openTrackingEnabled) {
    matchingEventTypes.push("open");
  }
  if (tracking.clickTrackingEnabled) {
    matchingEventTypes.push("click");
  }

  const eventDestination = {
    Name: SES_EVENT_DESTINATION_NAME,
    Enabled: true,
    MatchingEventTypes: matchingEventTypes,
    SNSDestination: {
      TopicARN: topicArn
    }
  };

  try {
    await sesClient.send(
      new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configurationSetName,
        EventDestination: eventDestination
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("already")) {
      return {
        success: false as const,
        error: getFriendlyAwsError(
          "Failed to create SES configuration set event destination",
          error
        )
      };
    }

    try {
      await sesClient.send(
        new UpdateConfigurationSetEventDestinationCommand({
          ConfigurationSetName: configurationSetName,
          EventDestination: eventDestination
        })
      );
    } catch (updateError) {
      return {
        success: false as const,
        error: getFriendlyAwsError(
          "Failed to update SES configuration set event destination",
          updateError
        )
      };
    }
  }

  return {
    success: true as const,
    data: {
      configurationSetName
    }
  };
}

async function validateSesConfiguration(
  config: ReturnType<typeof normalizeUserSesConfig>
) {
  const sesClient = getSesClientFromConfig(config);
  try {
    await sesClient.send(new GetAccountSendingEnabledCommand({}));
  } catch (error) {
    return {
      success: false as const,
      error: getFriendlyAwsError("Unable to validate AWS SES credentials", error)
    };
  }

  const sesPermissions = await validateSesAppPermissions(sesClient);
  if (!sesPermissions.success) {
    return sesPermissions;
  }

  const sourceEmail = config.sourceEmail!;
  const domain = sourceEmail.split("@")[1]?.trim().toLowerCase() ?? "";
  const identities = [sourceEmail, domain].filter((value): value is string => Boolean(value));

  try {
    const response = await sesClient.send(
      new GetIdentityVerificationAttributesCommand({
        Identities: identities
      })
    );
    const verificationAttributes = response.VerificationAttributes ?? {};
    const emailStatus = verificationAttributes[sourceEmail]?.VerificationStatus;
    const domainStatus = domain
      ? verificationAttributes[domain]?.VerificationStatus
      : undefined;
    const isVerified = emailStatus === "Success" || domainStatus === "Success";

    if (!isVerified) {
      return {
        success: false as const,
        error:
          "Source email is not verified in SES. Verify the email or its domain first."
      };
    }
  } catch (error) {
    return {
      success: false as const,
      error: getFriendlyAwsError(
        "Unable to verify source email identity in SES",
        error
      )
    };
  }

  return {
    success: true as const,
    data: {
      sesClient
    }
  };
}

export async function saveUserSesConfigAction(
  input: z.infer<typeof sesSettingsSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  const org = await getRequiredUserOrg(user.id);

  const parsed = sesSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid configuration"
    };
  }

  const normalized = normalizeUserSesConfig(parsed.data);
  const hasValues = hasAnyValue(parsed.data);
  if (
    hasValues &&
    (!normalized.awsRegion ||
      !normalized.accessKeyId ||
      !normalized.secretAccessKey ||
      !normalized.sourceEmail)
  ) {
    return {
      success: false,
      error:
        "awsRegion, accessKeyId, secretAccessKey, and sourceEmail are required when SES config is enabled."
    };
  }

  if (hasValues) {
    const emailParsed = emailSchema.safeParse(normalized.sourceEmail);
    if (!emailParsed.success) {
      return {
        success: false,
        error: emailParsed.error.issues[0]?.message ?? "Invalid source email"
      };
    }

    const validation = await validateSesConfiguration(normalized);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error
      };
    }
    const webhookSetup = await ensureSesWebhookPipeline(
      org.organizationId,
      normalized,
      validation.data.sesClient,
      {
        openTrackingEnabled: normalized.openTrackingEnabled,
        clickTrackingEnabled: normalized.clickTrackingEnabled
      }
    );
    if (!webhookSetup.success) {
      return {
        success: false,
        error: webhookSetup.error
      };
    }
  }

  if (!hasValues) {
    await db
      .delete(organizationSesConfigs)
      .where(eq(organizationSesConfigs.organizationId, org.organizationId));
  } else {
    try {
      await db
        .insert(organizationSesConfigs)
        .values({
          organizationId: org.organizationId,
          awsRegion: normalized.awsRegion,
          accessKeyId: normalized.accessKeyId
            ? encryptToken(normalized.accessKeyId, sesAad(org.organizationId, "accessKeyId"))
            : null,
          secretAccessKey: normalized.secretAccessKey
            ? encryptToken(
                normalized.secretAccessKey,
                sesAad(org.organizationId, "secretAccessKey")
              )
            : null,
          sessionToken: normalized.sessionToken
            ? encryptToken(normalized.sessionToken, sesAad(org.organizationId, "sessionToken"))
            : null,
          sourceEmail: normalized.sourceEmail,
          openTrackingEnabled: normalized.openTrackingEnabled,
          clickTrackingEnabled: normalized.clickTrackingEnabled,
          updatedAt: nowSql
        })
        .onConflictDoUpdate({
          target: organizationSesConfigs.organizationId,
          set: {
            awsRegion: normalized.awsRegion,
            accessKeyId: normalized.accessKeyId
              ? encryptToken(
                  normalized.accessKeyId,
                  sesAad(org.organizationId, "accessKeyId")
                )
              : null,
            secretAccessKey: normalized.secretAccessKey
              ? encryptToken(
                  normalized.secretAccessKey,
                  sesAad(org.organizationId, "secretAccessKey")
                )
              : null,
            sessionToken: normalized.sessionToken
              ? encryptToken(
                  normalized.sessionToken,
                  sesAad(org.organizationId, "sessionToken")
                )
              : null,
            sourceEmail: normalized.sourceEmail,
            openTrackingEnabled: normalized.openTrackingEnabled,
            clickTrackingEnabled: normalized.clickTrackingEnabled,
            updatedAt: nowSql
          }
        });
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to encrypt or store SES settings"
      };
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/templates");
  revalidatePath("/app/send");
  revalidatePath("/app/organization");
  revalidatePath("/app/settings");
  return { success: true, warning: null };
}

export async function sendSesTestEmailAction(
  input: z.infer<typeof sesSettingsSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  const org = await getRequiredUserOrg(user.id);

  const parsed = sesSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid configuration"
    };
  }

  const normalized = normalizeUserSesConfig(parsed.data);
  if (
    !normalized.awsRegion ||
    !normalized.accessKeyId ||
    !normalized.secretAccessKey ||
    !normalized.sourceEmail
  ) {
    return {
      success: false,
      error:
        "awsRegion, accessKeyId, secretAccessKey, and sourceEmail are required to send a test email."
    };
  }

  const emailParsed = emailSchema.safeParse(normalized.sourceEmail);
  if (!emailParsed.success) {
    return {
      success: false,
      error: emailParsed.error.issues[0]?.message ?? "Invalid source email"
    };
  }

  const validation = await validateSesConfiguration(normalized);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error
    };
  }

  try {
    const now = new Date().toISOString();
    const recipientEmail = user.email.trim();
    if (!recipientEmail) {
      return {
        success: false,
        error: "Your account email is missing. Unable to send test email."
      };
    }

    const response = await validation.data.sesClient.send(
      new SendEmailCommand({
        Source: normalized.sourceEmail,
        Destination: {
          ToAddresses: [recipientEmail]
        },
        Message: {
          Subject: {
            Data: "SES Template Pilot: Test Email",
            Charset: "UTF-8"
          },
          Body: {
            Text: {
              Data: `Your SES credentials and source email are valid.\n\nTime (UTC): ${now}\nRegion: ${normalized.awsRegion}\nSource: ${normalized.sourceEmail}\nRecipient: ${recipientEmail}`,
              Charset: "UTF-8"
            }
          }
        },
        ConfigurationSetName: getUserConfigurationSetName(org.organizationId),
        Tags: [
          { Name: "stp_user_id", Value: user.id },
          { Name: "stp_org_id", Value: org.organizationId },
          {
            Name: "stp_template",
            Value: sanitizeSesTagValue("SES Test Email", "SES_Test_Email")
          }
        ]
      })
    );

    await db.insert(sentEmails).values({
      organizationId: org.organizationId,
      userId: user.id,
      recipient: recipientEmail,
      templateUsed: "SES Test Email",
      status: "SENT",
      messageId: response.MessageId ?? null,
      error: null,
      timestamp: new Date()
    });
    revalidatePath("/app/logs");
    revalidatePath("/app");

    return {
      success: true,
      messageId: response.MessageId ?? null,
      recipient: recipientEmail
    };
  } catch (error) {
    await db.insert(sentEmails).values({
      organizationId: org.organizationId,
      userId: user.id,
      recipient: user.email.trim() || "unknown@recipient",
      templateUsed: "SES Test Email",
      status: "FAILED",
      messageId: null,
      error: getFriendlyAwsError("Failed to send test email", error),
      timestamp: new Date()
    });
    revalidatePath("/app/logs");
    revalidatePath("/app");

    return {
      success: false,
      error: getFriendlyAwsError("Failed to send test email", error)
    };
  }
}
