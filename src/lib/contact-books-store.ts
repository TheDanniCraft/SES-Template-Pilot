import { eq } from "drizzle-orm";
import type { ContactBook } from "@/lib/contact-books";
import { extractRecipientsFromUnknown, normalizeRecipients } from "@/lib/contact-books";
import { db } from "@/lib/db";
import { contactBooks, nowSql } from "@/lib/schema";

function sanitizeContactBook(input: ContactBook): ContactBook {
  return {
    id: input.id.trim().toLowerCase(),
    name: input.name.trim(),
    recipients: normalizeRecipients(input.recipients)
  };
}

export async function listContactBooks() {
  const rows = await db
    .select()
    .from(contactBooks)
    .orderBy(contactBooks.name);

  return rows.map((row) =>
    sanitizeContactBook({
      id: row.id,
      name: row.name,
      recipients: extractRecipientsFromUnknown(row.recipients)
    })
  );
}

export async function upsertContactBook(book: ContactBook) {
  const normalized = sanitizeContactBook(book);

  await db
    .insert(contactBooks)
    .values({
      id: normalized.id,
      name: normalized.name,
      recipients: normalized.recipients
    })
    .onConflictDoUpdate({
      target: contactBooks.id,
      set: {
        name: normalized.name,
        recipients: normalized.recipients,
        updatedAt: nowSql
      }
    });
}

export async function deleteContactBookById(id: string) {
  const target = id.trim().toLowerCase();
  if (!target) {
    return;
  }

  await db.delete(contactBooks).where(eq(contactBooks.id, target));
}
