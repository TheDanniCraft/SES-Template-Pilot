"use server";

import {
  CreateTemplateCommand,
  DeleteTemplateCommand,
  GetTemplateCommand,
  ListTemplatesCommand,
  UpdateTemplateCommand
} from "@aws-sdk/client-ses";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nowSql, templateDrafts } from "@/lib/schema";
import { getServerSessionUser } from "@/lib/server-auth";
import {
  attachPreviewVariables,
  attachBrandKitId,
  extractBrandKitId,
  extractPreviewVariables,
  normalizeDesignJson
} from "@/lib/ses-template-json";
import { getUserSesClients } from "@/lib/user-ses";
import { decodeEscapedUnicode } from "@/lib/unicode";
import {
  syncTemplateSchema,
  templateDraftSchema,
  type SyncTemplateInput,
  type TemplateDraftInput
} from "@/lib/validators";

const LINK_CARD_DEFAULT_ATTRS = {
  mailyComponent: "linkCard",
  title: "",
  description: "",
  link: "",
  linkTitle: "",
  image: "",
  subTitle: "",
  badgeText: ""
} as const;

function normalizeLinkCardAttrs(input: unknown) {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    ...source,
    mailyComponent:
      typeof source.mailyComponent === "string"
        ? source.mailyComponent
        : typeof source.mailycomponent === "string"
          ? source.mailycomponent
        : LINK_CARD_DEFAULT_ATTRS.mailyComponent,
    title: typeof source.title === "string" ? source.title : LINK_CARD_DEFAULT_ATTRS.title,
    description:
      typeof source.description === "string"
        ? source.description
        : LINK_CARD_DEFAULT_ATTRS.description,
    link:
      typeof source.link === "string"
        ? source.link
        : typeof source.href === "string"
          ? source.href
          : LINK_CARD_DEFAULT_ATTRS.link,
    linkTitle:
      typeof source.linkTitle === "string"
        ? source.linkTitle
        : typeof source.linktitle === "string"
          ? source.linktitle
        : LINK_CARD_DEFAULT_ATTRS.linkTitle,
    image:
      typeof source.image === "string"
        ? source.image
        : typeof source.src === "string"
          ? source.src
          : LINK_CARD_DEFAULT_ATTRS.image,
    subTitle:
      typeof source.subTitle === "string"
        ? source.subTitle
        : typeof source.subtitle === "string"
          ? source.subtitle
        : LINK_CARD_DEFAULT_ATTRS.subTitle,
    badgeText:
      typeof source.badgeText === "string"
        ? source.badgeText
        : typeof source.badgetext === "string"
          ? source.badgetext
        : LINK_CARD_DEFAULT_ATTRS.badgeText
  };
}

function normalizeEditorJsonNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => normalizeEditorJsonNode(entry));
  }

  if (!node || typeof node !== "object") {
    return node;
  }

  const record = node as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };

  if (record.type === "linkCard") {
    next.attrs = normalizeLinkCardAttrs(record.attrs);
  }

  if (Array.isArray(record.content)) {
    next.content = record.content.map((entry) => normalizeEditorJsonNode(entry));
  }

  return next;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function pickHtmlAttr(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = tag.match(pattern);
  const raw = match?.[2] ?? match?.[3];
  return typeof raw === "string" ? decodeHtmlAttribute(raw) : "";
}

function extractLinkCardAttrsFromHtml(html: string) {
  const tags = html.match(
    /<(?:a|div)\b[^>]*data-maily-component\s*=\s*("linkCard"|'linkCard')[^>]*>/gi
  ) ?? [];

  return tags.map((tag) => ({
    mailyComponent:
      pickHtmlAttr(tag, "mailycomponent") ||
      pickHtmlAttr(tag, "mailyComponent") ||
      LINK_CARD_DEFAULT_ATTRS.mailyComponent,
    title: pickHtmlAttr(tag, "title"),
    description: pickHtmlAttr(tag, "description"),
    link: pickHtmlAttr(tag, "link"),
    linkTitle: pickHtmlAttr(tag, "linktitle") || pickHtmlAttr(tag, "linkTitle"),
    image: pickHtmlAttr(tag, "image"),
    subTitle: pickHtmlAttr(tag, "subtitle") || pickHtmlAttr(tag, "subTitle"),
    badgeText: pickHtmlAttr(tag, "badgetext") || pickHtmlAttr(tag, "badgeText")
  }));
}

