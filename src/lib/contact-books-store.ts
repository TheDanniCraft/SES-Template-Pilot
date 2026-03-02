import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function migrateLegacyContactBookIds(userId: string) {
  const rows = await db
    .select()
    .from(contactBooks)
    .where(eq(contactBooks.userId, userId));

  const legacyRows = rows.filter((row) => !isUuid(row.id));
  for (const row of legacyRows) {
    await db
      .update(contactBooks)
      .set({
        id: randomUUID(),
        updatedAt: nowSql
      })
      .where(and(eq(contactBooks.userId, userId), eq(contactBooks.id, row.id)));
  }
}

export async function listContactBooks(userId: string) {
  await migrateLegacyContactBookIds(userId);

  const rows = await db
    .select()
    .from(contactBooks)
    .where(eq(contactBooks.userId, userId))
    .orderBy(contactBooks.name);

  return rows.map((row) =>
    sanitizeContactBook({
      id: row.id,
      name: row.name,
      recipients: extractRecipientsFromUnknown(row.recipients)
    })
  );
}

export async function upsertContactBook(userId: string, book: ContactBook) {
  const normalized = sanitizeContactBook(book);

  await db
    .insert(contactBooks)
    .values({
      userId,
      id: normalized.id,
      name: normalized.name,
      recipients: normalized.recipients
    })
    .onConflictDoUpdate({
      target: [contactBooks.userId, contactBooks.id],
      set: {
        name: normalized.name,
        recipients: normalized.recipients,
        updatedAt: nowSql
      }
    });
}

export async function deleteContactBookById(userId: string, id: string) {
  const target = id.trim().toLowerCase();
  if (!target) {
    return;
  }

  await db
    .delete(contactBooks)
    .where(and(eq(contactBooks.userId, userId), eq(contactBooks.id, target)));
}
