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
  AlertTriangle,
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
  getBrandKitColorSchemeCss,
  getBrandKitById
} from "@/lib/brand-kits";
import { htmlToPlainText } from "@/lib/plain-text";
import { renderTemplateVariables } from "@/lib/preview";
import { normalizeDesignJson } from "@/lib/ses-template-json";
import {
  mergeBodyIntoHtmlDocument,
  parseHtmlDocumentShell,
  type HtmlDocumentShell
} from "@/lib/html-utils";
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

function hasEditorJson(input: unknown) {
  const json = toEditorJson(input);
  return Boolean(json && Object.keys(json).length > 0);
}

function isFullHtmlDocument(input: string | undefined) {
  const value = (input ?? "").trim();
  return /<!doctype\s+html/i.test(value) || /<html[\s>]/i.test(value) || /<head[\s>]/i.test(value);
}

function shouldLockBuilderMode(editorJson: unknown, html: string | undefined) {
  return !hasEditorJson(editorJson) && isFullHtmlDocument(html);
}

const COLOR_BRIDGE_STYLE_ID = "ses-brand-kit-color-bridge";

function stripColorBridgeVars(input: string) {
  return (input || "").replace(
    /var\(\s*--ses-[a-z0-9-]+\s*,\s*([^)]+)\)/gi,
    "$1"
  );
}

