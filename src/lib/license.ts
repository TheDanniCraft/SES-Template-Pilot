import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { validateLicenseOnServer } from "@/lib/license-server";
import { nowSql, organizationLicenses } from "@/lib/schema";
import { getUserOrg } from "@/lib/org";
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
  licenseKeyEncrypted: string;
}) {
  const key = decryptToken(
    row.licenseKeyEncrypted,
    `org-license:${row.organizationId}`
  );
  const validatedResult = await validateLicenseOnServer({ key });
  if (validatedResult.success) {
    const status = (validatedResult.data.status ?? "").trim().toLowerCase();
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
  } else if (isDefinitiveInvalidError(validatedResult.error)) {
    await db
      .update(organizationLicenses)
      .set({
        status: "revoked",
        lastValidatedAt: nowSql,
        updatedAt: nowSql
      })
      .where(eq(organizationLicenses.organizationId, row.organizationId));
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
