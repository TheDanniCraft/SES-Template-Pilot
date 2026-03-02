import { SendCampaignForm } from "@/components/send-campaign-form";
import { extractBodyHtml } from "@/lib/html-utils";
import { listBrandKits } from "@/lib/brand-kits-store";
import { listContactBooks } from "@/lib/contact-books-store";
import { getServerSessionUser } from "@/lib/server-auth";
import {
  getLocalDraftBySesName,
  getSesTemplate,
  listSesTemplates
} from "@/lib/actions/templates";
import {
  extractBrandKitId,
  extractPreviewVariables
} from "@/lib/ses-template-json";

export default async function SendPage() {
  const templatesResponse = await listSesTemplates();
  const user = await getServerSessionUser();
  const brandKits = user ? await listBrandKits(user.id) : [];
  const contactBooks = user ? await listContactBooks(user.id) : [];
  const brandKitById = new Map(brandKits.map((kit) => [kit.id, kit]));

  const hydratedTemplates = await Promise.all(
    templatesResponse.data.map(async (item) => {
      const details = await getSesTemplate(item.name ?? "");
      const localDraft = await getLocalDraftBySesName(item.name ?? "");
      const basePreviewVariables =
        extractPreviewVariables(localDraft?.designJson ?? undefined) ?? {};
      const brandKitId = extractBrandKitId(localDraft?.designJson ?? undefined);
      const brandKitLogoUrl = brandKitId
        ? brandKitById.get(brandKitId)?.iconUrl
        : undefined;
      const previewVariables = {
        ...basePreviewVariables,
        ...(brandKitLogoUrl
          ? {
              logo: basePreviewVariables.logo ?? brandKitLogoUrl,
              logoUrl: basePreviewVariables.logoUrl ?? brandKitLogoUrl
            }
          : {})
      };

      return {
        name: item.name ?? "",
        subject: details.data?.SubjectPart ?? item.subject ?? "",
        html:
          extractBodyHtml(details.data?.HtmlPart ?? "") ||
          "<div><h1>Hello {{name}}</h1><p>Welcome to {{company}}</p></div>",
        text: details.data?.TextPart ?? "Hello {{name}}, welcome to {{company}}.",
        previewVariables
      };
    })
  );

  return (
    <section className="space-y-4">
      <header className="panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Campaigns</p>
        <h1 className="mt-1 text-2xl font-semibold">Send Campaigns</h1>
      </header>
      <div className="panel rounded-2xl p-4">
        <SendCampaignForm contactBooks={contactBooks} templates={hydratedTemplates} />
      </div>
    </section>
  );
}