function hydrateLinkCardAttrsFromHtml(
  node: unknown,
  linkCards: Array<ReturnType<typeof normalizeLinkCardAttrs>>,
  cursor: { index: number }
): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => hydrateLinkCardAttrsFromHtml(entry, linkCards, cursor));
  }

  if (!node || typeof node !== "object") {
    return node;
  }

  const record = node as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };

  if (record.type === "linkCard") {
    const current = normalizeLinkCardAttrs(record.attrs);
    const fromHtml = linkCards[cursor.index];
    cursor.index += 1;
    if (fromHtml) {
      current.mailyComponent = fromHtml.mailyComponent || current.mailyComponent;
      current.title = current.title || fromHtml.title;
      current.description = current.description || fromHtml.description;
      current.link = current.link || fromHtml.link;
      current.linkTitle = current.linkTitle || fromHtml.linkTitle;
      current.image = current.image || fromHtml.image;
      current.subTitle = current.subTitle || fromHtml.subTitle;
      current.badgeText = current.badgeText || fromHtml.badgeText;
    }
    next.attrs = current;
  }

  if (Array.isArray(record.content)) {
    next.content = record.content.map((entry) =>
      hydrateLinkCardAttrsFromHtml(entry, linkCards, cursor)
    );
  }

  return next;
}

function normalizeEditorJsonForStorage(
  editorJson: Record<string, unknown> | undefined,
  htmlContent: string
) {
  if (!editorJson || typeof editorJson !== "object" || Array.isArray(editorJson)) {
    return undefined;
  }

  const normalizedNode = normalizeEditorJsonNode(editorJson);
  if (!normalizedNode || typeof normalizedNode !== "object" || Array.isArray(normalizedNode)) {
    return undefined;
  }

  const htmlLinkCards = extractLinkCardAttrsFromHtml(htmlContent);
  const hydratedNode =
    htmlLinkCards.length > 0
      ? hydrateLinkCardAttrsFromHtml(normalizedNode, htmlLinkCards, { index: 0 })
      : normalizedNode;

  if (!hydratedNode || typeof hydratedNode !== "object" || Array.isArray(hydratedNode)) {
    return undefined;
  }

  return hydratedNode as Record<string, unknown>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isTemplateMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const withName = error as { name?: string; message?: string };
  return (
    withName.name === "TemplateDoesNotExist" ||
    withName.message?.includes("TemplateDoesNotExist") === true
  );
}

async function getAuthorizedUser() {
  return getServerSessionUser();
}

function decodeDraftSubject<T extends { subject: string }>(draft: T) {
  return {
    ...draft,
    subject: decodeEscapedUnicode(draft.subject)
  };
}

function slugifyTemplateName(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "template";
}

async function generateUniqueDraftName(userId: string, baseName: string) {
  const normalizedBase = baseName.trim() || "Template";
  let next = `${normalizedBase} (Copy)`;
  let suffix = 2;

  while (true) {
    const exists = await db.query.templateDrafts.findFirst({
      where: and(eq(templateDrafts.userId, userId), eq(templateDrafts.name, next))
    });

    if (!exists) {
      return next;
    }

    next = `${normalizedBase} (Copy ${suffix})`;
    suffix += 1;
  }
}

async function generateUniqueSesTemplateName(userId: string, baseName: string) {
  const normalizedBase = slugifyTemplateName(baseName);
  let next = `${normalizedBase}-copy`;
  let suffix = 2;

  while (true) {
    const exists = await db.query.templateDrafts.findFirst({
      where: and(
        eq(templateDrafts.userId, userId),
        eq(templateDrafts.sesTemplateName, next)
      )
    });

    if (!exists) {
      return next;
    }

    next = `${normalizedBase}-copy-${suffix}`;
    suffix += 1;
  }
}

