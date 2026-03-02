import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { BrandKit } from "@/lib/brand-kits";
import type { ContactBook } from "@/lib/contact-books";

export const templateDrafts = pgTable("template_drafts", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	sesTemplateName: text("ses_template_name").unique(),
	subject: text("subject").notNull(),
	htmlContent: text("html_content").notNull(),
	textContent: text("text_content").notNull(),
	designJson: jsonb("design_json").$type<Record<string, unknown>>(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sentEmails = pgTable("sent_emails", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	recipient: text("recipient").notNull(),
	templateUsed: text("template_used").notNull(),
	status: text("status").notNull(),
	messageId: text("message_id"),
	error: text("error"),
	timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const brandKits = pgTable("brand_kits", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	iconUrl: text("icon_url").notNull(),
	colors: jsonb("colors").$type<BrandKit["colors"]>().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactBooks = pgTable("contact_books", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	recipients: jsonb("entries").$type<ContactBook["recipients"]>().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const nowSql = sql`now()`;
