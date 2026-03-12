"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { toast } from "sonner";
import { acceptInviteAction } from "@/lib/actions/auth";

type InviteAcceptFormProps = {
  email: string;
  token: string;
};

function isStrongPassword(value: string) {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function InviteAcceptForm({ email, token }: InviteAcceptFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const onSubmit = () => {
    startTransition(async () => {
      const result = await acceptInviteAction({
        name,
        token,
        password
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Invite accepted");
      router.replace("/app");
      router.refresh();
    });
  };

  return (
    <Card className="panel w-full max-w-md border border-cyan-400/30">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Invitation</p>
          <h1 className="mt-1 text-xl font-semibold">Join Organization</h1>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <Input
          isDisabled
          label="Email"
          type="email"
          value={email}
        />
        <Input
          label="Name"
          value={name}
          onValueChange={setName}
        />
        <Input
          label="Set Password"
          type="password"
          value={password}
          onValueChange={setPassword}
          description="At least 12 chars with uppercase, lowercase, number, and symbol."
        />
        <Button
          color="primary"
          isDisabled={name.trim().length < 1 || !isStrongPassword(password)}
          isLoading={isPending}
          onPress={onSubmit}
        >
          Accept Invite
        </Button>
      </CardBody>
    </Card>
  );
}

