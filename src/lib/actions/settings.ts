"use server";

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

function hasAnyValue(input: Record<string, string | undefined>) {
  return Object.values(input).some((value) => Boolean(value?.trim()));
}

function sesAad(userId: string, field: "accessKeyId" | "secretAccessKey" | "sessionToken") {
  return `ses-config:${userId}:${field}`;
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
  return { success: true };
}
