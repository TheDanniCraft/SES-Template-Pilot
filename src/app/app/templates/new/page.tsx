import { TemplateEditorForm } from "@/components/template-editor-form";
import { listBrandKits } from "@/lib/brand-kits-store";
import { getServerSessionUser } from "@/lib/server-auth";
import { normalizeDesignJson } from "@/lib/ses-template-json";

export default async function NewTemplatePage() {
  const user = await getServerSessionUser();
  const brandKits = user ? await listBrandKits(user.id) : [];

  return (
    <section className="space-y-4">
      <header className="panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Templates</p>
        <h1 className="mt-1 text-2xl font-semibold">Create New Template</h1>
      </header>
      <div className="panel rounded-2xl p-4">
        <TemplateEditorForm
          brandKits={brandKits}
          initialValues={{
            name: "",
            sesTemplateName: "",
            subject: "",
            htmlContent:
              "<div style='font-family:Arial'><h1>Hello {{name}}</h1><p>Welcome to {{company}}.</p></div>",
            textContent: "Hello {{name}}, welcome to {{company}}.",
            brandKitId: undefined,
            previewVariables: {
              name: "Alex",
              company: "Acme Labs"
            },
            designJson: normalizeDesignJson(undefined, {
              sesTemplateName: "",
              subject: "",
              htmlContent:
                "<div style='font-family:Arial'><h1>Hello {{name}}</h1><p>Welcome to {{company}}.</p></div>",
              textContent: "Hello {{name}}, welcome to {{company}}."
            })
          }}
        />
      </div>
    </section>
  );
}
