"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { ExternalLink, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { activatePolarLicenseAction } from "@/lib/actions/license";
import { logoutAction } from "@/lib/actions/auth";

type LicenseActivationFormProps = {
  email: string;
  purchaseUrl?: string;
};

export function LicenseActivationForm({
  email,
  purchaseUrl = ""
}: LicenseActivationFormProps) {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [isPending, startTransition] = useTransition();

  const onActivate = () => {
    startTransition(async () => {
      const result = await activatePolarLicenseAction({ key: licenseKey });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("License activated");
      router.replace("/app");
      router.refresh();
    });
  };

  const onLogout = () => {
    startTransition(async () => {
      await logoutAction();
      router.replace("/login");
      router.refresh();
    });
  };

  return (
    <Card className="panel w-full max-w-md border border-cyan-400/30">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Activation</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Activate Your Account
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Signed in as <span className="font-medium">{email}</span>
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <Input
          label="Polar License Key"
          placeholder="2E0E3FF7-D410-4863-96DE-EA312C44DAA0"
          value={licenseKey}
          onValueChange={setLicenseKey}
          startContent={<KeyRound className="h-4 w-4 text-default-400" />}
        />
        <Button
          color="primary"
          isDisabled={licenseKey.trim().length < 5}
          isLoading={isPending}
          onPress={onActivate}
        >
          Activate
        </Button>
        {purchaseUrl ? (
          <Button
            as="a"
            color="secondary"
            href={purchaseUrl}
            rel="noreferrer"
            startContent={<ExternalLink className="h-4 w-4" />}
            target="_blank"
            variant="flat"
          >
            Purchase License
          </Button>
        ) : null}
        <Button
          isLoading={isPending}
          startContent={<LogOut className="h-4 w-4" />}
          variant="flat"
          onPress={onLogout}
        >
          Logout
        </Button>
      </CardBody>
    </Card>
  );
}
