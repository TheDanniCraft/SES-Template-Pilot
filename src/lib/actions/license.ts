"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sha256Base64Url } from "@/lib/auth-tokens";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { createPolarClient } from "@/lib/polar-client";
import { getPolarOrganizationId, getPolarServer } from "@/lib/polar-config";
import { NO_ACTIVATION_ID } from "@/lib/license-constants";
import { nowSql, organizationLicenses, organizations } from "@/lib/schema";
import { getServerSessionUser } from "@/lib/server-auth";
import { encryptToken } from "@/lib/token-crypto";

const activateLicenseSchema = z.object({
  key: z.string().trim().min(5, "Enter a valid license key")
});

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    const raw = error.message.trim();
    const match = raw.match(/\{[\s\S]*\}$/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as {
          detail?: string;
          error?: string;
          message?: string;
        };
        const detail =
          parsed.detail?.trim() ||
          parsed.error?.trim() ||
          parsed.message?.trim() ||
          "";
        if (detail) {
          return detail;
        }
      } catch {
        // Ignore malformed JSON and continue with raw fallback handling.
      }
    }

    const normalized = raw.toLowerCase();
    if (
      normalized.includes("resourcenotfound") ||
      normalized.includes("\"detail\":\"not found\"") ||
      normalized.includes("not found")
    ) {
      return `Polar returned Not Found. Check that POLAR_ENV (${getPolarServer()}) and POLAR_ORGANIZATION_ID match the environment and organization where this license key was created.`;
    }
    return raw;
  }
  return fallback;
}

function isActivationUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const text = error.message.toLowerCase();
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

  const organizationId = getPolarOrganizationId();
  if (!organizationId) {
    return {
      success: false,
      error: "Missing Polar configuration (POLAR_ORGANIZATION_ID)."
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
  const polar = createPolarClient();

  let activationId = "";
  let licenseKeyId = "";
  let activationLabel = "";
  try {
    const activation = await polar.customerPortal.licenseKeys.activate({
        key,
        organizationId,
        label: activationTargetLabel
    });
    activationId = activation.id?.trim() ?? "";
    licenseKeyId = activation.licenseKey?.id?.trim() ?? "";
    activationLabel = activation.label?.trim() ?? "";
  } catch (error) {
    if (isActivationUnsupportedError(error)) {
      try {
        const validated = await polar.customerPortal.licenseKeys.validate({
          key,
          organizationId
        });
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
      } catch (validateError) {
        return {
          success: false,
          error: toErrorMessage(validateError, "Failed to validate license key")
        };
      }
    } else {
      return {
        success: false,
        error: toErrorMessage(error, "Failed to reach Polar API")
      };
    }
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
