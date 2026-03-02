import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/server-auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getServerSessionUser();
  if (user) {
    redirect("/app");
  }

  const params = await searchParams;
  const loginError =
    params.error === "invalid_or_expired" ? "invalid_or_expired" : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
            Email Operations
          </p>
          <h1 className="mt-2 text-4xl font-semibold">
            <span className="title-gradient">SES Template Pilot</span>
          </h1>
        </div>
        <div className="flex justify-center">
          <LoginForm loginError={loginError} />
        </div>
      </div>
    </main>
  );
}