function injectColorBridgeStyle(
  documentHtml: string,
  brandKit: BrandKit | null | undefined
) {
  if (!documentHtml) {
    return documentHtml;
  }

  const css = getBrandKitColorSchemeCss(brandKit);
  const existingPattern = new RegExp(
    `<style[^>]*id=["']${COLOR_BRIDGE_STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>`,
    "i"
  );
  if (!css.trim()) {
    return documentHtml
      .replace(existingPattern, "")
      .replace(
        /<style[^>]*id=["']ses-editor-color-bridge["'][^>]*>[\s\S]*?<\/style>/i,
        ""
      );
  }

  const styleTag = `<style id="${COLOR_BRIDGE_STYLE_ID}">${css}</style>`;
  if (existingPattern.test(documentHtml)) {
    return documentHtml.replace(
      existingPattern,
      styleTag
    );
  }

  if (/id=["']ses-editor-color-bridge["']/i.test(documentHtml)) {
    return documentHtml.replace(
      /<style[^>]*id=["']ses-editor-color-bridge["'][^>]*>[\s\S]*?<\/style>/i,
      styleTag
    );
  }

  if (/<\/head>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/head>/i, `${styleTag}</head>`);
  }

  return documentHtml;
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
  const initialBrandKitId = (initialValues.brandKitId ?? "").trim();
  const initialDocumentShell = parseHtmlDocumentShell(initialValues.htmlContent ?? "");
  const initialBuilderLocked = shouldLockBuilderMode(
    initialValues.editorJson,
    initialValues.htmlContent
  );
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [editorMode, setEditorMode] = useState<"html" | "text">("html");
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [htmlEditMode, setHtmlEditMode] = useState<"builder" | "raw">(() =>
    initialBuilderLocked
      ? "raw"
      : "builder"
  );
  const [builderUnlocked, setBuilderUnlocked] = useState(!initialBuilderLocked);
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [autoPlainText, setAutoPlainText] = useState(true);
  const [editorRefreshToken, setEditorRefreshToken] = useState(0);
  const [appliedBrandKitId, setAppliedBrandKitId] = useState<string | undefined>(
    initialBrandKitId || undefined
  );
  const [pendingBuilderBootstrap, setPendingBuilderBootstrap] = useState(false);
  const [builderSeed, setBuilderSeed] = useState(() => ({
    html: initialDocumentShell?.body ?? (initialValues.htmlContent ?? ""),
    contentJson: toEditorJson(initialValues.editorJson)
  }));
  const [liveBuilderHtml, setLiveBuilderHtml] = useState(initialValues.htmlContent ?? "");
  const mailyEditorRef = useRef<MailyEditorHandle | null>(null);
  const preservedDocumentShellRef = useRef<HtmlDocumentShell | null>(
    initialDocumentShell
  );

  const form = useForm<TemplateDraftInput>({
    resolver: zodResolver(templateDraftSchema),
    defaultValues: {
      ...initialValues,
      brandKitId: initialBrandKitId,
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
  const isBuilderLocked = initialBuilderLocked && !builderUnlocked;
  const shouldPersistEditorJson = !initialBuilderLocked || builderUnlocked;

  useEffect(() => {
    if (selectedBrandKit) {
      return;
    }

    const currentHtml = form.getValues("htmlContent") ?? "";
    const cleanedHtml = injectColorBridgeStyle(
      stripColorBridgeVars(currentHtml),
      null
    );
    if (cleanedHtml === currentHtml) {
      return;
    }

    form.setValue("htmlContent", cleanedHtml, { shouldDirty: false });
    setLiveBuilderHtml(cleanedHtml);
    const parsed = parseHtmlDocumentShell(cleanedHtml);
    if (parsed) {
      preservedDocumentShellRef.current = parsed;
      setBuilderSeed((current) => ({
        ...current,
        html: parsed.body
      }));
    }
  }, [form, selectedBrandKit]);

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

  useEffect(() => {
    if (htmlEditMode !== "raw") {
      return;
    }

    const parsed = parseHtmlDocumentShell(values.htmlContent ?? "");
    if (parsed) {
      preservedDocumentShellRef.current = parsed;
    }
  }, [htmlEditMode, values.htmlContent]);

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

  const mergeWithPreservedDocumentShell = useCallback(
    (nextHtml: string, brandKitOverride?: BrandKit | null) => {
      const activeBrandKit =
        brandKitOverride === undefined ? selectedBrandKit : brandKitOverride;
      const nextDocument = activeBrandKit ? nextHtml : stripColorBridgeVars(nextHtml);
      const parsedNextDocument = parseHtmlDocumentShell(nextDocument);
      if (parsedNextDocument) {
        return injectColorBridgeStyle(nextDocument, activeBrandKit);
      }

      const shell = preservedDocumentShellRef.current;
      if (!shell) {
        return injectColorBridgeStyle(nextDocument, activeBrandKit);
      }

      const nextBody = nextDocument;
      const merged = mergeBodyIntoHtmlDocument(nextBody, shell);
      return injectColorBridgeStyle(merged, activeBrandKit);
    },
    [selectedBrandKit]
  );

  const toBuilderEditableHtml = useCallback((nextHtml: string) => {
    const parsed = parseHtmlDocumentShell(nextHtml);
    if (parsed) {
      preservedDocumentShellRef.current = parsed;
      return parsed.body;
    }
    return nextHtml;
  }, []);

  const flushBuilderSnapshot = useCallback(async () => {
    const snapshot = await mailyEditorRef.current?.flush();
    if (!snapshot) {
      return null;
    }

    const mergedHtml = mergeWithPreservedDocumentShell(snapshot.html);
    setLiveBuilderHtml(mergedHtml);
    form.setValue("htmlContent", mergedHtml, { shouldDirty: true });
    form.setValue("editorJson", snapshot.contentJson, { shouldDirty: true });
    return {
      html: mergedHtml,
      contentJson: snapshot.contentJson
    };
  }, [form, mergeWithPreservedDocumentShell]);

  const setHtmlEditModeWithSync = useCallback(
    (nextMode: "builder" | "raw") => {
      void (async () => {
        if (nextMode === "raw") {
          if (hasEditorJson(form.getValues("editorJson"))) {
            await flushBuilderSnapshot();
          }
          setHtmlEditMode("raw");
          return;
        }

        const nextHtml = form.getValues("htmlContent") ?? "";
        const builderHtml = toBuilderEditableHtml(nextHtml);
        setBuilderSeed({
          html: builderHtml,
          contentJson: toEditorJson(form.getValues("editorJson"))
        });
        setLiveBuilderHtml(mergeWithPreservedDocumentShell(builderHtml));
        setEditorRefreshToken((current) => current + 1);
        setHtmlEditMode("builder");
      })();
    },
    [flushBuilderSnapshot, form, mergeWithPreservedDocumentShell, toBuilderEditableHtml]
  );

  const onSaveLocal = useCallback(() => {
    if (!canSaveLocal) {
      toast.error("Required fields are missing");
      return;
    }

    const currentDraftId = form.getValues("id");

    startTransition(async () => {
      const payload = form.getValues();
      if (!shouldPersistEditorJson) {
        payload.editorJson = undefined;
        form.setValue("editorJson", undefined, { shouldDirty: true });
      }
      if (htmlEditMode === "builder" && hasEditorJson(payload.editorJson)) {
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
      if (!shouldPersistEditorJson) {
        payload.editorJson = undefined;
        form.setValue("editorJson", undefined, { shouldDirty: true });
      }
      if (htmlEditMode === "builder" && hasEditorJson(payload.editorJson)) {
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
      const renderedHtml =
        nextJson && Object.keys(nextJson).length > 0
          ? await renderEditorJsonToHtml(nextJson, selected)
          : fallbackHtml;
      const nextHtml = mergeWithPreservedDocumentShell(renderedHtml, selected);
      form.setValue("htmlContent", nextHtml, { shouldDirty: true });
      setBuilderSeed({
        html: toBuilderEditableHtml(nextHtml),
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
        form.setValue("brandKitId", "", { shouldDirty: false });
        setAppliedBrandKitId(undefined);
        const lockAfterReset = shouldLockBuilderMode(
          result.template.editorJson,
          result.template.htmlContent ?? ""
        );
        setPendingBuilderBootstrap(false);
        setBuilderUnlocked(!lockAfterReset);
        if (lockAfterReset) {
          setEditorMode("html");
          setHtmlEditMode("raw");
        }
        const parsedResetHtml = parseHtmlDocumentShell(result.template.htmlContent ?? "");
        if (parsedResetHtml) {
          preservedDocumentShellRef.current = parsedResetHtml;
        }
        const nextSeed = {
          html: parsedResetHtml?.body ?? (result.template.htmlContent ?? ""),
          contentJson: toEditorJson(result.template.editorJson)
        };
        setBuilderSeed(nextSeed);
        setLiveBuilderHtml(result.template.htmlContent ?? "");
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

  useEffect(() => {
    if (!pendingBuilderBootstrap || htmlEditMode !== "builder") {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const bootstrap = async () => {
      if (cancelled) {
        return;
      }

      if (hasEditorJson(form.getValues("editorJson"))) {
        setPendingBuilderBootstrap(false);
        return;
      }

      const snapshot = await flushBuilderSnapshot();
      if (cancelled) {
        return;
      }
      if (snapshot) {
        setPendingBuilderBootstrap(false);
        return;
      }

      if (attempts >= 8) {
        setPendingBuilderBootstrap(false);
        return;
      }

      attempts += 1;
      setTimeout(() => {
        void bootstrap();
      }, 70);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [flushBuilderSnapshot, form, htmlEditMode, pendingBuilderBootstrap]);

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
            className="w-full"
            fullWidth
            aria-label="Editor mode"
            selectedKey={editorMode === "text" ? "text" : htmlEditMode}
            onSelectionChange={(key) => {
              if (key === "text") {
                setEditorMode("text");
                return;
              }
              if (key === "builder" && isBuilderLocked) {
                setEditorMode("html");
                setHtmlEditMode("raw");
                return;
              }
              setEditorMode("html");
              setHtmlEditModeWithSync(key as "builder" | "raw");
            }}
          >
            <Tab key="builder" isDisabled={isBuilderLocked} title="Builder">
              {isBuilderLocked ? (
                <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Builder is locked for this template. Open it from Raw HTML with "Load Editor Anyway".
                </div>
              ) : (
                <MailyEditor
                  ref={mailyEditorRef}
                  contentJson={builderSeed.contentJson}
                  brandKit={selectedBrandKit}
                  emitInitialSnapshot={initialBuilderLocked && builderUnlocked}
                  refreshToken={editorRefreshToken}
                  surfaceTheme="light"
                  onChange={({ html, contentJson }) => {
                    const mergedHtml = mergeWithPreservedDocumentShell(html);
                    setLiveBuilderHtml(mergedHtml);
                    form.setValue("editorJson", contentJson, { shouldDirty: true });
                    form.setValue("htmlContent", mergedHtml, {
                      shouldDirty: true
                    });
                  }}
                  value={builderSeed.html}
                />
              )}
            </Tab>
            <Tab key="raw" title="Raw HTML">
              <div className="space-y-3">
                {isBuilderLocked ? (
                  <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="flex items-center gap-2 font-semibold">
                          <AlertTriangle className="h-4 w-4" />
                          Builder locked for this template
                        </p>
                        <p className="text-amber-100/85">
                          This template was not created with the Builder. Opening Builder can
                          rewrite layout/CSS. Raw HTML is kept as the safe source.
                        </p>
                      </div>
                      <Button
                        className="h-10 w-full shrink-0 sm:w-auto sm:min-w-[180px]"
                        color="warning"
                        type="button"
                        variant="flat"
                        onPress={() => {
                          setBuilderUnlocked(true);
                          setPendingBuilderBootstrap(true);
                          setEditorMode("html");
                          setHtmlEditModeWithSync("builder");
                        }}
                      >
                        Load Editor Anyway
                      </Button>
                    </div>
                  </div>
                ) : null}
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
