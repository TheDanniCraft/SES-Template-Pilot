import { LoginForm } from "@/components/login-form";
import { getAppPassword } from "@/lib/app-password";

export default function LoginPage() {
  const devPasswordHint =
    process.env.NODE_ENV !== "production" ? getAppPassword() : null;

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
          <LoginForm devPasswordHint={devPasswordHint} />
        </div>
      </div>
    </main>
  );
}
