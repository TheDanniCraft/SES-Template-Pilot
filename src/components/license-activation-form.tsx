"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { activatePolarLicenseAction } from "@/lib/actions/license";

type LicenseActivationFormProps = {
  email: string;
  organizationName: string;
  purchaseUrl?: string;
};

export function LicenseActivationForm({
  email,
  organizationName,
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

  return (
    <Card className="panel w-full max-w-md border border-cyan-400/30">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">
            Organization License
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Add Commercial License
          </h1>
          <p className="mt-2 text-xs text-slate-300">
            Signed in as <span className="font-medium">{email}</span>
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Organization: <span className="font-medium">{organizationName}</span>
          </p>
          <p className="mt-3 text-xs text-slate-400">
            This applies to <span className="font-medium text-slate-200">{organizationName}</span>.
            Free open source usage already works without a license.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <Input
          label="Commercial License Key"
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
          Add License
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
            Get Commercial License
          </Button>
        ) : null}
        <Button as={Link} href="/app" variant="flat">
          Back to App
        </Button>
      </CardBody>
    </Card>
  );
}
