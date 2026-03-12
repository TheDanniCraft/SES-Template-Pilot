import { redirect } from "next/navigation";
import { SetupForm } from "@/components/setup-form";
import { countUsers } from "@/lib/auth-service";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const usersCount = await countUsers();
  if (usersCount > 0) {
    redirect("/login");
  }

  const user = await getServerSessionUser();
  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
            First Setup
          </p>
          <h1 className="mt-2 text-4xl font-semibold">
            <span className="title-gradient">SES Template Pilot</span>
          </h1>
        </div>
        <div className="flex justify-center">
          <SetupForm />
        </div>
      </div>
    </main>
  );
}

