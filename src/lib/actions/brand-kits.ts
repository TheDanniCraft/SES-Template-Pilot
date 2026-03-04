"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BrandKit } from "@/lib/brand-kits";
import { deleteBrandKitById, upsertBrandKit } from "@/lib/brand-kits-store";
import { getServerSessionUser } from "@/lib/server-auth";

const hexSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, "Invalid hex color");

const colorValuesSchema = z.object({
  text: hexSchema,
  muted: hexSchema,
  surface: hexSchema,
  border: hexSchema,
  accent: hexSchema,
  link: hexSchema,
  buttonText: hexSchema
});

const brandKitSchema = z.object({
  id: z.string().trim().uuid("Invalid brand kit id"),
  name: z.string().trim().min(2, "Name is required"),
  iconUrl: z.string().trim().url("Icon URL must be a valid URL"),
  colors: colorValuesSchema.extend({
    dark: colorValuesSchema.optional(),
    light: colorValuesSchema.optional()
  })
});

export async function saveBrandKitAction(input: BrandKit) {
  const user = await getServerSessionUser();
  if (!user) {
    return {
      success: false,
      error: "Unauthorized"
    };
  }

  const parsed = brandKitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid brand kit"
    };
  }

  await upsertBrandKit(user.id, parsed.data as BrandKit);
  revalidatePath("/app/brand-kits");
  revalidatePath("/app/templates/new");
  revalidatePath("/app/templates");
  return { success: true };
}

export async function deleteBrandKitAction(id: string) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const normalizedId = id.trim().toLowerCase();
  if (!normalizedId) {
    return { success: false, error: "ID is required" };
  }

  if (!z.string().uuid().safeParse(normalizedId).success) {
    return { success: false, error: "Invalid brand kit id" };
  }

  await deleteBrandKitById(user.id, normalizedId);
  revalidatePath("/app/brand-kits");
  revalidatePath("/app/templates/new");
  revalidatePath("/app/templates");
  return { success: true };
}
