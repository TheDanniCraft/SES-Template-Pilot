"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Switch,
  Tab,
  Tabs,
  Textarea
} from "@heroui/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Brush,
  Moon,
  RefreshCcw,
  Save,
  Sun,
  Trash2,
  UploadCloud
} from "lucide-react";
import {
  deleteTemplateAction,
  resetTemplateDraftFromSesAction,
  saveTemplateDraftAction,
  syncTemplateToSesAction
} from "@/lib/actions/templates";
import {
  type BrandKit,
  getBrandKitById
} from "@/lib/brand-kits";
import { toTableEmailHtml } from "@/lib/html-utils";
import { htmlToPlainText } from "@/lib/plain-text";
import { renderTemplateVariables } from "@/lib/preview";
import { normalizeDesignJson } from "@/lib/ses-template-json";
import {
  templateDraftSchema,
  type TemplateDraftInput
} from "@/lib/validators";
import { GrapesEditor } from "@/components/grapes-editor";
import { HtmlPreviewFrame } from "@/components/html-preview-frame";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";

type TemplateEditorFormProps = {
  initialValues: TemplateDraftInput;
  brandKits: BrandKit[];
};

const DEFAULT_PREVIEW_VARIABLES = {
  name: "Alex",
  company: "Acme Labs"
};

