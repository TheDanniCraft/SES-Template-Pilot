"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, CardHeader, Chip, Input, Link } from "@heroui/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Mail, MailCheck, ShieldCheck } from "lucide-react";
import { requestMagicLinkAction } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validators";

type LoginFormProps = {
  loginError: string | null;
};

export function LoginForm({ loginError }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = (values: LoginInput) => {
    startTransition(async () => {
      const result = await requestMagicLinkAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setPreviewUrl(result.previewUrl ?? null);
      setSentToEmail(values.email.trim().toLowerCase());
      if (result.previewUrl) {
        toast.success("Magic link generated (dev mode)");
      } else {
        toast.success("Magic link sent");
      }

      router.refresh();
    });
  };

  return (
    <Card className="panel w-full max-w-md border border-cyan-400/30">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Authentication</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Magic Link Login
          </h1>
        </div>
        <Chip color="primary" variant="flat">Email</Chip>
      </CardHeader>

      <CardBody className="space-y-4">
        {sentToEmail ? (
          <div className="space-y-3">
            <div className="rounded-large border border-success/40 bg-success/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-success-200">
                <MailCheck className="h-4 w-4" />
                Check your email
              </p>
              <p className="mt-2 text-xs text-slate-200">
                We sent a sign-in link to <span className="font-medium">{sentToEmail}</span>.
                The link expires in 15 minutes.
              </p>
            </div>
            <Button
              color="primary"
              variant="flat"
              onPress={() => {
                setSentToEmail(null);
                setPreviewUrl(null);
              }}
            >
              Send Another Link
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Input
              {...form.register("email")}
              errorMessage={form.formState.errors.email?.message}
              isInvalid={Boolean(form.formState.errors.email)}
              label="Email"
              startContent={<Mail className="h-4 w-4 text-default-400" />}
              placeholder="you@sespilot.app"
              type="email"
            />
            <Button color="primary" isLoading={isPending} type="submit">
              Send Magic Link
            </Button>
          </form>
        )}

        {loginError ? (
          <div className="rounded-large border border-danger/40 bg-danger/10 p-3 text-xs text-danger-200">
            This sign-in link is invalid or expired. Request a new one.
          </div>
        ) : null}

        <p className="text-xs text-slate-300">
          Check your inbox for a secure link. In local development without mail credentials, a preview link is shown in the action response.
        </p>
        {previewUrl ? (
          <Link className="text-xs text-cyan-300" href={previewUrl} target="_blank">
            Open Dev Magic Link
          </Link>
        ) : null}
        <Link className="text-xs text-cyan-300" href="https://sespilot.app">
          sespilot.app
        </Link>
      </CardBody>
    </Card>
  );
}
