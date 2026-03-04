"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Tooltip,
  Textarea
} from "@heroui/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Info, MailCheck, Moon, Sun, Upload } from "lucide-react";
import { sendCampaignAction } from "@/lib/actions/campaign";
import type { ContactBook, RecipientVariablesMap } from "@/lib/contact-books";
import {
  isValidContactEmail,
  parseRecipientVariablesMapJson
} from "@/lib/contact-books";
import { campaignSchema, type CampaignInput } from "@/lib/validators";
import { TagsInput } from "@/components/tags-input";
import { renderTemplateVariables } from "@/lib/preview";
import { HtmlPreviewFrame } from "@/components/html-preview-frame";

type TemplateOption = {
  name: string;
  subject: string;
  html: string;
  text: string;
  previewVariables: Record<string, string>;
};

type SendCampaignFormProps = {
  contactBooks: ContactBook[];
  templates: TemplateOption[];
  sourceEmail: string | null;
};

const SEND_FORM_STORAGE_KEY = "ses-ui-send-form-v1";

function firstSelectionKey(selection: unknown) {
  if (selection === null || selection === undefined) {
    return "";
  }

  if (typeof selection === "string" || typeof selection === "number") {
    return String(selection);
  }

  if (selection instanceof Set) {
    const [first] = selection;
    return first === undefined ? "" : String(first);
  }

  if (typeof selection === "object") {
    const candidate = selection as {
      currentKey?: unknown;
      anchorKey?: unknown;
      [Symbol.iterator]?: () => Iterator<unknown>;
    };

    if (candidate.currentKey !== undefined && candidate.currentKey !== null) {
      return String(candidate.currentKey);
    }

    if (candidate.anchorKey !== undefined && candidate.anchorKey !== null) {
      return String(candidate.anchorKey);
    }

    if (typeof candidate[Symbol.iterator] === "function") {
      const [first] = Array.from(selection as Iterable<unknown>);
      return first === undefined ? "" : String(first);
    }
  }

  return "";
}

function syncTemplateDataMapForRecipients(
  recipients: string[],
  currentMap: RecipientVariablesMap,
  defaults: Record<string, string>,
  variableKeys: string[]
) {
  const allowedKeys = new Set(variableKeys);
  const generatedDefaults = Object.fromEntries(
    variableKeys.map((key) => [key, defaults[key] ?? `<${key}>`])
  );

  const nextMap: RecipientVariablesMap = {};
  let changed = Object.keys(currentMap).some(
    (key) => !recipients.includes(key)
  );

  for (const recipient of recipients) {
    const existing = currentMap[recipient] ?? {};
    const filteredExisting = Object.fromEntries(
      Object.entries(existing).filter(([key]) => allowedKeys.has(key))
    );
    const merged = {
      ...generatedDefaults,
      ...filteredExisting
    };

    if (!currentMap[recipient]) {
      changed = true;
      nextMap[recipient] = merged;
      continue;
    }

    const existingKeys = Object.keys(existing);
    if (
      existingKeys.length !== Object.keys(merged).length ||
      Object.keys(merged).some((key) => merged[key] !== existing[key])
    ) {
      changed = true;
      nextMap[recipient] = merged;
      continue;
    }

    nextMap[recipient] = existing;
  }

  return {
    nextMap,
    changed
  };
}

