"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Switch
} from "@heroui/react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  saveUserSesConfigAction,
  sendSesTestEmailAction
} from "@/lib/actions/settings";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import type { UserSesConfig } from "@/lib/user-ses";

type UserSesSettingsFormProps = {
  initialConfig: UserSesConfig;
  loadError?: string | null;
  regions: string[];
};

export function UserSesSettingsForm({
  initialConfig,
  loadError = null,
  regions
}: UserSesSettingsFormProps) {
  const hasRegionOptions = regions.length > 0;
  const defaultRegion = useMemo(() => {
    if (regions.includes("us-east-1")) {
      return "us-east-1";
    }
    return regions[0] ?? "";
  }, [regions]);
  const [isSavePending, startSaveTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const [form, setForm] = useState({
    awsRegion: initialConfig.awsRegion || defaultRegion,
    accessKeyId: initialConfig.accessKeyId ?? "",
    secretAccessKey: initialConfig.secretAccessKey ?? "",
    sessionToken: initialConfig.sessionToken ?? "",
    sourceEmail: initialConfig.sourceEmail ?? "",
    openTrackingEnabled: initialConfig.openTrackingEnabled,
    clickTrackingEnabled: initialConfig.clickTrackingEnabled
  });

  const updateField = (
    field: "awsRegion" | "accessKeyId" | "secretAccessKey" | "sessionToken" | "sourceEmail",
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const onSave = useCallback(() => {
    startSaveTransition(async () => {
      const result = await saveUserSesConfigAction(form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("SES settings saved and validated");
    });
  }, [form, startSaveTransition]);

  const onSendTestEmail = useCallback(() => {
    startTestTransition(async () => {
      const result = await sendSesTestEmailAction(form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.messageId
          ? `Test email sent to ${result.recipient} (${result.messageId})`
          : `Test email sent to ${result.recipient}`
      );
    });
  }, [form, startTestTransition]);

  useSaveShortcut(onSave, !isSavePending && !isTestPending);

  const onClear = () => {
    setForm({
      awsRegion: hasRegionOptions ? defaultRegion : "",
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
      sourceEmail: "",
      openTrackingEnabled: true,
      clickTrackingEnabled: true
    });
  };

  return (
    <Card className="panel rounded-2xl">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Settings</p>
          <h1 className="text-xl font-semibold">Organization SES Credentials</h1>
          <p className="mt-1 text-xs text-slate-300">
            These credentials are stored per organization and used for templates, sending, and quota checks.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {loadError ? (
          <div className="rounded-large border border-danger/40 bg-danger/10 p-3 text-xs text-danger-200">
            {loadError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {hasRegionOptions ? (
            <Select
              disallowEmptySelection
              label="AWS Region"
              selectedKeys={new Set([form.awsRegion || defaultRegion])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                if (typeof selected === "string") {
                  updateField("awsRegion", selected);
                }
              }}
            >
              {regions.map((region) => (
                <SelectItem key={region}>{region}</SelectItem>
              ))}
            </Select>
          ) : (
            <Input
              description="Region list unavailable from AWS endpoint. Enter region manually."
              label="AWS Region"
              placeholder="us-east-1"
              value={form.awsRegion}
              onValueChange={(value) => updateField("awsRegion", value)}
            />
          )}
          <Input
            label="Source Email"
            placeholder="no-reply@example.com"
            type="email"
            value={form.sourceEmail}
            onValueChange={(value) => updateField("sourceEmail", value)}
          />
        </div>

        <Input
          label="Access Key ID"
          placeholder="AKIA..."
          value={form.accessKeyId}
          onValueChange={(value) => updateField("accessKeyId", value)}
        />
        <Input
          label="Secret Access Key"
          placeholder="AWS secret access key"
          type="password"
          value={form.secretAccessKey}
          onValueChange={(value) => updateField("secretAccessKey", value)}
        />
        <Input
          label="Session Token (optional)"
          placeholder="STS session token"
          type="password"
          value={form.sessionToken}
          onValueChange={(value) => updateField("sessionToken", value)}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Switch
            isSelected={form.openTrackingEnabled}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, openTrackingEnabled: value }))
            }
          >
            Open Tracking
          </Switch>
          <Switch
            isSelected={form.clickTrackingEnabled}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, clickTrackingEnabled: value }))
            }
          >
            Click Tracking
          </Switch>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            color="primary"
            isLoading={isSavePending}
            startContent={<Save className="h-4 w-4" />}
            onPress={onSave}
          >
            Save & Validate
          </Button>
          <Button
            isDisabled={isSavePending || isTestPending}
            isLoading={isTestPending}
            variant="flat"
            onPress={onSendTestEmail}
          >
            Send Test Email
          </Button>
          <Button
            isDisabled={isSavePending || isTestPending}
            variant="flat"
            onPress={onClear}
          >
            Clear Form
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
