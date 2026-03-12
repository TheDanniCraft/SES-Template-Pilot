import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { NO_ACTIVATION_ID } from "@/lib/license-constants";
import { createPolarClient } from "@/lib/polar-client";
import { nowSql, organizationLicenses } from "@/lib/schema";
import { getUserOrg } from "@/lib/org";
import { getPolarOrganizationId } from "@/lib/polar-config";
import { decryptToken } from "@/lib/token-crypto";

export type UserLicenseState = {
  hasLicense: boolean;
  isActive: boolean;
  status: string | null;
};

function getValidateIntervalMs() {
  const raw = Number.parseInt(
    process.env.POLAR_VALIDATE_INTERVAL_SECONDS?.trim() ?? "",
    10
  );
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : 300;
  return seconds * 1000;
}

function shouldRevalidate(lastValidatedAt: Date | string | null) {
  if (!lastValidatedAt) {
    return true;
  }
  const last =
    lastValidatedAt instanceof Date
      ? lastValidatedAt.getTime()
      : new Date(lastValidatedAt).getTime();
  if (!Number.isFinite(last)) {
    return true;
  }
  return Date.now() - last >= getValidateIntervalMs();
}

function isDefinitiveInvalidError(payloadText: string) {
  const text = payloadText.trim().toLowerCase();
  if (!text) {
    return false;
  }

  return (
    text.includes("invalid") ||
    text.includes("revoked") ||
    text.includes("expired") ||
    text.includes("deactivated") ||
    text.includes("activation") ||
    text.includes("not found") ||
    text.includes("claimed")
  );
}

async function revalidateOrgLicense(row: {
  organizationId: string;
  activationId: string;
  licenseKeyEncrypted: string;
}) {
  const organizationId = getPolarOrganizationId();
  if (!organizationId) {
    return;
  }

  const key = decryptToken(
    row.licenseKeyEncrypted,
    `org-license:${row.organizationId}`
  );
  const polar = createPolarClient();
  try {
    const validateInput: {
      key: string;
      organizationId: string;
      activationId?: string;
    } = {
      key,
      organizationId
    };
    if (row.activationId && row.activationId !== NO_ACTIVATION_ID) {
      validateInput.activationId = row.activationId;
    }

    const validated = await polar.customerPortal.licenseKeys.validate(validateInput);
    const status = (validated.status ?? "").trim().toLowerCase();
    if (status === "granted" || status === "active") {
      await db
        .update(organizationLicenses)
        .set({
          status: "active",
          lastValidatedAt: nowSql,
          updatedAt: nowSql
        })
        .where(eq(organizationLicenses.organizationId, row.organizationId));
      return;
    }
  } catch (error) {
    const payloadText =
      error instanceof Error ? error.message : String(error ?? "");
    if (isDefinitiveInvalidError(payloadText)) {
      await db
        .update(organizationLicenses)
        .set({
          status: "revoked",
          lastValidatedAt: nowSql,
          updatedAt: nowSql
        })
        .where(eq(organizationLicenses.organizationId, row.organizationId));
    }
    return;
  }

  await db
    .update(organizationLicenses)
    .set({
      status: "revoked",
      lastValidatedAt: nowSql,
      updatedAt: nowSql
    })
    .where(eq(organizationLicenses.organizationId, row.organizationId));
}

export async function getUserLicenseState(userId: string): Promise<UserLicenseState> {
  const org = await getUserOrg(userId);
  if (!org) {
    return {
      hasLicense: false,
      isActive: false,
      status: null
    };
  }

  const [row] = await db
    .select({
      organizationId: organizationLicenses.organizationId,
      status: organizationLicenses.status,
      activationId: organizationLicenses.activationId,
      licenseKeyEncrypted: organizationLicenses.licenseKeyEncrypted,
      lastValidatedAt: organizationLicenses.lastValidatedAt
    })
    .from(organizationLicenses)
    .where(eq(organizationLicenses.organizationId, org.organizationId))
    .limit(1);

  if (!row) {
    return {
      hasLicense: false,
      isActive: false,
      status: null
    };
  }

  if (
    row.status.trim().toLowerCase() === "active" &&
    shouldRevalidate(row.lastValidatedAt)
  ) {
    try {
      await revalidateOrgLicense({
        organizationId: row.organizationId,
        activationId: row.activationId,
        licenseKeyEncrypted: row.licenseKeyEncrypted
      });
    } catch {
      // Keep prior state on transient validation errors.
    }
  }

  const [freshRow] = await db
    .select({
      status: organizationLicenses.status
    })
    .from(organizationLicenses)
    .where(eq(organizationLicenses.organizationId, org.organizationId))
    .limit(1);
  const status = (freshRow?.status ?? row.status).trim().toLowerCase();
  return {
    hasLicense: true,
    isActive: status === "active",
    status: freshRow?.status ?? row.status
  };
}

export async function isUserLicenseActive(userId: string) {
  const state = await getUserLicenseState(userId);
  return state.isActive;
}
