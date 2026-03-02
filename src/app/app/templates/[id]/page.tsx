import { notFound } from "next/navigation";
import { TemplateEditorForm } from "@/components/template-editor-form";
import { listBrandKits } from "@/lib/brand-kits-store";
import { extractBodyHtml } from "@/lib/html-utils";
import { getServerSessionUser } from "@/lib/server-auth";
import {
  extractBrandKitId,
  extractPreviewVariables,
  normalizeDesignJson
} from "@/lib/ses-template-json";
import {
  getLocalDraftById,
  getLocalDraftBySesName,
  getSesTemplate
} from "@/lib/actions/templates";

type TemplateEditorPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const DEFAULT_PREVIEW_VARIABLES = {
  name: "Alex",
  company: "Acme Labs"
};

export default async function TemplateEditorPage({
  params
}: TemplateEditorPageProps) {
  const user = await getServerSessionUser();
  const brandKits = user ? await listBrandKits(user.id) : [];
  const { id } = await params;

  const localById = await getLocalDraftById(id);
  if (localById) {
    return (
      <section className="space-y-4">
        <header className="panel rounded-xl p-4 text-lg font-semibold">
          Edit Draft: {localById.name}
        </header>
        <div className="panel rounded-xl p-4">
          <TemplateEditorForm
            brandKits={brandKits}
            initialValues={{
              id: localById.id,
              name: localById.name,
              sesTemplateName: localById.sesTemplateName ?? localById.name,
              subject: localById.subject,
              htmlContent: localById.htmlContent,
              textContent: localById.textContent,
              brandKitId: extractBrandKitId(localById.designJson ?? undefined),
              previewVariables:
                extractPreviewVariables(localById.designJson ?? undefined) ??
                DEFAULT_PREVIEW_VARIABLES,
              designJson: normalizeDesignJson(localById.designJson ?? undefined, {
                sesTemplateName: localById.sesTemplateName ?? localById.name,
                subject: localById.subject,
                htmlContent: localById.htmlContent,
                textContent: localById.textContent
              })
            }}
          />
        </div>
      </section>
    );
  }

  const localBySesName = await getLocalDraftBySesName(id);
  if (localBySesName) {
    return (
      <section className="space-y-4">
        <header className="panel rounded-xl p-4 text-lg font-semibold">
          Edit Draft: {localBySesName.name}
        </header>
        <div className="panel rounded-xl p-4">
          <TemplateEditorForm
            brandKits={brandKits}
            initialValues={{
              id: localBySesName.id,
              name: localBySesName.name,
              sesTemplateName: localBySesName.sesTemplateName ?? localBySesName.name,
              subject: localBySesName.subject,
              htmlContent: localBySesName.htmlContent,
              textContent: localBySesName.textContent,
              brandKitId: extractBrandKitId(localBySesName.designJson ?? undefined),
              previewVariables:
                extractPreviewVariables(localBySesName.designJson ?? undefined) ??
                DEFAULT_PREVIEW_VARIABLES,
              designJson: normalizeDesignJson(localBySesName.designJson ?? undefined, {
                sesTemplateName: localBySesName.sesTemplateName ?? localBySesName.name,
                subject: localBySesName.subject,
                htmlContent: localBySesName.htmlContent,
                textContent: localBySesName.textContent
              })
            }}
          />
        </div>
      </section>
    );
  }

  const sesTemplate = await getSesTemplate(id);
  if (!sesTemplate.success || !sesTemplate.data) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <header className="panel rounded-xl p-4 text-lg font-semibold">
        SES Template: {sesTemplate.data.TemplateName}
      </header>
      <div className="panel rounded-xl p-4">
        <TemplateEditorForm
          brandKits={brandKits}
          initialValues={{
            name: sesTemplate.data.TemplateName ?? id,
            sesTemplateName: sesTemplate.data.TemplateName ?? id,
            subject: sesTemplate.data.SubjectPart ?? "",
            htmlContent: extractBodyHtml(sesTemplate.data.HtmlPart ?? ""),
            textContent: sesTemplate.data.TextPart ?? "",
            brandKitId: undefined,
            previewVariables: DEFAULT_PREVIEW_VARIABLES,
            designJson: normalizeDesignJson(undefined, {
              sesTemplateName: sesTemplate.data.TemplateName ?? id,
              subject: sesTemplate.data.SubjectPart ?? "",
              htmlContent: sesTemplate.data.HtmlPart ?? "",
              textContent: sesTemplate.data.TextPart ?? ""
            })
          }}
        />
      </div>
    </section>
  );
}
