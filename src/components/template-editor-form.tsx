"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
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
import { htmlToPlainText } from "@/lib/plain-text";
import { renderTemplateVariables } from "@/lib/preview";
import { normalizeDesignJson } from "@/lib/ses-template-json";
import {
  templateDraftSchema,
  type TemplateDraftInput
} from "@/lib/validators";
import { renderEditorJsonToHtml } from "@/lib/maily-render";
import { MailyEditor, type MailyEditorHandle } from "@/components/maily-editor";
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
const NO_BRAND_KIT_KEY = "__none__";

function toEditorJson(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  return input as Record<string, unknown>;
}

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

function applyBrandKitToExistingNodes(
  node: Record<string, unknown>,
  brandKit: BrandKit
): Record<string, unknown> {
  const nextNode: Record<string, unknown> = { ...node };
  const type = typeof node.type === "string" ? node.type : "";
  const attrs =
    node.attrs && typeof node.attrs === "object" && !Array.isArray(node.attrs)
      ? { ...(node.attrs as Record<string, unknown>) }
      : undefined;

  if (attrs) {
    if (type === "button") {
      attrs.buttonColor = brandKit.colors.accent;
      attrs.textColor = brandKit.colors.buttonText;
    }

    if (type === "section") {
      attrs.backgroundColor = brandKit.colors.surface;
      attrs.borderColor = brandKit.colors.border;
    }

    if (type === "logo") {
      attrs.src = brandKit.iconUrl;
      attrs.alt = `${brandKit.name} logo`;
    }

    nextNode.attrs = attrs;
  }

  if (Array.isArray(node.content)) {
    nextNode.content = (node.content as Array<Record<string, unknown>>).map((child) =>
      applyBrandKitToExistingNodes(child, brandKit)
    );
  }

  return nextNode;
}

