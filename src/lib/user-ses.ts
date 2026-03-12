import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { SESClient } from "@aws-sdk/client-ses";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { organizationSesConfigs } from "@/lib/schema";
import { decryptToken } from "@/lib/token-crypto";

export type UserSesConfig = {
  awsRegion: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  sessionToken: string | null;
  sourceEmail: string | null;
  openTrackingEnabled: boolean;
  clickTrackingEnabled: boolean;
};

function trimOrNull(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function sesAad(userId: string, field: "accessKeyId" | "secretAccessKey" | "sessionToken") {
  return `ses-config:${userId}:${field}`;
}

function decryptNullable(value: string | null, aad: string) {
  if (!value) {
    return null;
  }
  return decryptToken(value, aad);
}

export function normalizeUserSesConfig(
  config: Partial<UserSesConfig> | null | undefined
): UserSesConfig {
  return {
    awsRegion: trimOrNull(config?.awsRegion),
    accessKeyId: trimOrNull(config?.accessKeyId),
    secretAccessKey: trimOrNull(config?.secretAccessKey),
    sessionToken: trimOrNull(config?.sessionToken),
    sourceEmail: trimOrNull(config?.sourceEmail),
    openTrackingEnabled: config?.openTrackingEnabled ?? true,
    clickTrackingEnabled: config?.clickTrackingEnabled ?? true
  };
}

export async function getUserSesConfig(userId: string) {
  const org = await getRequiredUserOrg(userId);
  const [row] = await db
    .select()
    .from(organizationSesConfigs)
    .where(eq(organizationSesConfigs.organizationId, org.organizationId))
    .limit(1);

  if (!row) {
    return normalizeUserSesConfig(null);
  }

  return normalizeUserSesConfig({
    awsRegion: row.awsRegion,
    accessKeyId: decryptNullable(row.accessKeyId, sesAad(org.organizationId, "accessKeyId")),
    secretAccessKey: decryptNullable(
      row.secretAccessKey,
      sesAad(org.organizationId, "secretAccessKey")
    ),
    sessionToken: decryptNullable(row.sessionToken, sesAad(org.organizationId, "sessionToken")),
    sourceEmail: row.sourceEmail,
    openTrackingEnabled: row.openTrackingEnabled,
    clickTrackingEnabled: row.clickTrackingEnabled
  });
}

function hasRequiredCredentials(config: UserSesConfig) {
  return Boolean(config.awsRegion && config.accessKeyId && config.secretAccessKey);
}

export async function getUserSesClients(userId: string) {
  let config: UserSesConfig;
  try {
    config = await getUserSesConfig(userId);
  } catch {
    return {
      success: false as const,
      error:
        "Stored SES credentials could not be decrypted. Check DB_SECRET_KEY and try again."
    };
  }

  if (!hasRequiredCredentials(config)) {
    return {
      success: false as const,
      error:
        "SES is not configured for this organization. Open Manage Org and add AWS SES credentials."
    };
  }

  const credentials = {
    accessKeyId: config.accessKeyId!,
    secretAccessKey: config.secretAccessKey!,
    sessionToken: config.sessionToken ?? undefined
  };

  return {
    success: true as const,
    data: {
      config,
      sesClient: new SESClient({
        region: config.awsRegion!,
        credentials
      }),
      cloudWatchClient: new CloudWatchClient({
        region: config.awsRegion!,
        credentials
      }),
      sourceEmail: config.sourceEmail
    }
  };
}
