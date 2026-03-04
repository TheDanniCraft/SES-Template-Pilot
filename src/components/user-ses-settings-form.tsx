"use client";

import { useCallback, useState, useTransition } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
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
};

export function UserSesSettingsForm({
  initialConfig,
  loadError = null
}: UserSesSettingsFormProps) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const [form, setForm] = useState({
    awsRegion: initialConfig.awsRegion ?? "",
    accessKeyId: initialConfig.accessKeyId ?? "",
    secretAccessKey: initialConfig.secretAccessKey ?? "",
    sessionToken: initialConfig.sessionToken ?? "",
    sourceEmail: initialConfig.sourceEmail ?? ""
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setScopeWarning(null);
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const onSave = useCallback(() => {
    startSaveTransition(async () => {
      const result = await saveUserSesConfigAction(form);
      if (!result.success) {
        setScopeWarning(null);
        toast.error(result.error);
        return;
      }
      toast.success("SES settings saved and validated");
      setScopeWarning(result.warning ?? null);
      if (result.warning) {
        toast.warning(result.warning);
      }
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
    setScopeWarning(null);
    setForm({
      awsRegion: "",
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
      sourceEmail: ""
    });
  };

  return (
    <Card className="panel rounded-2xl">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Settings</p>
          <h1 className="text-xl font-semibold">Your SES Credentials</h1>
          <p className="mt-1 text-xs text-slate-300">
            These credentials are stored per user and used for templates, sending, and metrics.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {loadError ? (
          <div className="rounded-large border border-danger/40 bg-danger/10 p-3 text-xs text-danger-200">
            {loadError}
          </div>
        ) : null}
        {scopeWarning ? (
          <div className="rounded-large border border-warning/40 bg-warning/10 p-3 text-xs text-warning-200">
            {scopeWarning}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="AWS Region"
            placeholder="us-east-1"
            value={form.awsRegion}
            onValueChange={(value) => updateField("awsRegion", value)}
          />
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
