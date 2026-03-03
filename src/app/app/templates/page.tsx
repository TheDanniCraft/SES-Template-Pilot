import { TemplatesTable } from "@/components/templates-table";
import { listLocalDrafts, listSesTemplates } from "@/lib/actions/templates";

type TemplateRow = {
  id: string;
  href: string;
  name: string;
  subject: string;
  createdAt: string | null;
  source: "local" | "ses" | "synced";
};

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export default async function TemplatesPage() {
  const [response, localDrafts] = await Promise.all([
    listSesTemplates(),
    listLocalDrafts()
  ]);

  const sesTemplates = response.data;
  const localBySesName = new Map(
    localDrafts
      .filter((draft) => !!draft.sesTemplateName)
      .map((draft) => [draft.sesTemplateName, draft] as const)
  );
  const usedLocalDraftIds = new Set<string>();

  const rows: TemplateRow[] = [];

  for (const template of sesTemplates) {
    const localDraft = localBySesName.get(template.name);
    if (localDraft) {
      usedLocalDraftIds.add(localDraft.id);
      rows.push({
        id: localDraft.id,
        href: `/app/templates/${localDraft.id}`,
        name: localDraft.name || template.name,
        subject: localDraft.subject || template.subject,
        createdAt: toIso(localDraft.updatedAt ?? localDraft.createdAt),
        source: "synced"
      });
      continue;
    }

    rows.push({
      id: `ses:${template.name}`,
      href: `/app/templates/${template.name}`,
      name: template.name,
      subject: template.subject,
      createdAt: toIso(template.createdAt),
      source: "ses"
    });
  }

  for (const draft of localDrafts) {
    if (usedLocalDraftIds.has(draft.id)) {
      continue;
    }

    rows.push({
      id: draft.id,
      href: `/app/templates/${draft.id}`,
      name: draft.name,
      subject: draft.subject,
      createdAt: toIso(draft.updatedAt ?? draft.createdAt),
      source: "local"
    });
  }

  rows.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <TemplatesTable
      error={response.error}
      success={response.success}
      templates={rows}
    />
  );
}
