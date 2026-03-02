import { count, eq } from "drizzle-orm";
import type { BrandKit } from "@/lib/brand-kits";
import { db } from "@/lib/db";
import { nowSql, brandKits } from "@/lib/schema";

const DEFAULT_BRAND_KITS: BrandKit[] = [
  {
    id: "clipify",
    name: "Clipify",
    iconUrl: "https://storage.cloud.thedannicraft.de/assets/Clipify.png",
    colors: {
      text: "#e2e8f0",
      muted: "#94a3b8",
      surface: "#0f172a",
      border: "#5F06F5",
      accent: "#5F06F5",
      link: "#5F06F5",
      buttonText: "#ffffff"
    }
  }
];

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

function sanitizeBrandKit(input: BrandKit): BrandKit {
  return {
    id: input.id.trim().toLowerCase(),
    name: input.name.trim(),
    iconUrl: input.iconUrl.trim(),
    colors: {
      text: sanitizeHex(input.colors.text, "#e2e8f0"),
      muted: sanitizeHex(input.colors.muted, "#94a3b8"),
      surface: sanitizeHex(input.colors.surface, "#0f172a"),
      border: sanitizeHex(input.colors.border, "#5f06f5"),
      accent: sanitizeHex(input.colors.accent, "#5f06f5"),
      link: sanitizeHex(input.colors.link, "#5f06f5"),
      buttonText: sanitizeHex(input.colors.buttonText, "#ffffff")
    }
  };
}

async function ensureSeedBrandKits() {
  const [existing] = await db
    .select({ value: count() })
    .from(brandKits);

  if ((existing?.value ?? 0) > 0) {
    return;
  }

  await db
    .insert(brandKits)
    .values(
      DEFAULT_BRAND_KITS.map((kit) => {
        const normalized = sanitizeBrandKit(kit);
        return {
          id: normalized.id,
          name: normalized.name,
          iconUrl: normalized.iconUrl,
          colors: normalized.colors
        };
      })
    )
    .onConflictDoNothing();
}

export async function listBrandKits() {
  await ensureSeedBrandKits();

  const rows = await db
    .select()
    .from(brandKits)
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

export async function upsertBrandKit(kit: BrandKit) {
  const normalized = sanitizeBrandKit(kit);

  await db
    .insert(brandKits)
    .values({
      id: normalized.id,
      name: normalized.name,
      iconUrl: normalized.iconUrl,
      colors: normalized.colors
    })
    .onConflictDoUpdate({
      target: brandKits.id,
      set: {
        name: normalized.name,
        iconUrl: normalized.iconUrl,
        colors: normalized.colors,
        updatedAt: nowSql
      }
    });
}

export async function deleteBrandKitById(id: string) {
  const target = id.trim().toLowerCase();
  if (!target) {
    return;
  }

  const [existing] = await db
    .select({ value: count() })
    .from(brandKits);

  if ((existing?.value ?? 0) <= 1) {
    return;
  }

  await db.delete(brandKits).where(eq(brandKits.id, target));
}