export async function listSesTemplates() {
  const user = await getAuthorizedUser();
  if (!user) {
    return {
      success: false,
      error: "Unauthorized",
      data: []
    };
  }

  const ses = await getUserSesClients(user.id);
  if (!ses.success) {
    return {
      success: false,
      error: ses.error,
      data: []
    };
  }

  try {
    const response = await ses.data.sesClient.send(
      new ListTemplatesCommand({
        MaxItems: 50
      })
    );
    const metadata = response.TemplatesMetadata ?? [];
    const templates = await Promise.all(
      metadata.map(async (item) => {
        if (!item.Name) {
          return {
            name: "",
            subject: "",
            createdAt: item.CreatedTimestamp ?? null
          };
        }

        try {
          const details = await ses.data.sesClient.send(
            new GetTemplateCommand({
              TemplateName: item.Name
            })
          );
          return {
            name: item.Name,
            subject: decodeEscapedUnicode(details.Template?.SubjectPart ?? ""),
            createdAt: item.CreatedTimestamp ?? null
          };
        } catch {
          return {
            name: item.Name,
            subject: "",
            createdAt: item.CreatedTimestamp ?? null
          };
        }
      })
    );
    return { success: true, data: templates };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load SES templates",
      data: []
    };
  }
}

export async function getSesTemplate(name: string) {
  const user = await getAuthorizedUser();
  if (!user) {
    return {
      success: false,
      error: "Unauthorized",
      data: null
    };
  }

  const ses = await getUserSesClients(user.id);
  if (!ses.success) {
    return {
      success: false,
      error: ses.error,
      data: null
    };
  }

  try {
    const response = await ses.data.sesClient.send(
      new GetTemplateCommand({
        TemplateName: name
      })
    );
    const template = response.Template
      ? {
          ...response.Template,
          SubjectPart: decodeEscapedUnicode(response.Template.SubjectPart ?? "")
        }
      : null;
    return { success: true, data: template };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load SES template",
      data: null
    };
  }
}

export async function listLocalDrafts() {
  const user = await getAuthorizedUser();
  if (!user) {
    return [];
  }

  const drafts = await db
    .select()
    .from(templateDrafts)
    .where(eq(templateDrafts.userId, user.id))
    .orderBy(desc(templateDrafts.updatedAt));
  return drafts.map(decodeDraftSubject);
}

export async function getLocalDraftById(id: string) {
  const user = await getAuthorizedUser();
  if (!user) {
    return null;
  }

  if (!isUuid(id)) {
    return null;
  }

  const draft = await db.query.templateDrafts.findFirst({
    where: and(eq(templateDrafts.id, id), eq(templateDrafts.userId, user.id))
  });
  return draft ? decodeDraftSubject(draft) : null;
}

export async function getLocalDraftBySesName(name: string) {
  const user = await getAuthorizedUser();
  if (!user) {
    return null;
  }

  const draft = await db.query.templateDrafts.findFirst({
    where: and(
      eq(templateDrafts.sesTemplateName, name),
      eq(templateDrafts.userId, user.id)
    )
  });
  return draft ? decodeDraftSubject(draft) : null;
}

type DuplicateTemplateInput = {
  source: "local" | "synced" | "ses";
  id: string;
};

