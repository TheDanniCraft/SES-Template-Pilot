"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sha256Base64Url } from "@/lib/auth-tokens";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { NO_ACTIVATION_ID } from "@/lib/license-constants";
import {
  activateLicenseOnServer,
  validateLicenseOnServer
} from "@/lib/license-server";
import { nowSql, organizationLicenses, organizations } from "@/lib/schema";
import { getServerSessionUser } from "@/lib/server-auth";
import { encryptToken } from "@/lib/token-crypto";

const activateLicenseSchema = z.object({
  key: z.string().trim().min(5, "Enter a valid license key")
});

function isActivationUnsupportedError(errorText: string) {
  const text = errorText.toLowerCase();
  return (
    text.includes("notpermitted") &&
    text.includes("does not support activations")
  );
}

function buildActivationLabel(orgName: string | null | undefined, orgId: string) {
  const source = (orgName ?? "").trim() || orgId;
  const compact = source.replace(/\s+/g, " ").trim();
  return compact.slice(0, 100);
}

export async function activatePolarLicenseAction(
  input: z.infer<typeof activateLicenseSchema>
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = activateLicenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input"
    };
  }

  const org = await getRequiredUserOrg(user.id);
  const [orgRow] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, org.organizationId))
    .limit(1);
  const activationTargetLabel = buildActivationLabel(
    orgRow?.name ?? null,
    org.organizationId
  );
  const key = parsed.data.key;

  let activationId = "";
  let licenseKeyId = "";
  let activationLabel = "";
  const activationResult = await activateLicenseOnServer({
    key,
    label: activationTargetLabel
  });
  if (activationResult.success) {
    const activation = activationResult.data;
    activationId = activation.id?.trim() ?? "";
    licenseKeyId = activation.licenseKey?.id?.trim() ?? "";
    activationLabel = activation.label?.trim() ?? "";
  } else {
    if (!isActivationUnsupportedError(activationResult.error)) {
      return {
        success: false,
        error: activationResult.error
      };
    }

    const validatedResult = await validateLicenseOnServer({ key });
    if (!validatedResult.success) {
      return {
        success: false,
        error: validatedResult.error
      };
    }

    const validated = validatedResult.data;
    const status = (validated.status ?? "").trim().toLowerCase();
    if (status !== "granted" && status !== "active") {
      return {
        success: false,
        error: "License key is not active."
      };
    }

    activationId = NO_ACTIVATION_ID;
    licenseKeyId = validated.id?.trim() ?? "";
    activationLabel = activationTargetLabel;
  }

  if (!activationId || !licenseKeyId) {
    return {
      success: false,
      error: "Polar response is missing activation information"
    };
  }

  const licenseKeyHash = await sha256Base64Url(key);
  const licenseKeyEncrypted = encryptToken(key, `org-license:${org.organizationId}`);

  await db
    .insert(organizationLicenses)
    .values({
      organizationId: org.organizationId,
      provider: "polar",
      status: "active",
      licenseKeyId,
      activationId,
      licenseKeyHash,
      licenseKeyEncrypted,
      label: activationLabel || activationTargetLabel,
      lastValidatedAt: nowSql,
      updatedAt: nowSql
    })
    .onConflictDoUpdate({
      target: organizationLicenses.organizationId,
      set: {
        provider: "polar",
        status: "active",
        licenseKeyId,
        activationId,
        licenseKeyHash,
        licenseKeyEncrypted,
        label: activationLabel || activationTargetLabel,
        lastValidatedAt: nowSql,
        updatedAt: nowSql
      }
    });

  revalidatePath("/activate");
  revalidatePath("/app");
  revalidatePath("/app/settings");

  return { success: true };
}
