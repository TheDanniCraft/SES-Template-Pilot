import { sql } from "drizzle-orm";
import {
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	uniqueIndex,
	primaryKey,
	index
} from "drizzle-orm/pg-core";
import type { BrandKit } from "@/lib/brand-kits";
import type { ContactBook } from "@/lib/contact-books";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	email: text("email").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const authMagicLinks = pgTable("auth_magic_links", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const authSessions = pgTable(
	"auth_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull().unique(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		userIdIndex: index("auth_sessions_user_id_idx").on(table.userId),
		expiresAtIndex: index("auth_sessions_expires_at_idx").on(table.expiresAt)
	})
);

export const userSesConfigs = pgTable("user_ses_configs", {
	userId: uuid("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	awsRegion: text("aws_region"),
	accessKeyId: text("access_key_id"),
	secretAccessKey: text("secret_access_key"),
	sessionToken: text("session_token"),
	sourceEmail: text("source_email"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const templateDrafts = pgTable(
	"template_drafts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sesTemplateName: text("ses_template_name"),
		subject: text("subject").notNull(),
		htmlContent: text("html_content").notNull(),
		textContent: text("text_content").notNull(),
		designJson: jsonb("design_json").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		userUpdatedIndex: index("template_drafts_user_updated_idx").on(
			table.userId,
			table.updatedAt
		),
		userSesTemplateNameUnique: uniqueIndex(
			"template_drafts_user_ses_template_name_unique"
		).on(table.userId, table.sesTemplateName)
	})
);

export const sentEmails = pgTable(
	"sent_emails",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		recipient: text("recipient").notNull(),
		templateUsed: text("template_used").notNull(),
		status: text("status").notNull(),
		messageId: text("message_id"),
		error: text("error"),
		timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		userTimestampIndex: index("sent_emails_user_timestamp_idx").on(
			table.userId,
			table.timestamp
		)
	})
);

export const brandKits = pgTable(
	"brand_kits",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		id: text("id").notNull(),
		name: text("name").notNull(),
		iconUrl: text("icon_url").notNull(),
		colors: jsonb("colors").$type<BrandKit["colors"]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.id] }),
		userNameIndex: index("brand_kits_user_name_idx").on(table.userId, table.name)
	})
);

export const contactBooks = pgTable(
	"contact_books",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		id: text("id").notNull(),
		name: text("name").notNull(),
		recipients: jsonb("entries").$type<ContactBook["recipients"]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.id] }),
		userNameIndex: index("contact_books_user_name_idx").on(table.userId, table.name)
	})
);

export const nowSql = sql`now()`;