export async function duplicateTemplateAction(input: DuplicateTemplateInput) {
  const user = await getAuthorizedUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const id = input.id.trim();
  if (!id) {
    return { success: false, error: "Template id is required" };
  }

  let sourceDraft: {
    name: string;
    sesTemplateName: string | null;
    subject: string;
    htmlContent: string;
    textContent: string;
    editorJson: Record<string, unknown> | null;
    designJson: Record<string, unknown> | null;
  } | null = null;

  if (input.source === "ses") {
    const sesTemplateName = id.startsWith("ses:") ? id.slice(4) : id;
    if (!sesTemplateName) {
      return { success: false, error: "Invalid SES template id" };
    }

    const ses = await getUserSesClients(user.id);
    if (!ses.success) {
      return { success: false, error: ses.error };
    }

    try {
      const response = await ses.data.sesClient.send(
        new GetTemplateCommand({
          TemplateName: sesTemplateName
        })
      );
      const template = response.Template;
      if (!template?.TemplateName) {
        return { success: false, error: "Template not found in SES" };
      }

      sourceDraft = {
        name: template.TemplateName,
        sesTemplateName: template.TemplateName,
        subject: decodeEscapedUnicode(template.SubjectPart ?? ""),
        htmlContent: template.HtmlPart ?? "",
        textContent: template.TextPart ?? "",
        editorJson: null,
        designJson: null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load SES template"
      };
    }
  } else {
    if (!isUuid(id)) {
      return { success: false, error: "Invalid draft id" };
    }

    const localDraft = await db.query.templateDrafts.findFirst({
      where: and(eq(templateDrafts.id, id), eq(templateDrafts.userId, user.id))
    });

    if (!localDraft) {
      return { success: false, error: "Template draft not found" };
    }

    sourceDraft = {
      name: localDraft.name,
      sesTemplateName: localDraft.sesTemplateName,
      subject: decodeEscapedUnicode(localDraft.subject),
      htmlContent: localDraft.htmlContent,
      textContent: localDraft.textContent,
      editorJson: localDraft.editorJson ?? null,
      designJson: localDraft.designJson ?? null
    };
  }

  if (!sourceDraft) {
    return { success: false, error: "Template source not found" };
  }

  const nextName = await generateUniqueDraftName(user.id, sourceDraft.name);
  const nextSesTemplateName = await generateUniqueSesTemplateName(
    user.id,
    sourceDraft.sesTemplateName ?? sourceDraft.name
  );

  const nextDesignJson = attachBrandKitId(
    attachPreviewVariables(
      normalizeDesignJson(sourceDraft.designJson ?? undefined, {
        sesTemplateName: nextSesTemplateName,
        subject: sourceDraft.subject,
        htmlContent: sourceDraft.htmlContent,
        textContent: sourceDraft.textContent
      }),
      extractPreviewVariables(sourceDraft.designJson ?? undefined)
    ),
    extractBrandKitId(sourceDraft.designJson ?? undefined)
  );

  const [created] = await db
    .insert(templateDrafts)
    .values({
      userId: user.id,
      name: nextName,
      sesTemplateName: nextSesTemplateName,
      subject: sourceDraft.subject,
      htmlContent: sourceDraft.htmlContent,
      textContent: sourceDraft.textContent,
      editorJson: sourceDraft.editorJson ?? undefined,
      designJson: nextDesignJson
    })
    .returning({ id: templateDrafts.id });

  return { success: true, draftId: created.id };
}

export async function saveTemplateDraftAction(input: TemplateDraftInput) {
  const user = await getAuthorizedUser();
  if (!user) {
    return {
      success: false,
      error: "Unauthorized"
    };
  }

  const parsed = templateDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid template"
    };
  }

  const payload = parsed.data;
  const normalizedSubject = decodeEscapedUnicode(payload.subject);
  const normalizedEditorJson = normalizeEditorJsonForStorage(
    payload.editorJson,
    payload.htmlContent
  );
  const normalizedDesignJson = attachBrandKitId(
    attachPreviewVariables(
      normalizeDesignJson(payload.designJson, {
        sesTemplateName: payload.sesTemplateName,
        subject: normalizedSubject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent
      }),
      payload.previewVariables
    ),
    payload.brandKitId
  );

  if (payload.id) {
    const [updated] = await db
      .update(templateDrafts)
      .set({
        name: payload.name,
        sesTemplateName: payload.sesTemplateName,
        subject: normalizedSubject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
        editorJson: normalizedEditorJson,
        designJson: normalizedDesignJson,
        updatedAt: nowSql
      })
      .where(and(eq(templateDrafts.id, payload.id), eq(templateDrafts.userId, user.id)))
      .returning({ id: templateDrafts.id });

    if (!updated) {
      return { success: false, error: "Draft not found" };
    }
    return { success: true, draftId: updated.id };
  }

  const [draft] = await db
    .insert(templateDrafts)
    .values({
      userId: user.id,
      name: payload.name,
      sesTemplateName: payload.sesTemplateName,
      subject: normalizedSubject,
      htmlContent: payload.htmlContent,
      textContent: payload.textContent,
      editorJson: normalizedEditorJson,
      designJson: normalizedDesignJson
    })
    .returning({ id: templateDrafts.id });

  return { success: true, draftId: draft.id };
}

