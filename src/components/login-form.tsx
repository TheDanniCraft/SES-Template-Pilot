"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, CardHeader, Chip, Input, Link } from "@heroui/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { loginWithPasswordAction } from "@/lib/actions/auth";
import { z } from "zod";

type LoginFormProps = {
  loginError: string | null;
  setupRequired?: boolean;
};

const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});

type LoginFormInput = z.infer<typeof loginFormSchema>;

export function LoginForm({ loginError, setupRequired = false }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = (values: LoginFormInput) => {
    startTransition(async () => {
      setFormError(null);
      const result = await loginWithPasswordAction(values);
      if (!result.success) {
        const message = result.error ?? "Login failed";
        toast.error(message);
        setFormError(message);
        return;
      }
      toast.success("Logged in");
      router.refresh();
      router.replace("/app");
    });
  };

  return (
    <Card className="panel w-full max-w-md border border-cyan-400/30">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Authentication</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            Password Login
          </h1>
        </div>
        <Chip color="primary" variant="flat">Self-Hosted</Chip>
      </CardHeader>

      <CardBody className="space-y-4">
        {setupRequired ? (
          <div className="rounded-large border border-warning/40 bg-warning/10 p-3 text-xs text-warning-200">
            No admin account exists yet. Open <code>/setup</code> first.
          </div>
        ) : null}
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
          <Input
            {...form.register("password")}
            errorMessage={form.formState.errors.password?.message}
            isInvalid={Boolean(form.formState.errors.password)}
            label="Password"
            startContent={<Lock className="h-4 w-4 text-default-400" />}
            type="password"
          />
          <Button color="primary" isLoading={isPending} type="submit">
            Login
          </Button>
        </form>

        {loginError || formError ? (
          <div className="rounded-large border border-danger/40 bg-danger/10 p-3 text-xs text-danger-200">
            {formError ?? "Login failed. Please check your credentials."}
          </div>
        ) : null}

        <p className="text-xs text-slate-300">
          Users can only join with an invite link from an organization owner.
        </p>
        <Link className="text-xs text-cyan-300" href="https://sespilot.app">
          sespilot.app
        </Link>
      </CardBody>
    </Card>
  );
}
