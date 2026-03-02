"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, CardHeader, Chip, Input } from "@heroui/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validators";

type LoginFormProps = {
  devPasswordHint: string | null;
};

export function LoginForm({ devPasswordHint }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      password: ""
    }
  });

  const onSubmit = (values: LoginInput) => {
    startTransition(async () => {
      const result = await loginAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Authenticated");
      router.push("/");
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
            Master Login
          </h1>
        </div>
        <Chip color="primary" variant="flat">Protected</Chip>
      </CardHeader>

      <CardBody className="space-y-4">
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Input
            {...form.register("password")}
            errorMessage={form.formState.errors.password?.message}
            isInvalid={Boolean(form.formState.errors.password)}
            label="Master Password"
            startContent={<LockKeyhole className="h-4 w-4 text-default-400" />}
            placeholder="Enter your APP_PASSWORD"
            type="password"
          />
          <Button color="primary" isLoading={isPending} type="submit">
            Unlock Dashboard
          </Button>
        </form>

        {devPasswordHint ? (
          <div className="rounded-large border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Dev password: <code className="font-semibold">{devPasswordHint}</code>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