export async function syncTemplateToSesAction(input: SyncTemplateInput) {
  const user = await getAuthorizedUser();
  if (!user) {
    return {
      success: false,
      error: "Unauthorized"
    };
  }

  const ses = await getUserSesClients(user.id);
  if (!ses.success) {
    return {
      success: false,
      error: ses.error
    };
  }

  const parsed = syncTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid template input"
    };
  }

  const payload = parsed.data;
  const normalizedSubject = decodeEscapedUnicode(payload.subject);
  const existingDraft = await db.query.templateDrafts.findFirst({
    where: and(
      eq(templateDrafts.sesTemplateName, payload.sesTemplateName),
      eq(templateDrafts.userId, user.id)
    )
  });

  try {
    await ses.data.sesClient.send(
      new UpdateTemplateCommand({
        Template: {
          TemplateName: payload.sesTemplateName,
          SubjectPart: normalizedSubject,
          HtmlPart: payload.htmlContent,
          TextPart: payload.textContent
        }
      })
    );
  } catch {
    try {
      await ses.data.sesClient.send(
        new CreateTemplateCommand({
          Template: {
            TemplateName: payload.sesTemplateName,
            SubjectPart: normalizedSubject,
            HtmlPart: payload.htmlContent,
            TextPart: payload.textContent
          }
        })
      );
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to sync to SES"
      };
    }
  }

  await db
    .update(templateDrafts)
    .set({
      designJson: attachBrandKitId(
        attachPreviewVariables(
          normalizeDesignJson(undefined, {
            sesTemplateName: payload.sesTemplateName,
            subject: normalizedSubject,
            htmlContent: payload.htmlContent,
            textContent: payload.textContent
          }),
          extractPreviewVariables(existingDraft?.designJson)
        ),
        extractBrandKitId(existingDraft?.designJson)
      ),
      updatedAt: nowSql
    })
    .where(
      and(
        eq(templateDrafts.userId, user.id),
        eq(templateDrafts.sesTemplateName, payload.sesTemplateName)
      )
    );

  return { success: true };
}

type DeleteTemplateInput = {
  draftId?: string;
  sesTemplateName?: string;
};

export async function deleteTemplateAction(input: DeleteTemplateInput) {
  const user = await getAuthorizedUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const draftId = input.draftId?.trim();
  const providedSesTemplateName = input.sesTemplateName?.trim();

  if (!draftId && !providedSesTemplateName) {
    return { success: false, error: "Template name is required" };
  }

  let sesTemplateName = providedSesTemplateName;
  if (draftId) {
    if (!isUuid(draftId)) {
      return { success: false, error: "Invalid draft id" };
    }

    const draft = await db.query.templateDrafts.findFirst({
      where: and(eq(templateDrafts.id, draftId), eq(templateDrafts.userId, user.id))
    });
    if (draft?.sesTemplateName) {
      sesTemplateName = draft.sesTemplateName;
    }

    await db
      .delete(templateDrafts)
      .where(and(eq(templateDrafts.id, draftId), eq(templateDrafts.userId, user.id)));
  }

  if (sesTemplateName) {
    await db
      .delete(templateDrafts)
      .where(
        and(
          eq(templateDrafts.userId, user.id),
          eq(templateDrafts.sesTemplateName, sesTemplateName)
        )
      );

    const ses = await getUserSesClients(user.id);
    if (!ses.success) {
      return {
        success: false,
        error: `${ses.error} Local draft was deleted.`
      };
    }

    try {
      await ses.data.sesClient.send(
        new DeleteTemplateCommand({
          TemplateName: sesTemplateName
        })
      );
    } catch (error) {
      if (!isTemplateMissingError(error)) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete template"
        };
      }
    }
  }

  return { success: true };
}

