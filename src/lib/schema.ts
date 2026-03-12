import { sql } from "drizzle-orm";
import {
	integer,
	jsonb,
	boolean,
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
	name: text("name"),
	passwordHash: text("password_hash"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const organizations = pgTable("organizations", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const organizationMembers = pgTable(
	"organization_members",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("member"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.organizationId, table.userId] }),
		userIndex: index("organization_members_user_idx").on(table.userId)
	})
);

export const organizationInvites = pgTable(
	"organization_invites",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		tokenEncrypted: text("token_encrypted"),
		invitedByUserId: uuid("invited_by_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		orgEmailIndex: index("organization_invites_org_email_idx").on(
			table.organizationId,
			table.email
		)
	})
);

export const organizationLicenses = pgTable("organization_licenses", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organizations.id, { onDelete: "cascade" }),
	provider: text("provider").notNull().default("polar"),
	status: text("status").notNull().default("active"),
	licenseKeyId: text("license_key_id").notNull(),
	activationId: text("activation_id").notNull(),
	licenseKeyHash: text("license_key_hash").notNull(),
	licenseKeyEncrypted: text("license_key_encrypted").notNull(),
	label: text("label").notNull(),
	lastValidatedAt: timestamp("last_validated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const organizationSesConfigs = pgTable("organization_ses_configs", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organizations.id, { onDelete: "cascade" }),
	awsRegion: text("aws_region"),
	accessKeyId: text("access_key_id"),
	secretAccessKey: text("secret_access_key"),
	sessionToken: text("session_token"),
	sourceEmail: text("source_email"),
	openTrackingEnabled: boolean("open_tracking_enabled").notNull().default(true),
	clickTrackingEnabled: boolean("click_tracking_enabled").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
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

export const templateDrafts = pgTable(
	"template_drafts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sesTemplateName: text("ses_template_name"),
		subject: text("subject").notNull(),
		htmlContent: text("html_content").notNull(),
		textContent: text("text_content").notNull(),
		editorJson: jsonb("editor_json").$type<Record<string, unknown>>(),
		designJson: jsonb("design_json").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		orgUpdatedIndex: index("template_drafts_org_updated_idx").on(
			table.organizationId,
			table.updatedAt
		),
		orgSesTemplateNameUnique: uniqueIndex(
			"template_drafts_org_ses_template_name_unique"
		).on(table.organizationId, table.sesTemplateName)
	})
);

export const sentEmails = pgTable(
	"sent_emails",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.references(() => users.id, { onDelete: "set null" }),
		recipient: text("recipient").notNull(),
		templateUsed: text("template_used").notNull(),
		status: text("status").notNull(),
		messageId: text("message_id"),
		error: text("error"),
		timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		orgTimestampIndex: index("sent_emails_org_timestamp_idx").on(
			table.organizationId,
			table.timestamp
		)
	})
);

export const brandKits = pgTable(
	"brand_kits",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		id: text("id").notNull(),
		name: text("name").notNull(),
		iconUrl: text("icon_url").notNull(),
		colors: jsonb("colors").$type<BrandKit["colors"]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.organizationId, table.id] }),
		orgNameIndex: index("brand_kits_org_name_idx").on(
			table.organizationId,
			table.name
		)
	})
);

export const contactBooks = pgTable(
	"contact_books",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		id: text("id").notNull(),
		name: text("name").notNull(),
		recipients: jsonb("entries").$type<ContactBook["recipients"]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.organizationId, table.id] }),
		orgNameIndex: index("contact_books_org_name_idx").on(
			table.organizationId,
			table.name
		)
	})
);

export const nowSql = sql`now()`;
