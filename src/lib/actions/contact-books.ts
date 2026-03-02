"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ContactBook } from "@/lib/contact-books";
import { isValidContactEmail, normalizeRecipients } from "@/lib/contact-books";
import { deleteContactBookById, upsertContactBook } from "@/lib/contact-books-store";
import { getServerSessionUser } from "@/lib/server-auth";

const contactBookSchema = z.object({
  id: z.string().trim().uuid("Invalid contact book id"),
  previousId: z.string().trim().nullable().optional(),
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

export async function saveContactBookAction(
  input: ContactBook & { previousId?: string | null }
) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = contactBookSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid contact book"
    };
  }

  const normalizedId = parsed.data.id.toLowerCase();
  const normalizedPreviousId = parsed.data.previousId?.toLowerCase() ?? null;

  await upsertContactBook(user.id, {
    id: normalizedId,
    name: parsed.data.name,
    recipients: normalizeRecipients(parsed.data.recipients)
  });

  if (normalizedPreviousId && normalizedPreviousId !== normalizedId) {
    await deleteContactBookById(user.id, normalizedPreviousId);
  }

  revalidatePath("/app/contact-books");
  revalidatePath("/app/send");
  return { success: true };
}

export async function deleteContactBookAction(id: string) {
  const user = await getServerSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const target = id.trim().toLowerCase();
  if (!target) {
    return { success: false, error: "ID is required" };
  }

  await deleteContactBookById(user.id, target);
  revalidatePath("/app/contact-books");
  revalidatePath("/app/send");
  return { success: true };
}
