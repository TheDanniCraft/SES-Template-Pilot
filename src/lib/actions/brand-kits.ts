"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BrandKit } from "@/lib/brand-kits";
import { deleteBrandKitById, upsertBrandKit } from "@/lib/brand-kits-store";
import { isServerSessionAuthenticated } from "@/lib/server-auth";

const hexSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, "Invalid hex color");

const brandKitSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, "ID is required")
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase letters, numbers, and dashes"),
  name: z.string().trim().min(2, "Name is required"),
  iconUrl: z.string().trim().url("Icon URL must be a valid URL"),
  colors: z.object({
    text: hexSchema,
    muted: hexSchema,
    surface: hexSchema,
    border: hexSchema,
    accent: hexSchema,
    link: hexSchema,
    buttonText: hexSchema
  })
});

export async function saveBrandKitAction(input: BrandKit) {
  if (!(await isServerSessionAuthenticated())) {
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

  await upsertBrandKit(parsed.data as BrandKit);
  revalidatePath("/brand-kits");
  revalidatePath("/templates/new");
  revalidatePath("/templates");
  return { success: true };
}

export async function deleteBrandKitAction(id: string) {
  if (!(await isServerSessionAuthenticated())) {
    return { success: false, error: "Unauthorized" };
  }

  if (!id.trim()) {
    return { success: false, error: "ID is required" };
  }

  await deleteBrandKitById(id);
  revalidatePath("/brand-kits");
  revalidatePath("/templates/new");
  revalidatePath("/templates");
  return { success: true };
}
