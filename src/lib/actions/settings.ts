"use server";

import {
  DeleteTemplateCommand,
  GetAccountSendingEnabledCommand,
  GetSendQuotaCommand,
  GetTemplateCommand,
  GetIdentityVerificationAttributesCommand,
  ListTemplatesCommand,
  SESClient,
  SendEmailCommand,
  UpdateTemplateCommand
} from "@aws-sdk/client-ses";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { nowSql, userSesConfigs } from "@/lib/schema";
import { getServerSessionUser } from "@/lib/server-auth";
import { encryptToken } from "@/lib/token-crypto";
import { normalizeUserSesConfig } from "@/lib/user-ses";

const sesSettingsSchema = z.object({
  awsRegion: z.string().trim().optional(),
  accessKeyId: z.string().trim().optional(),
  secretAccessKey: z.string().trim().optional(),
  sessionToken: z.string().trim().optional(),
  sourceEmail: z.string().trim().optional()
});

const emailSchema = z.string().trim().email("Source email must be a valid email address");

function hasAnyValue(input: Record<string, string | undefined>) {
  return Object.values(input).some((value) => Boolean(value?.trim()));
}

function sesAad(userId: string, field: "accessKeyId" | "secretAccessKey" | "sessionToken") {
  return `ses-config:${userId}:${field}`;
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

function getCloudWatchClientFromConfig(
  config: ReturnType<typeof normalizeUserSesConfig>
) {
  return new CloudWatchClient({
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

async function validateCloudWatchPermission(
  config: ReturnType<typeof normalizeUserSesConfig>
) {
  const cloudWatchClient = getCloudWatchClientFromConfig(config);
  const end = new Date();
  const start = new Date(end.getTime() - 15 * 60 * 1000);

  try {
    await cloudWatchClient.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        MetricDataQueries: [
          {
            Id: "probe_send",
            ReturnData: true,
            MetricStat: {
              Metric: {
                Namespace: "AWS/SES",
                MetricName: "Send"
              },
              Period: 300,
              Stat: "Sum"
            }
          }
        ]
      })
    );
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to validate CloudWatch access";
    const lowered = rawMessage.toLowerCase();
    if (lowered.includes("cloudwatch:getmetricdata") && lowered.includes("not authorized")) {
      return {
        warning:
          "CloudWatch read permission is missing (cloudwatch:GetMetricData). Deliverability metrics will be unavailable."
      };
    }
    return {
      warning:
        "CloudWatch metrics check failed. Deliverability metrics may be unavailable."
    };
  }

  return { warning: null };
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
      sesClient,
      cloudWatchWarning: (await validateCloudWatchPermission(config)).warning
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

  const parsed = sesSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid configuration"
    };
  }

  const normalized = normalizeUserSesConfig(parsed.data);
  const hasValues = hasAnyValue(parsed.data);
  let cloudWatchWarning: string | null = null;

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
    cloudWatchWarning = validation.data.cloudWatchWarning;
  }

  if (!hasValues) {
    await db.delete(userSesConfigs).where(eq(userSesConfigs.userId, user.id));
  } else {
    try {
      await db
        .insert(userSesConfigs)
        .values({
          userId: user.id,
          awsRegion: normalized.awsRegion,
          accessKeyId: normalized.accessKeyId
            ? encryptToken(normalized.accessKeyId, sesAad(user.id, "accessKeyId"))
            : null,
          secretAccessKey: normalized.secretAccessKey
            ? encryptToken(
                normalized.secretAccessKey,
                sesAad(user.id, "secretAccessKey")
              )
            : null,
          sessionToken: normalized.sessionToken
            ? encryptToken(normalized.sessionToken, sesAad(user.id, "sessionToken"))
            : null,
          sourceEmail: normalized.sourceEmail,
          updatedAt: nowSql
        })
        .onConflictDoUpdate({
          target: userSesConfigs.userId,
          set: {
            awsRegion: normalized.awsRegion,
            accessKeyId: normalized.accessKeyId
              ? encryptToken(normalized.accessKeyId, sesAad(user.id, "accessKeyId"))
              : null,
            secretAccessKey: normalized.secretAccessKey
              ? encryptToken(
                  normalized.secretAccessKey,
                  sesAad(user.id, "secretAccessKey")
                )
              : null,
            sessionToken: normalized.sessionToken
              ? encryptToken(normalized.sessionToken, sesAad(user.id, "sessionToken"))
              : null,
            sourceEmail: normalized.sourceEmail,
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
  revalidatePath("/app/settings");
  return { success: true, warning: cloudWatchWarning };
}

export async function sendSesTestEmailAction(
  input: z.infer<typeof sesSettingsSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

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
        }
      })
    );

    return {
      success: true,
      messageId: response.MessageId ?? null,
      recipient: recipientEmail
    };
  } catch (error) {
    return {
      success: false,
      error: getFriendlyAwsError("Failed to send test email", error)
    };
  }
}
