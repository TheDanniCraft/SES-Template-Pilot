import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import {
  BRAND_KIT_COLOR_KEYS,
  type BrandKit,
  type BrandKitColorValues
} from "@/lib/brand-kits";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { attachBrandKitId, extractBrandKitId } from "@/lib/ses-template-json";
import { nowSql, brandKits, templateDrafts } from "@/lib/schema";

const DEFAULT_BASE_COLORS: BrandKitColorValues = {
  text: "#0f172a",
  muted: "#475569",
  surface: "#ffffff",
  border: "#e2e8f0",
  accent: "#5f06f5",
  link: "#5f06f5",
  buttonText: "#ffffff"
};

const DEFAULT_DARK_COLORS: BrandKitColorValues = {
  text: "#e2e8f0",
  muted: "#94a3b8",
  surface: "#0f172a",
  border: "#5f06f5",
  accent: "#5f06f5",
  link: "#5f06f5",
  buttonText: "#ffffff"
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function sanitizeHex(value: string, fallback: string) {
  const normalized = (value || "").trim();
  const short = normalized.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }
  const full = normalized.match(/^#?([0-9a-f]{6})$/i);
  if (full) {
    return `#${full[1].toLowerCase()}`;
  }
  return fallback;
}

function sanitizeColorValues(
  input: Partial<BrandKitColorValues> | undefined,
  fallback: BrandKitColorValues
): BrandKitColorValues {
  const entries = BRAND_KIT_COLOR_KEYS.map((key) => {
    const nextValue = input?.[key];
    const fallbackValue = fallback[key];
    return [key, sanitizeHex(typeof nextValue === "string" ? nextValue : "", fallbackValue)];
  });

  return Object.fromEntries(entries) as BrandKitColorValues;
}

function normalizeVariantToggle(
  variant: BrandKitColorValues | undefined,
  fallback: BrandKitColorValues
) {
  if (!variant) {
    return undefined;
  }
  return sanitizeColorValues(variant, fallback);
}

function toBaseColors(input: BrandKit["colors"]): BrandKitColorValues {
  const baseEntries = BRAND_KIT_COLOR_KEYS.map((key) => [key, input[key]]);
  return Object.fromEntries(baseEntries) as BrandKitColorValues;
}

function sanitizeBrandKitFields(input: Omit<BrandKit, "id">): Omit<BrandKit, "id"> {
  const legacyBase = toBaseColors(input.colors);
  const sourceBase = input.colors.light ?? legacyBase;
  const sourceDark = input.colors.dark ?? (input.colors.light ? legacyBase : undefined);
  const base = sanitizeColorValues(sourceBase, DEFAULT_BASE_COLORS);
  const dark = normalizeVariantToggle(sourceDark, DEFAULT_DARK_COLORS);

  return {
    name: input.name.trim(),
    iconUrl: input.iconUrl.trim(),
    colors: {
      ...base,
      ...(dark ? { dark } : {})
    }
  };
}

function sanitizeBrandKit(input: BrandKit): BrandKit {
  return {
    id: input.id.trim().toLowerCase(),
    ...sanitizeBrandKitFields(input)
  };
}

async function migrateLegacyBrandKitIds(organizationId: string) {
  await db.transaction(async (tx) => {
    const kitRows = await tx
      .select()
      .from(brandKits)
      .where(eq(brandKits.organizationId, organizationId));

    const legacyRows = kitRows.filter((row) => !isUuid(row.id));
    if (legacyRows.length === 0) {
      return;
    }

    const migratedIds = new Map<string, string>();
    for (const row of legacyRows) {
      const nextId = randomUUID();
      migratedIds.set(row.id, nextId);
      await tx
        .update(brandKits)
        .set({
          id: nextId,
          updatedAt: nowSql
        })
        .where(
          and(
            eq(brandKits.organizationId, organizationId),
            eq(brandKits.id, row.id)
          )
        );
    }

    const draftRows = await tx
      .select({
        id: templateDrafts.id,
        designJson: templateDrafts.designJson
      })
      .from(templateDrafts)
      .where(eq(templateDrafts.organizationId, organizationId));

    for (const draft of draftRows) {
      if (
        !draft.designJson ||
        typeof draft.designJson !== "object" ||
        Array.isArray(draft.designJson)
      ) {
        continue;
      }

      const currentKitId = extractBrandKitId(draft.designJson);
      if (!currentKitId) {
        continue;
      }

      const migratedKitId = migratedIds.get(currentKitId);
      if (!migratedKitId) {
        continue;
      }

      await tx
        .update(templateDrafts)
        .set({
          designJson: attachBrandKitId(draft.designJson, migratedKitId),
          updatedAt: nowSql
        })
        .where(
          and(
            eq(templateDrafts.organizationId, organizationId),
            eq(templateDrafts.id, draft.id)
          )
        );
    }
  });
}

export async function listBrandKits(userId: string) {
  const org = await getRequiredUserOrg(userId);
  await migrateLegacyBrandKitIds(org.organizationId);

  const rows = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.organizationId, org.organizationId))
    .orderBy(brandKits.name);

  return rows.map((row) =>
    sanitizeBrandKit({
      id: row.id,
      name: row.name,
      iconUrl: row.iconUrl,
      colors: row.colors
    })
  );
}

export async function upsertBrandKit(userId: string, kit: BrandKit) {
  const org = await getRequiredUserOrg(userId);
  const normalized = sanitizeBrandKit(kit);

  await db
    .insert(brandKits)
    .values({
      organizationId: org.organizationId,
      id: normalized.id,
      name: normalized.name,
      iconUrl: normalized.iconUrl,
      colors: normalized.colors
    })
    .onConflictDoUpdate({
      target: [brandKits.organizationId, brandKits.id],
      set: {
        name: normalized.name,
        iconUrl: normalized.iconUrl,
        colors: normalized.colors,
        updatedAt: nowSql
      }
    });
}

export async function deleteBrandKitById(userId: string, id: string) {
  const org = await getRequiredUserOrg(userId);
  const target = id.trim().toLowerCase();
  if (!target) {
    return;
  }

  const [existing] = await db
    .select({ value: count() })
    .from(brandKits)
    .where(eq(brandKits.organizationId, org.organizationId));

  if ((existing?.value ?? 0) <= 1) {
    return;
  }

  await db
    .delete(brandKits)
    .where(
      and(
        eq(brandKits.organizationId, org.organizationId),
        eq(brandKits.id, target)
      )
    );
}