type ResetTemplateFromSesInput = {
  draftId?: string;
  sesTemplateName: string;
};

export async function resetTemplateDraftFromSesAction(
  input: ResetTemplateFromSesInput
) {
  const user = await getAuthorizedUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const ses = await getUserSesClients(user.id);
  if (!ses.success) {
    return { success: false, error: ses.error };
  }

  const draftId = input.draftId?.trim();
  const sesTemplateName = input.sesTemplateName.trim();

  if (!sesTemplateName) {
    return { success: false, error: "SES template name is required" };
  }

  try {
    const response = await ses.data.sesClient.send(
      new GetTemplateCommand({
        TemplateName: sesTemplateName
      })
    );

    const sesTemplate = response.Template;
    if (!sesTemplate?.TemplateName) {
      return { success: false, error: "Template was not found in SES" };
    }

    let existingDraft = draftId
      ? await db.query.templateDrafts.findFirst({
          where: and(eq(templateDrafts.id, draftId), eq(templateDrafts.userId, user.id))
        })
      : null;

    if (!existingDraft) {
      existingDraft = await db.query.templateDrafts.findFirst({
        where: and(
          eq(templateDrafts.sesTemplateName, sesTemplateName),
          eq(templateDrafts.userId, user.id)
        )
      });
    }

    const payload = {
      name: existingDraft?.name ?? sesTemplate.TemplateName,
      sesTemplateName: sesTemplate.TemplateName,
      subject: decodeEscapedUnicode(sesTemplate.SubjectPart ?? ""),
      htmlContent: sesTemplate.HtmlPart ?? "",
      textContent: sesTemplate.TextPart ?? "",
      editorJson: undefined,
      designJson: attachBrandKitId(
        attachPreviewVariables(
          normalizeDesignJson(existingDraft?.designJson ?? undefined, {
            sesTemplateName: sesTemplate.TemplateName,
            subject: decodeEscapedUnicode(sesTemplate.SubjectPart ?? ""),
            htmlContent: sesTemplate.HtmlPart ?? "",
            textContent: sesTemplate.TextPart ?? ""
          }),
          extractPreviewVariables(existingDraft?.designJson ?? undefined)
        ),
        extractBrandKitId(existingDraft?.designJson ?? undefined)
      )
    };

    if (existingDraft) {
      await db
        .update(templateDrafts)
        .set({
          ...payload,
          updatedAt: nowSql
        })
        .where(and(eq(templateDrafts.id, existingDraft.id), eq(templateDrafts.userId, user.id)));

      return {
        success: true,
        draftId: existingDraft.id,
        template: {
          id: existingDraft.id,
          name: payload.name,
          sesTemplateName: payload.sesTemplateName,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          textContent: payload.textContent,
          editorJson: payload.editorJson,
          designJson: payload.designJson,
          previewVariables:
            extractPreviewVariables(payload.designJson ?? undefined) ?? {},
          brandKitId: extractBrandKitId(payload.designJson ?? undefined)
        }
      };
    }

    const [created] = await db
      .insert(templateDrafts)
      .values({
        userId: user.id,
        ...payload
      })
      .returning({ id: templateDrafts.id });

    return {
      success: true,
      draftId: created.id,
      template: {
        id: created.id,
        name: payload.name,
        sesTemplateName: payload.sesTemplateName,
          subject: payload.subject,
          htmlContent: payload.htmlContent,
          textContent: payload.textContent,
          editorJson: payload.editorJson,
          designJson: payload.designJson,
          previewVariables:
            extractPreviewVariables(payload.designJson ?? undefined) ?? {},
        brandKitId: extractBrandKitId(payload.designJson ?? undefined)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset template"
    };
  }
}