function extractTemplateVariableKeys(...sources: Array<string | undefined>) {
  const keys = new Set<string>();
  const pattern = /{{\s*([^{}\s]+)\s*}}/g;

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const match of source.matchAll(pattern)) {
      const key = (match[1] ?? "").trim();
      if (key) {
        keys.add(key);
      }
    }
  }

  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export function TemplateEditorForm({
  initialValues,
  brandKits
}: TemplateEditorFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [editorMode, setEditorMode] = useState<"html" | "text">("html");
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [htmlEditMode, setHtmlEditMode] = useState<"builder" | "raw">("builder");
  const [editorTheme, setEditorTheme] = useState<"dark" | "light">("dark");
  const [autoPlainText, setAutoPlainText] = useState(true);

  const form = useForm<TemplateDraftInput>({
    resolver: zodResolver(templateDraftSchema),
    defaultValues: {
      ...initialValues,
      previewVariables: initialValues.previewVariables ?? DEFAULT_PREVIEW_VARIABLES
    }
  });

  const values = useWatch({
    control: form.control
  });
  const previewVariables = useMemo(() => {
    const source = values.previewVariables ?? {};
    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, String(value)])
    );
  }, [values.previewVariables]);
  const detectedVariableKeys = useMemo(
    () =>
      extractTemplateVariableKeys(
        values.subject,
        values.htmlContent,
        values.textContent
      ),
    [values.subject, values.htmlContent, values.textContent]
  );
  const templateVariableKeys = detectedVariableKeys;
  const selectedBrandKit = useMemo(
    () => getBrandKitById(brandKits, values.brandKitId),
    [brandKits, values.brandKitId]
  );

  useEffect(() => {
    const allowed = new Set(detectedVariableKeys);
    const entries = Object.entries(previewVariables);
    const filtered = Object.fromEntries(
      entries.filter(([key]) => allowed.has(key))
    );

    if (
      entries.length !== Object.keys(filtered).length ||
      entries.some(([key, value]) => filtered[key] !== value)
    ) {
      form.setValue("previewVariables", filtered, { shouldDirty: true });
    }
  }, [detectedVariableKeys, form, previewVariables]);

  const setPreviewVariable = (key: string, value: string) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return;
    }
    form.setValue(
      "previewVariables",
      {
        ...previewVariables,
        [trimmedKey]: value
      },
      { shouldDirty: true }
    );
  };

  const removePreviewVariable = (key: string) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return;
    }

    const next = { ...previewVariables };
    delete next[trimmedKey];
    form.setValue("previewVariables", next, { shouldDirty: true });
  };

  useEffect(() => {
    if (!autoPlainText) {
      return;
    }

    const generated = htmlToPlainText(values.htmlContent ?? "");
    if (generated !== (values.textContent ?? "")) {
      form.setValue("textContent", generated, { shouldDirty: true });
    }
  }, [autoPlainText, form, values.htmlContent, values.textContent]);

  const previewHtml = useMemo(() => {
    return renderTemplateVariables(values.htmlContent ?? "", previewVariables);
  }, [previewVariables, values.htmlContent]);

  const previewText = useMemo(() => {
    return renderTemplateVariables(values.textContent ?? "", previewVariables);
  }, [previewVariables, values.textContent]);

  const derivedDesignJson = useMemo(() => {
    return normalizeDesignJson(values.designJson, {
      sesTemplateName: values.sesTemplateName ?? "",
      subject: values.subject ?? "",
      htmlContent: values.htmlContent ?? "",
      textContent: values.textContent ?? ""
    });
  }, [
    values.designJson,
    values.sesTemplateName,
    values.subject,
    values.htmlContent,
    values.textContent
  ]);

  const normalizedName = (values.name ?? "").trim();
  const normalizedSesTemplateName = (values.sesTemplateName ?? "").trim();
  const normalizedSubject = (values.subject ?? "").trim();
  const normalizedHtml = (values.htmlContent ?? "").trim();
  const normalizedText = (values.textContent ?? "").trim();

  const canSaveLocal =
    normalizedName.length >= 2 &&
    normalizedSesTemplateName.length >= 2 &&
    normalizedSubject.length >= 2 &&
    normalizedHtml.length >= 2 &&
    normalizedText.length >= 2;

  const canSyncSes =
    normalizedSesTemplateName.length >= 2 &&
    normalizedSubject.length >= 2 &&
    normalizedHtml.length >= 2 &&
    normalizedText.length >= 2;

  const onSaveLocal = useCallback(() => {
    if (!canSaveLocal) {
      toast.error("Required fields are missing");
      return;
    }

    const currentDraftId = form.getValues("id");

    startTransition(async () => {
      const result = await saveTemplateDraftAction(form.getValues());
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Draft saved");

      if (!currentDraftId && result.draftId) {
        // New draft: use a single route replacement to avoid push+refresh loops.
        form.setValue("id", result.draftId, { shouldDirty: false });
        router.replace(`/app/templates/${result.draftId}`);
        return;
      }

      router.refresh();
    });
  }, [canSaveLocal, form, router, startTransition]);

  useSaveShortcut(onSaveLocal, !isPending);

  const onSyncSes = () => {
    if (!canSyncSes) {
      toast.error("Required fields are missing");
      return;
    }

    startTransition(async () => {
      const result = await syncTemplateToSesAction({
        sesTemplateName: form.getValues("sesTemplateName"),
        subject: form.getValues("subject"),
        htmlContent: form.getValues("htmlContent"),
        textContent: form.getValues("textContent")
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Template synced to SES");
      router.refresh();
    });
  };

  const onApplyBrandKit = () => {
    const selected = getBrandKitById(brandKits, form.getValues("brandKitId"));
    if (!selected) {
      toast.error("Select a brand kit first");
      return;
    }
    toast.success(
      `${selected.name} defaults are active for new builder blocks. Existing content was not changed.`
    );
  };

  const onResetFromSes = () => {
    const sesTemplateName = form.getValues("sesTemplateName")?.trim();
    if (!sesTemplateName) {
      toast.error("SES template name is required to reset");
      return;
    }

    const confirmed = window.confirm(
      `Reset this draft from SES template "${sesTemplateName}"? Unsaved changes will be overwritten.`
    );
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await resetTemplateDraftFromSesAction({
        draftId: form.getValues("id"),
        sesTemplateName
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (result.template) {
        form.reset(result.template);
      }

      toast.success("Draft reset from SES");
      const targetPath = result.draftId
        ? `/app/templates/${result.draftId}`
        : `/app/templates/${sesTemplateName}`;
      if (pathname === targetPath) {
        router.refresh();
        return;
      }
      router.replace(targetPath);
    });
  };

  const onDeleteTemplate = () => {
    const sesTemplateName = form.getValues("sesTemplateName")?.trim();
    const draftId = form.getValues("id");
    if (!sesTemplateName && !draftId) {
      toast.error("Template name is required to delete");
      return;
    }

    const target = sesTemplateName || draftId || "this template";
    const confirmed = window.confirm(
      `Delete "${target}" from SES and local drafts? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteTemplateAction({
        draftId,
        sesTemplateName
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Template deleted");
      router.replace("/app/templates");
    });
  };

  return (
    <form
      className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,1fr)]"
      onSubmit={(event) => event.preventDefault()}
    >
      <Card className="panel">
        <CardHeader className="flex flex-col gap-3">
          <div className="grid w-full gap-3 md:grid-cols-2">
            <Input
              {...form.register("name")}
              label="Draft Name"
              placeholder="Welcome campaign"
            />
            <Input
              {...form.register("sesTemplateName")}
              label="SES Template Name"
              placeholder="welcome_campaign"
            />
          </div>
          <Input
            {...form.register("subject")}
            label="Subject"
            placeholder="Welcome {{name}} to {{company}}"
          />
          <div className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Controller
              control={form.control}
              name="brandKitId"
              render={({ field }) => (
                <Select
                  label="Brand Kit"
                  placeholder="Select a brand kit"
                  selectedKeys={field.value ? new Set([field.value]) : new Set()}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0];
                    field.onChange(selected ? String(selected) : undefined);
                  }}
                >
                  {brandKits.map((kit) => (
                    <SelectItem key={kit.id}>{kit.name}</SelectItem>
                  ))}
                </Select>
              )}
            />
            <Button
              className="h-14 md:self-end"
              startContent={<Brush className="h-4 w-4" />}
              type="button"
              variant="flat"
              onPress={onApplyBrandKit}
            >
              Use Kit Defaults
            </Button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              color={editorTheme === "dark" ? "primary" : "default"}
              onPress={() => setEditorTheme("dark")}
              size="sm"
              startContent={<Moon className="h-3.5 w-3.5" />}
              type="button"
              variant="flat"
            >
              Dark Editor
            </Button>
            <Button
              color={editorTheme === "light" ? "primary" : "default"}
              onPress={() => setEditorTheme("light")}
              size="sm"
              startContent={<Sun className="h-3.5 w-3.5" />}
              type="button"
              variant="flat"
            >
              Light Editor
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <Tabs
            aria-label="Editor mode"
            selectedKey={editorMode}
            onSelectionChange={(key) => setEditorMode(key as "html" | "text")}
          >
            <Tab key="html" title="HTML Editor">
              <Tabs
                aria-label="HTML edit mode"
                selectedKey={htmlEditMode}
                onSelectionChange={(key) =>
                  setHtmlEditMode(key as "builder" | "raw")
                }
              >
                <Tab key="builder" title="Builder">
                  <GrapesEditor
                    brandKit={selectedBrandKit}
                    onChange={(html) =>
                      form.setValue("htmlContent", toTableEmailHtml(html), {
                        shouldDirty: true
                      })
                    }
                    theme={editorTheme}
                    value={values.htmlContent ?? ""}
                  />
                </Tab>
                <Tab key="raw" title="Raw HTML">
                  <Textarea
                    {...form.register("htmlContent")}
                    classNames={{
                      input: "font-mono text-sm"
                    }}
                    description="Source editor. You can paste full HTML here."
                    label="Raw HTML"
                    minRows={18}
                  />
                </Tab>
              </Tabs>
            </Tab>
            <Tab key="text" title="Plain Text">
              <div className="space-y-3">
                <Switch
                  isSelected={autoPlainText}
                  onValueChange={setAutoPlainText}
                >
                  Auto-generate from HTML
                </Switch>
                <Textarea
                  {...form.register("textContent")}
                  description={
                    autoPlainText
                      ? "Auto mode is on. Plain text is generated from HTML."
                      : "Manual mode. Edit plain text directly."
                  }
                  isReadOnly={autoPlainText}
                  label="Plain text body"
                  minRows={14}
                />
              </div>
            </Tab>
          </Tabs>

          <Textarea
            description="Generated from SES template fields."
            isReadOnly
            label="SES Template JSON"
            minRows={6}
            placeholder='{"TemplateName":"MyTemplate","TemplateContent":{"Subject":"Greetings, {{name}}!","Text":"Dear {{name}}, your favorite animal is {{favoriteanimal}}.","Html":"<h1>Hello {{name}}</h1><p>Your favorite animal is {{favoriteanimal}}.</p>"}}'
            value={
              derivedDesignJson
                ? JSON.stringify(derivedDesignJson, null, 2)
                : ""
            }
          />

          <div className="flex flex-wrap gap-3">
            <Button
              className="w-full sm:w-auto"
              color="primary"
              isDisabled={!canSaveLocal}
              isLoading={isPending}
              onPress={onSaveLocal}
              startContent={<Save className="h-4 w-4" />}
              type="button"
              variant="solid"
            >
              Save Locally
            </Button>
            <Button
              className="w-full sm:w-auto"
              color="success"
              isDisabled={!canSyncSes}
              isLoading={isPending}
              onPress={onSyncSes}
              startContent={<UploadCloud className="h-4 w-4" />}
              type="button"
              variant="flat"
            >
              Sync to SES
            </Button>
            <Button
              className="w-full sm:w-auto"
              isDisabled={!values.sesTemplateName}
              isLoading={isPending}
              onPress={onResetFromSes}
              startContent={<RefreshCcw className="h-4 w-4" />}
              type="button"
              variant="flat"
            >
              Reset to SES
            </Button>
            <Button
              className="w-full sm:w-auto"
              color="danger"
              isDisabled={!values.sesTemplateName && !values.id}
              isLoading={isPending}
              onPress={onDeleteTemplate}
              startContent={<Trash2 className="h-4 w-4" />}
              type="button"
              variant="flat"
            >
              Delete Template
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="panel">
        <CardHeader className="flex items-center justify-between gap-3">
          <p className="font-semibold">Live Preview</p>
          <p className="text-xs text-slate-400">Surface: {editorTheme}</p>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="rounded-xl border border-white/15 bg-black/25 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-100">Template Variables</p>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">
                {detectedVariableKeys.length} detected
              </p>
            </div>

            {templateVariableKeys.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {templateVariableKeys.map((key) => (
                  <Input
                    key={key}
                    classNames={{
                      input: "text-sm",
                      label: "text-[11px]"
                    }}
                    isClearable
                    label={`{{${key}}}`}
                    size="sm"
                    value={previewVariables[key] ?? ""}
                    onClear={() => removePreviewVariable(key)}
                    onValueChange={(value) => setPreviewVariable(key, value)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No template vars found yet. Add one below or type placeholders like{" "}
                <code>{"{{name}}"}</code> in subject/body.
              </p>
            )}

          </div>

          <Tabs
            aria-label="Preview mode"
            selectedKey={previewMode}
            onSelectionChange={(key) => setPreviewMode(key as "html" | "text")}
          >
            <Tab key="html" title="HTML Preview">
              <HtmlPreviewFrame
                className={`min-h-[360px] w-full rounded-xl ${
                  editorTheme === "dark"
                    ? "border border-white/15 bg-slate-950"
                    : "border border-slate-300 bg-white"
                }`}
                html={previewHtml}
                theme={editorTheme}
              />
            </Tab>
            <Tab key="text" title="Text Preview">
              <pre
                className={`min-h-[340px] whitespace-pre-wrap rounded-xl p-4 text-sm ${
                  editorTheme === "dark"
                    ? "border border-white/15 bg-slate-950/70 text-slate-200"
                    : "border border-slate-300 bg-slate-50 text-slate-700"
                }`}
              >
                {previewText}
              </pre>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </form>
  );
}
