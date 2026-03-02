"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ContactBook } from "@/lib/contact-books";
import { isValidContactEmail, normalizeRecipients } from "@/lib/contact-books";
import { deleteContactBookById, upsertContactBook } from "@/lib/contact-books-store";
import { isServerSessionAuthenticated } from "@/lib/server-auth";

const contactBookSchema = z.object({
  id: z
    .string()
    .trim()
    .min(2, "ID is required")
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase letters, numbers, and dashes"),
  name: z.string().trim().min(2, "Name is required"),
  recipients: z
    .array(z.string().trim().toLowerCase())
    .min(1, "Add at least one recipient")
    .superRefine((recipients, ctx) => {
      for (const recipient of recipients) {
        if (!isValidContactEmail(recipient)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid recipient email: ${recipient}`
          });
          return;
        }
      }
    })
});

export async function saveContactBookAction(input: ContactBook) {
  if (!(await isServerSessionAuthenticated())) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = contactBookSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid contact book"
    };
  }

  await upsertContactBook({
    id: parsed.data.id,
    name: parsed.data.name,
    recipients: normalizeRecipients(parsed.data.recipients)
  });

  revalidatePath("/contact-books");
  revalidatePath("/send");
  return { success: true };
}

export async function deleteContactBookAction(id: string) {
  if (!(await isServerSessionAuthenticated())) {
    return { success: false, error: "Unauthorized" };
  }

  const target = id.trim().toLowerCase();
  if (!target) {
    return { success: false, error: "ID is required" };
  }

  await deleteContactBookById(target);
  revalidatePath("/contact-books");
  revalidatePath("/send");
  return { success: true };
}
