"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHeader, Input, Textarea } from "@heroui/react";
import { toast } from "sonner";
import { createInviteLinkAction } from "@/lib/actions/auth";

export function TeamInviteForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const onCreateInvite = () => {
    startTransition(async () => {
      const result = await createInviteLinkAction({ email });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setInviteUrl(result.inviteUrl ?? "");
      toast.success("Invite link created");
    });
  };

  return (
    <Card className="panel rounded-2xl">
      <CardHeader>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Team</p>
          <h2 className="text-lg font-semibold">Invite User</h2>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <Input
          label="User Email"
          placeholder="teammate@example.com"
          type="email"
          value={email}
          onValueChange={setEmail}
        />
        <Button
          color="primary"
          isDisabled={email.trim().length < 5}
          isLoading={isPending}
          onPress={onCreateInvite}
        >
          Create Invite Link
        </Button>
        {inviteUrl ? (
          <Textarea
            isReadOnly
            label="Invite URL"
            minRows={3}
            value={inviteUrl}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}