export function SendCampaignForm({
  contactBooks,
  templates,
  sourceEmail
}: SendCampaignFormProps) {
  const [isPending, startTransition] = useTransition();
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [selectedContactBookId, setSelectedContactBookId] = useState("");
  const [hydratedFromStorage, setHydratedFromStorage] = useState(false);

  const form = useForm<CampaignInput>({
    resolver: zodResolver(campaignSchema),
    mode: "onChange",
    defaultValues: {
      recipients: [],
      templateName: templates[0]?.name ?? "",
      templateData: "{}"
    }
  });

  const templateName = useWatch({
    control: form.control,
    name: "templateName"
  });
  const recipients = useWatch({
    control: form.control,
    name: "recipients"
  });
  const templateData = useWatch({
    control: form.control,
    name: "templateData"
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(SEND_FORM_STORAGE_KEY);
      if (!raw) {
        setHydratedFromStorage(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        recipients?: unknown;
        templateName?: unknown;
        templateData?: unknown;
      };

      const storedRecipients = Array.isArray(parsed.recipients)
        ? parsed.recipients
            .map((value) => String(value).trim().toLowerCase())
            .filter((value) => isValidContactEmail(value))
        : [];

      const storedTemplateName = String(parsed.templateName ?? "");
      const templateExists = templates.some((template) => template.name === storedTemplateName);
      const safeTemplateName = templateExists
        ? storedTemplateName
        : templates[0]?.name ?? "";

      const storedTemplateData =
        typeof parsed.templateData === "string" ? parsed.templateData : "{}";
      const storedContactBookId =
        typeof (parsed as { selectedContactBookId?: unknown }).selectedContactBookId === "string"
          ? String((parsed as { selectedContactBookId?: unknown }).selectedContactBookId)
          : "";
      const safeContactBookId = contactBooks.some((book) => book.id === storedContactBookId)
        ? storedContactBookId
        : "";

      form.reset({
        recipients: storedRecipients,
        templateName: safeTemplateName,
        templateData: storedTemplateData
      });
      setSelectedContactBookId(safeContactBookId);
    } catch {
      // Ignore malformed storage and use defaults.
    } finally {
      setHydratedFromStorage(true);
    }
  }, [contactBooks, form, templates]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydratedFromStorage) {
      return;
    }

    window.sessionStorage.setItem(
      SEND_FORM_STORAGE_KEY,
      JSON.stringify({
        recipients,
        templateName,
        templateData,
        selectedContactBookId
      })
    );
  }, [hydratedFromStorage, recipients, selectedContactBookId, templateData, templateName]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateName),
    [templateName, templates]
  );
  const selectedContactBook = useMemo(
    () => contactBooks.find((book) => book.id === selectedContactBookId) ?? null,
    [contactBooks, selectedContactBookId]
  );

  const parsedTemplateMap = useMemo(
    () => parseRecipientVariablesMapJson(templateData),
    [templateData]
  );
  const recipientTemplateMap = parsedTemplateMap.map;
  const activeRecipient = useMemo(() => {
    if (recipients.length === 0) {
      return "";
    }
    if (selectedRecipient && recipients.includes(selectedRecipient)) {
      return selectedRecipient;
    }
    return recipients[0] ?? "";
  }, [recipients, selectedRecipient]);
  const selectedRecipientValues = useMemo(
    () => recipientTemplateMap[activeRecipient] ?? {},
    [activeRecipient, recipientTemplateMap]
  );

  const detectedVariableKeys = useMemo(() => {
    const pattern = /{{\s*([^{}\s]+)\s*}}/g;
    const keys = new Set<string>();
    const sources = [
      selectedTemplate?.subject,
      selectedTemplate?.html,
      selectedTemplate?.text
    ];

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
  }, [selectedTemplate?.html, selectedTemplate?.subject, selectedTemplate?.text]);

  const templateVariableKeys = useMemo(
    () => detectedVariableKeys,
    [detectedVariableKeys]
  );

  const previewVariableKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...templateVariableKeys,
          ...Object.keys(selectedRecipientValues)
        ])
      ).sort((a, b) => a.localeCompare(b)),
    [selectedRecipientValues, templateVariableKeys]
  );

  useEffect(() => {
    if (!hydratedFromStorage) {
      return;
    }

    if (recipients.length === 0) {
      return;
    }

    const current = parseRecipientVariablesMapJson(form.getValues("templateData"));
    if (current.error) {
      return;
    }

    const defaults = selectedTemplate?.previewVariables ?? {};
    const synced = syncTemplateDataMapForRecipients(
      recipients,
      current.map,
      defaults,
      templateVariableKeys
    );

    if (synced.changed) {
      form.setValue("templateData", JSON.stringify(synced.nextMap, null, 2), {
        shouldDirty: recipients.length > 0
      });
    }
  }, [
    form,
    hydratedFromStorage,
    recipients,
    selectedTemplate,
    templateVariableKeys
  ]);

  const setTemplateVariable = (key: string, value: string) => {
    if (!activeRecipient) {
      return;
    }

    const next = {
      ...recipientTemplateMap,
      [activeRecipient]: {
        ...(recipientTemplateMap[activeRecipient] ?? {}),
        [key]: value
      }
    };

    form.setValue("templateData", JSON.stringify(next, null, 2), {
      shouldDirty: true
    });
  };

  const clearTemplateVariable = (key: string) => {
    if (!activeRecipient) {
      return;
    }

    const recipientValues = { ...(recipientTemplateMap[activeRecipient] ?? {}) };
    delete recipientValues[key];

    const next = {
      ...recipientTemplateMap,
      [activeRecipient]: recipientValues
    };

    form.setValue("templateData", JSON.stringify(next, null, 2), {
      shouldDirty: true
    });
  };

  const previewHtml = renderTemplateVariables(
    selectedTemplate?.html ?? "<p>Select a template</p>",
    selectedRecipientValues
  );

  const previewSubject = renderTemplateVariables(
    selectedTemplate?.subject ?? "No subject",
    selectedRecipientValues
  );

  const previewText = renderTemplateVariables(
    selectedTemplate?.text ?? "Select a template",
    selectedRecipientValues
  );

  const handleCsvUpload = (file: File) => {
    Papa.parse<string[]>(file, {
      complete: (results) => {
        const values = results.data
          .flat()
          .map((item) => item?.trim())
          .filter((item): item is string => Boolean(item));

        const valid = values
          .map((value) => value.toLowerCase())
          .filter((value) => isValidContactEmail(value));
        const invalidCount = values.length - valid.length;

        form.setValue("recipients", [
          ...new Set([...form.getValues("recipients"), ...valid])
        ]);

        if (invalidCount > 0) {
          toast.error(`Skipped ${invalidCount} invalid email(s) from CSV`);
        }
      }
    });
  };

  const onSubmit = (values: CampaignInput) => {
    const parsedMap = parseRecipientVariablesMapJson(values.templateData);
    if (parsedMap.error) {
      toast.error(parsedMap.error);
      return;
    }

    const missingRecipients = values.recipients.filter(
      (recipient) => !parsedMap.map[recipient]
    );
    if (missingRecipients.length > 0) {
      toast.error(
        `Template Variables JSON is missing entries for: ${missingRecipients.join(", ")}`
      );
      return;
    }

    startTransition(async () => {
      const result = await sendCampaignAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const sentResults = result.data ?? [];
      const failed = sentResults.filter((item) => item.status === "failed");
      if (failed.length > 0) {
        toast.error(
          `Campaign completed with ${failed.length} failed recipients`
        );
      } else {
        toast.success(`Campaign sent to ${sentResults.length} recipients`);
      }
    });
  };

  const applyContactBookById = (bookId: string, withToast = true) => {
    const selectedBook = contactBooks.find((book) => book.id === bookId);
    if (!selectedBook) {
      if (withToast) {
        toast.error("Select a contact book first");
      }
      return;
    }

    const recipientList = selectedBook.recipients
      .map((value) => value.trim().toLowerCase())
      .filter((value) => isValidContactEmail(value));

    if (recipientList.length === 0) {
      if (withToast) {
        toast.error("Selected contact book has no valid recipients");
      }
      return;
    }

    form.setValue("recipients", recipientList, { shouldDirty: true, shouldValidate: true });
    setSelectedRecipient(recipientList[0] ?? "");
    if (withToast) {
      toast.success(`Loaded ${recipientList.length} recipient(s) from "${selectedBook.name}"`);
    }
  };

  const applySelectedContactBook = () => {
    applyContactBookById(selectedContactBookId, true);
  };

  return (
    <form
      className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,1.1fr)]"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Card className="panel">
        <CardHeader className="font-semibold">Campaign Builder</CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <Select
              isDisabled={contactBooks.length === 0}
              label="Contact Book"
              placeholder={
                contactBooks.length === 0
                  ? "No contact books yet"
                  : "Select a contact book"
              }
              selectedKeys={
                selectedContactBookId ? new Set([selectedContactBookId]) : new Set()
              }
              renderValue={() =>
                selectedContactBook
                  ? `${selectedContactBook.name} (${selectedContactBook.recipients.length})`
                  : "Select a contact book"
              }
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedContactBookId(nextId);
                if (nextId) {
                  applyContactBookById(nextId, true);
                }
              }}
            >
              {contactBooks.map((book) => (
                <SelectItem key={book.id} textValue={`${book.name} (${book.recipients.length})`}>
                  {book.name} ({book.recipients.length})
                </SelectItem>
              ))}
            </Select>
            <Button
              className="h-14 md:self-end"
              color="primary"
              isDisabled={contactBooks.length === 0 || !selectedContactBookId}
              type="button"
              variant="flat"
              onPress={applySelectedContactBook}
            >
              Load Contact Book
            </Button>
          </div>

          <Controller
            control={form.control}
            name="recipients"
            render={({ field }) => (
              <div className="space-y-2">
                <p className="text-sm text-gray-300">Recipients</p>
                <TagsInput
                  onInvalidTag={(value) =>
                    toast.error(`Invalid email: ${value}`)
                  }
                  onChange={(tags) => field.onChange(tags)}
                  placeholder="Add recipient emails"
                  validateTag={isValidContactEmail}
                  value={field.value}
                />
                {form.formState.errors.recipients?.message ? (
                  <p className="text-xs text-danger">
                    {form.formState.errors.recipients.message}
                  </p>
                ) : null}
              </div>
            )}
          />

          <Input
            label="CSV Upload"
            startContent={<Upload className="h-4 w-4" />}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              handleCsvUpload(file);
            }}
          />

          <Controller
            control={form.control}
            name="templateName"
            render={({ field }) => (
              <Select
                label={
                  <span className="inline-flex items-center gap-1">
                    Template
                    <Tooltip content="Only templates uploaded to SES are listed here.">
                      <span
                        aria-label="Templates shown are synced to SES"
                        className="cursor-help text-default-400"
                        role="img"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  </span>
                }
                selectedKeys={field.value ? new Set([field.value]) : new Set()}
                onSelectionChange={(selection) => {
                  field.onChange(firstSelectionKey(selection));
                }}
              >
                {templates.map((template) => (
                  <SelectItem key={template.name}>{template.name}</SelectItem>
                ))}
              </Select>
            )}
          />

          <Controller
            control={form.control}
            name="templateData"
            render={({ field }) => (
              <Textarea
                description='Per-recipient JSON map. Recipients auto-generate with placeholders (example: {"user1@example.com":{"name":"<name>"}}).'
                errorMessage={parsedTemplateMap.error ?? undefined}
                isInvalid={Boolean(parsedTemplateMap.error)}
                label="Template Variables JSON"
                minRows={6}
                value={field.value}
                onValueChange={(next) =>
                  field.onChange(next)
                }
              />
            )}
          />

          <Button
            className="w-full"
            color="primary"
            isLoading={isPending}
            startContent={<MailCheck className="h-4 w-4" />}
            type="submit"
          >
            Send Campaign
          </Button>
        </CardBody>
      </Card>

      <Card className="panel">
        <CardHeader className="flex items-center justify-between">
          <p className="font-semibold">Email Client Mockup</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              color={device === "desktop" ? "primary" : "default"}
              onPress={() => setDevice("desktop")}
              size="sm"
              type="button"
              variant="flat"
            >
              Desktop
            </Button>
            <Button
              color={device === "mobile" ? "primary" : "default"}
              onPress={() => setDevice("mobile")}
              size="sm"
              type="button"
              variant="flat"
            >
              Mobile
            </Button>
            <Button
              color={previewTheme === "dark" ? "primary" : "default"}
              onPress={() => setPreviewTheme("dark")}
              size="sm"
              startContent={<Moon className="h-3.5 w-3.5" />}
              type="button"
              variant="flat"
            >
              Dark
            </Button>
            <Button
              color={previewTheme === "light" ? "primary" : "default"}
              onPress={() => setPreviewTheme("light")}
              size="sm"
              startContent={<Sun className="h-3.5 w-3.5" />}
              type="button"
              variant="flat"
            >
              Light
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="rounded-xl border border-white/15 bg-black/25 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-100">Template Variables</p>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">
                {detectedVariableKeys.length} detected
              </p>
            </div>
            <Select
              className="mb-3"
              isDisabled={recipients.length === 0}
              label="Preview Recipient"
              placeholder="Choose recipient"
              selectedKeys={activeRecipient ? new Set([activeRecipient]) : new Set()}
              size="sm"
              onSelectionChange={(selection) => {
                setSelectedRecipient(firstSelectionKey(selection));
              }}
            >
              {recipients.map((recipient) => (
                <SelectItem key={recipient}>{recipient}</SelectItem>
              ))}
            </Select>
            {previewVariableKeys.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {previewVariableKeys.map((key) => (
                  <Input
                    key={key}
                    classNames={{
                      input: "text-sm",
                      label: "text-[11px]"
                    }}
                    isClearable
                    label={`{{${key}}}`}
                    size="sm"
                    value={selectedRecipientValues[key] ?? ""}
                    onClear={() => clearTemplateVariable(key)}
                    onValueChange={(value) => setTemplateVariable(key, value)}
                  />
                ))}
              </div>
            ) : activeRecipient ? (
              <p className="text-xs text-slate-400">
                No variables detected for this template.
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Add recipients to edit per-email template variables.
              </p>
            )}
          </div>

          <Tabs
            aria-label="Preview mode"
            selectedKey={previewMode}
            onSelectionChange={(key) => setPreviewMode(key as "html" | "text")}
          >
            <Tab key="html" title="HTML" />
            <Tab key="text" title="Plain Text" />
          </Tabs>

          <div
            className={`mx-auto w-full ${
              device === "mobile" ? "max-w-[360px]" : "max-w-4xl"
            }`}
          >
            <div
              className={`overflow-hidden rounded-2xl border ${
                previewTheme === "dark"
                  ? "border-white/15 bg-slate-950 text-slate-100"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
            >
              {device === "desktop" ? (
                <div
                  className={`border-b px-4 py-3 ${
                    previewTheme === "dark"
                      ? "border-white/10 bg-slate-900"
                      : "border-slate-200 bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                    </div>
                    <p
                      className={`text-xs font-medium ${
                        previewTheme === "dark"
                          ? "text-slate-300"
                          : "text-slate-600"
                      }`}
                    >
                      Email Client Mockup
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={`border-b px-4 py-2 ${
                    previewTheme === "dark"
                      ? "border-white/10 bg-slate-900"
                      : "border-slate-200 bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span>9:41</span>
                    <span
                      className={
                        previewTheme === "dark"
                          ? "text-slate-300"
                          : "text-slate-500"
                      }
                    >
                      Preview
                    </span>
                    <span>5G</span>
                  </div>
                </div>
              )}
              <div
                className={`border-b px-4 py-3 text-xs ${
                  previewTheme === "dark"
                    ? "border-white/10 bg-slate-900/60"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="truncate">
                  <span className="font-semibold">From:</span>{" "}
                  {sourceEmail || "not-configured@example.com"}
                </p>
                <p className="truncate">
                  <span className="font-semibold">To:</span>{" "}
                  {activeRecipient || "recipient@example.com"}
                </p>
                <p className="mt-1 truncate">
                  <span className="font-semibold">Subject:</span>{" "}
                  {previewSubject || "No subject"}
                </p>
              </div>
              {previewMode === "html" ? (
                <HtmlPreviewFrame
                  className={`min-h-[440px] w-full ${
                    previewTheme === "dark"
                      ? "bg-slate-950"
                      : "bg-white"
                  }`}
                  html={previewHtml}
                  theme={previewTheme}
                />
              ) : (
                <pre className="min-h-[440px] whitespace-pre-wrap p-4 text-sm">
                  {previewText}
                </pre>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
