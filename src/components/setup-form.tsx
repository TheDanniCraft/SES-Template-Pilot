"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { setupInitialAdminAction } from "@/lib/actions/auth";

function isStrongPassword(value: string) {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function SetupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const onSubmit = () => {
    startTransition(async () => {
      const result = await setupInitialAdminAction({
        email,
        password,
        organizationName
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Admin account created");
      router.replace("/app");
      router.refresh();
    });
  };

  return (
    <Card className="panel w-full max-w-md border border-cyan-400/30">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">First Setup</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Create Admin User
          </h1>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <Input
          label="Organization Name"
          placeholder="Acme Team"
          value={organizationName}
          onValueChange={setOrganizationName}
        />
        <Input
          label="Admin Email"
          placeholder="admin@example.com"
          type="email"
          value={email}
          onValueChange={setEmail}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onValueChange={setPassword}
          description="At least 12 chars with uppercase, lowercase, number, and symbol."
        />
        <Button
          color="primary"
          isDisabled={
            organizationName.trim().length < 2 ||
            email.trim().length < 5 ||
            !isStrongPassword(password)
          }
          isLoading={isPending}
          onPress={onSubmit}
        >
          Create Admin
        </Button>
      </CardBody>
    </Card>
  );
}