function resetBrandKitNodesToMailyDefaults(
  node: Record<string, unknown>
): Record<string, unknown> {
  const nextNode: Record<string, unknown> = { ...node };
  const type = typeof node.type === "string" ? node.type : "";
  const attrs =
    node.attrs && typeof node.attrs === "object" && !Array.isArray(node.attrs)
      ? { ...(node.attrs as Record<string, unknown>) }
      : undefined;

  if (attrs) {
    if (type === "button") {
      delete attrs.buttonColor;
      delete attrs.textColor;
    }

    if (type === "section") {
      delete attrs.backgroundColor;
      delete attrs.borderColor;
    }

    if (type === "logo") {
      delete attrs.src;
      delete attrs.alt;
    }

    nextNode.attrs = attrs;
  }

  if (Array.isArray(node.content)) {
    nextNode.content = (node.content as Array<Record<string, unknown>>).map((child) =>
      resetBrandKitNodesToMailyDefaults(child)
    );
  }

  return nextNode;
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
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [autoPlainText, setAutoPlainText] = useState(true);
  const [editorRefreshToken, setEditorRefreshToken] = useState(0);
  const [appliedBrandKitId, setAppliedBrandKitId] = useState<string | undefined>(
    initialValues.brandKitId
  );
  const [builderSeed, setBuilderSeed] = useState(() => ({
    html: initialValues.htmlContent ?? "",
    contentJson: toEditorJson(initialValues.editorJson)
  }));
  const [liveBuilderHtml, setLiveBuilderHtml] = useState(builderSeed.html);
  const mailyEditorRef = useRef<MailyEditorHandle | null>(null);

  const form = useForm<TemplateDraftInput>({
    resolver: zodResolver(templateDraftSchema),
    defaultValues: {
      ...initialValues,
      brandKitId: initialValues.brandKitId ?? "",
      previewVariables: initialValues.previewVariables ?? DEFAULT_PREVIEW_VARIABLES
    }
  });

  // Keep non-visible editor fields registered (tabs unmount inactive panels).
  useEffect(() => {
    form.register("htmlContent");
    form.register("textContent");
    form.register("editorJson");
    form.register("designJson");
  }, [form]);

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
    () => getBrandKitById(brandKits, appliedBrandKitId),
    [appliedBrandKitId, brandKits]
  );
  const brandKitOptions = useMemo(
    () => [
      { id: NO_BRAND_KIT_KEY, name: "No Brand Kit" },
      ...brandKits.map((kit) => ({ id: kit.id, name: kit.name }))
    ],
    [brandKits]
  );
  const selectedBrandKitId = (values.brandKitId ?? "").trim() || undefined;
  const hasUnappliedBrandKitSelection = selectedBrandKitId !== appliedBrandKitId;

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

  const previewSourceHtml =
    htmlEditMode === "builder" ? liveBuilderHtml : (values.htmlContent ?? "");
  const previewHtml = useMemo(() => {
    return renderTemplateVariables(previewSourceHtml, previewVariables);
  }, [previewSourceHtml, previewVariables]);

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

  const flushBuilderSnapshot = useCallback(async () => {
    const snapshot = await mailyEditorRef.current?.flush();
    if (!snapshot) {
      return null;
    }

    setLiveBuilderHtml(snapshot.html);
    form.setValue("htmlContent", snapshot.html, { shouldDirty: true });
    form.setValue("editorJson", snapshot.contentJson, { shouldDirty: true });
    return snapshot;
  }, [form]);

  const setHtmlEditModeWithSync = useCallback(
    (nextMode: "builder" | "raw") => {
      void (async () => {
        if (nextMode === "raw") {
          await flushBuilderSnapshot();
          setHtmlEditMode("raw");
          return;
        }

        const nextHtml = form.getValues("htmlContent") ?? "";
        setBuilderSeed({
          html: nextHtml,
          contentJson: toEditorJson(form.getValues("editorJson"))
        });
        setLiveBuilderHtml(nextHtml);
        setEditorRefreshToken((current) => current + 1);
        setHtmlEditMode("builder");
      })();
    },
    [flushBuilderSnapshot, form]
  );

  const onSaveLocal = useCallback(() => {
    if (!canSaveLocal) {
      toast.error("Required fields are missing");
      return;
    }

    const currentDraftId = form.getValues("id");

    startTransition(async () => {
      const payload = form.getValues();
      if (htmlEditMode === "builder") {
        const snapshot = await flushBuilderSnapshot();
        if (!snapshot) {
          toast.error("Failed to compile template HTML. Please try again.");
          return;
        }
        payload.htmlContent = snapshot.html;
        payload.editorJson = snapshot.contentJson;
      }

      const result = await saveTemplateDraftAction(payload);
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
  }, [canSaveLocal, flushBuilderSnapshot, form, htmlEditMode, router, startTransition]);

  useSaveShortcut(onSaveLocal, !isPending);

  const onSyncSes = () => {
    if (!canSyncSes) {
      toast.error("Required fields are missing");
      return;
    }

    startTransition(async () => {
      const payload = form.getValues();
      if (htmlEditMode === "builder") {
        const snapshot = await flushBuilderSnapshot();
        if (!snapshot) {
          toast.error("Failed to compile template HTML. Please try again.");
          return;
        }
        payload.htmlContent = snapshot.html;
        payload.editorJson = snapshot.contentJson;
      }

      const result = await syncTemplateToSesAction({
        sesTemplateName: payload.sesTemplateName,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Template synced to SES");

      // Keep local draft in sync with latest builder snapshot after SES sync.
      await saveTemplateDraftAction(payload);
      router.refresh();
    });
  };

  const onApplyBrandKit = () => {
    void (async () => {
      if (htmlEditMode === "builder") {
        await flushBuilderSnapshot();
      }

      const selectedId = (form.getValues("brandKitId") ?? "").trim() || undefined;
      const selected = getBrandKitById(brandKits, selectedId);
      const currentJson = toEditorJson(form.getValues("editorJson"));
      const nextJson = currentJson
        ? selected
          ? applyBrandKitToExistingNodes(currentJson, selected)
          : resetBrandKitNodesToMailyDefaults(currentJson)
        : currentJson;

      form.setValue("editorJson", nextJson, { shouldDirty: true });

      const fallbackHtml = form.getValues("htmlContent") ?? "";
      const nextHtml =
        nextJson && Object.keys(nextJson).length > 0
          ? await renderEditorJsonToHtml(nextJson, selected)
          : fallbackHtml;
      form.setValue("htmlContent", nextHtml, { shouldDirty: true });
      setBuilderSeed({
        html: nextHtml,
        contentJson: nextJson
      });
      setLiveBuilderHtml(nextHtml);
      setAppliedBrandKitId(selectedId);
      setEditorRefreshToken((current) => current + 1);
      toast.success(
        selected
          ? `${selected.name} applied to existing content and new blocks.`
          : "Brand kit removed. Original default styling restored."
      );
    })();
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
        const resetBrandKitId = (result.template.brandKitId ?? "").trim();
        form.setValue("brandKitId", resetBrandKitId, { shouldDirty: false });
        setAppliedBrandKitId(resetBrandKitId || undefined);
        const nextSeed = {
          html: result.template.htmlContent ?? "",
          contentJson: toEditorJson(result.template.editorJson)
        };
        setBuilderSeed(nextSeed);
        setLiveBuilderHtml(nextSeed.html);
        setEditorRefreshToken((current) => current + 1);
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
    <div
      className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,1fr)]"
      role="group"
      aria-label="Template editor form"
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
                  selectionMode="single"
                  selectedKeys={
                    new Set([
                      (field.value ?? "").trim() || NO_BRAND_KIT_KEY
                    ])
                  }
                  onSelectionChange={(keys) => {
                    const selectedKey =
                      keys === "all" ? undefined : Array.from(keys)[0];
                    const selectedValue = selectedKey
                      ? String(selectedKey)
                      : NO_BRAND_KIT_KEY;
                    field.onChange(
                      selectedValue === NO_BRAND_KIT_KEY
                        ? ""
                        : selectedValue
                    );
                  }}
                >
                  {brandKitOptions.map((option) => (
                    <SelectItem key={option.id}>{option.name}</SelectItem>
                  ))}
                </Select>
              )}
            />
            <Button
              className="h-14 md:self-end"
              isDisabled={!hasUnappliedBrandKitSelection}
              startContent={<Brush className="h-4 w-4" />}
              type="button"
              variant="flat"
              onPress={onApplyBrandKit}
            >
              Use Kit Defaults
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    color={htmlEditMode === "builder" ? "primary" : "default"}
                    type="button"
                    variant="flat"
                    onPress={() => setHtmlEditModeWithSync("builder")}
                  >
                    Builder
                  </Button>
                  <Button
                    color={htmlEditMode === "raw" ? "primary" : "default"}
                    type="button"
                    variant="flat"
                    onPress={() => setHtmlEditModeWithSync("raw")}
                  >
                    Raw HTML
                  </Button>
                </div>
                <div
                  aria-hidden={htmlEditMode !== "builder"}
                  className={htmlEditMode === "builder" ? "block" : "hidden"}
                >
                  <MailyEditor
                    ref={mailyEditorRef}
                    contentJson={builderSeed.contentJson}
                    brandKit={selectedBrandKit}
                    refreshToken={editorRefreshToken}
                    surfaceTheme="light"
                    onChange={({ html, contentJson }) => {
                      setLiveBuilderHtml(html);
                      form.setValue("editorJson", contentJson, { shouldDirty: true });
                      form.setValue("htmlContent", html, {
                        shouldDirty: true
                      });
                    }}
                    value={builderSeed.html}
                  />
                </div>
                <div
                  aria-hidden={htmlEditMode !== "raw"}
                  className={htmlEditMode === "raw" ? "block" : "hidden"}
                >
                  <Textarea
                    {...form.register("htmlContent")}
                    classNames={{
                      input: "font-mono text-sm"
                    }}
                    description="Source editor. You can paste full HTML here."
                    label="Raw HTML"
                    minRows={18}
                  />
                </div>
              </div>
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

      <Card className="panel min-w-0">
        <CardHeader className="flex items-center justify-between gap-3">
          <p className="font-semibold">Live Preview</p>
          <p className="text-xs text-slate-400">Mode: {previewTheme}</p>
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

          <div className="space-y-2">
            <Tabs
              className="w-full"
              fullWidth
              aria-label="Preview mode"
              selectedKey={previewMode}
              onSelectionChange={(key) => setPreviewMode(key as "html" | "text")}
            >
              <Tab key="html" title="HTML Preview" />
              <Tab key="text" title="Text Preview" />
            </Tabs>
            <div className="grid w-full gap-2 sm:grid-cols-2">
              <Button
                className="w-full"
                color={previewTheme === "dark" ? "primary" : "default"}
                onPress={() => setPreviewTheme("dark")}
                size="sm"
                startContent={<Moon className="h-3.5 w-3.5" />}
                type="button"
                variant="flat"
              >
                Dark Preview
              </Button>
              <Button
                className="w-full"
                color={previewTheme === "light" ? "primary" : "default"}
                onPress={() => setPreviewTheme("light")}
                size="sm"
                startContent={<Sun className="h-3.5 w-3.5" />}
                type="button"
                variant="flat"
              >
                Light Preview
              </Button>
            </div>
          </div>

          {previewMode === "html" ? (
            <HtmlPreviewFrame
              className={`min-h-[360px] w-full rounded-xl ${
                previewTheme === "dark"
                  ? "border border-white/15 bg-slate-950"
                  : "border border-slate-300 bg-white"
              } min-w-0`}
              html={previewHtml}
              theme={previewTheme}
            />
          ) : (
            <pre
              className={`min-h-[340px] whitespace-pre-wrap rounded-xl p-4 text-sm ${
                previewTheme === "dark"
                  ? "border border-white/15 bg-slate-950/70 text-slate-200"
                  : "border border-slate-300 bg-slate-50 text-slate-700"
              }`}
            >
              {previewText}
            </pre>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
