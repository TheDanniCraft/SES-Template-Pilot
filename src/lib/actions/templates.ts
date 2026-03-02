"use server";

import {
  CreateTemplateCommand,
  DeleteTemplateCommand,
  GetTemplateCommand,
  ListTemplatesCommand,
  UpdateTemplateCommand
} from "@aws-sdk/client-ses";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nowSql, templateDrafts } from "@/lib/schema";
import { sesClient } from "@/lib/aws-ses";
import { isServerSessionAuthenticated } from "@/lib/server-auth";
import {
  attachPreviewVariables,
  attachBrandKitId,
  extractBrandKitId,
  extractPreviewVariables,
  normalizeDesignJson
} from "@/lib/ses-template-json";
import {
  syncTemplateSchema,
  templateDraftSchema,
  type SyncTemplateInput,
  type TemplateDraftInput
} from "@/lib/validators";

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

async function hasSession() {
  return isServerSessionAuthenticated();
}

export async function listSesTemplates() {
  if (!(await hasSession())) {
    return {
      success: false,
      error: "Unauthorized",
      data: []
    };
  }

  try {
    const response = await sesClient.send(
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
          const details = await sesClient.send(
            new GetTemplateCommand({
              TemplateName: item.Name
            })
          );
          return {
            name: item.Name,
            subject: details.Template?.SubjectPart ?? "",
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
  if (!(await hasSession())) {
    return {
      success: false,
      error: "Unauthorized",
      data: null
    };
  }

  try {
    const response = await sesClient.send(
      new GetTemplateCommand({
        TemplateName: name
      })
    );
    return { success: true, data: response.Template };
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
  if (!(await hasSession())) {
    return [];
  }

  const drafts = await db
    .select()
    .from(templateDrafts)
    .orderBy(desc(templateDrafts.updatedAt));
  return drafts;
}

export async function getLocalDraftById(id: string) {
  if (!(await hasSession())) {
    return null;
  }

  if (!isUuid(id)) {
    return null;
  }

  const draft = await db.query.templateDrafts.findFirst({
    where: eq(templateDrafts.id, id)
  });
  return draft ?? null;
}

export async function getLocalDraftBySesName(name: string) {
  if (!(await hasSession())) {
    return null;
  }

  const draft = await db.query.templateDrafts.findFirst({
    where: eq(templateDrafts.sesTemplateName, name)
  });
  return draft ?? null;
}

export async function saveTemplateDraftAction(input: TemplateDraftInput) {
  if (!(await hasSession())) {
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
  const normalizedDesignJson = attachBrandKitId(
    attachPreviewVariables(
      normalizeDesignJson(payload.designJson, {
        sesTemplateName: payload.sesTemplateName,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent
      }),
      payload.previewVariables
    ),
    payload.brandKitId
  );

  if (payload.id) {
    await db
      .update(templateDrafts)
      .set({
        name: payload.name,
        sesTemplateName: payload.sesTemplateName,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
        designJson: normalizedDesignJson,
        updatedAt: nowSql
      })
      .where(eq(templateDrafts.id, payload.id));
    return { success: true, draftId: payload.id };
  }

  const [draft] = await db
    .insert(templateDrafts)
    .values({
      name: payload.name,
      sesTemplateName: payload.sesTemplateName,
      subject: payload.subject,
      htmlContent: payload.htmlContent,
      textContent: payload.textContent,
      designJson: normalizedDesignJson
    })
    .returning({ id: templateDrafts.id });

  return { success: true, draftId: draft.id };
}

export async function syncTemplateToSesAction(input: SyncTemplateInput) {
  if (!(await hasSession())) {
    return {
      success: false,
      error: "Unauthorized"
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
  const existingDraft = await db.query.templateDrafts.findFirst({
    where: eq(templateDrafts.sesTemplateName, payload.sesTemplateName)
  });

  try {
    await sesClient.send(
      new UpdateTemplateCommand({
        Template: {
          TemplateName: payload.sesTemplateName,
          SubjectPart: payload.subject,
          HtmlPart: payload.htmlContent,
          TextPart: payload.textContent
        }
      })
    );
  } catch {
    try {
      await sesClient.send(
        new CreateTemplateCommand({
          Template: {
            TemplateName: payload.sesTemplateName,
            SubjectPart: payload.subject,
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
            subject: payload.subject,
            htmlContent: payload.htmlContent,
            textContent: payload.textContent
          }),
          extractPreviewVariables(existingDraft?.designJson)
        ),
        extractBrandKitId(existingDraft?.designJson)
      ),
      updatedAt: nowSql
    })
    .where(eq(templateDrafts.sesTemplateName, payload.sesTemplateName));

  return { success: true };
}

type DeleteTemplateInput = {
  draftId?: string;
  sesTemplateName?: string;
};

export async function deleteTemplateAction(input: DeleteTemplateInput) {
  if (!(await hasSession())) {
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
      where: eq(templateDrafts.id, draftId)
    });
    if (draft?.sesTemplateName) {
      sesTemplateName = draft.sesTemplateName;
    }

    await db.delete(templateDrafts).where(eq(templateDrafts.id, draftId));
  }

  if (sesTemplateName) {
    await db
      .delete(templateDrafts)
      .where(eq(templateDrafts.sesTemplateName, sesTemplateName));

    try {
      await sesClient.send(
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
  if (!(await hasSession())) {
    return { success: false, error: "Unauthorized" };
  }

  const draftId = input.draftId?.trim();
  const sesTemplateName = input.sesTemplateName.trim();

  if (!sesTemplateName) {
    return { success: false, error: "SES template name is required" };
  }

  try {
    const response = await sesClient.send(
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
          where: eq(templateDrafts.id, draftId)
        })
      : null;

    if (!existingDraft) {
      existingDraft = await db.query.templateDrafts.findFirst({
        where: eq(templateDrafts.sesTemplateName, sesTemplateName)
      });
    }

    const payload = {
      name: existingDraft?.name ?? sesTemplate.TemplateName,
      sesTemplateName: sesTemplate.TemplateName,
      subject: sesTemplate.SubjectPart ?? "",
      htmlContent: sesTemplate.HtmlPart ?? "",
      textContent: sesTemplate.TextPart ?? "",
      designJson: attachBrandKitId(
        attachPreviewVariables(
          normalizeDesignJson(existingDraft?.designJson ?? undefined, {
            sesTemplateName: sesTemplate.TemplateName,
            subject: sesTemplate.SubjectPart ?? "",
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
        .where(eq(templateDrafts.id, existingDraft.id));

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
          designJson: payload.designJson,
          previewVariables:
            extractPreviewVariables(payload.designJson ?? undefined) ?? {},
          brandKitId: extractBrandKitId(payload.designJson ?? undefined)
        }
      };
    }

    const [created] = await db
      .insert(templateDrafts)
      .values(payload)
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
