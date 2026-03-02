import { TemplatesTable } from "@/components/templates-table";
import { listSesTemplates } from "@/lib/actions/templates";

export default async function TemplatesPage() {
  const response = await listSesTemplates();
  const templates = response.data;

  return (
    <TemplatesTable
      error={response.error}
      success={response.success}
      templates={templates.map((template) => ({
        name: template.name,
        subject: template.subject,
        createdAt: template.createdAt ?? null
      }))}
    />
  );
}
