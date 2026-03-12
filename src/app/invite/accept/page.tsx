import { redirect } from "next/navigation";
import { InviteAcceptForm } from "@/components/invite-accept-form";
import { getInviteEmailForToken } from "@/lib/auth-service";

type InviteAcceptPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function InviteAcceptPage({ searchParams }: InviteAcceptPageProps) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  if (!token) {
    redirect("/login");
  }
  const email = await getInviteEmailForToken(token);
  if (!email) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
            Team Invitation
          </p>
          <h1 className="mt-2 text-4xl font-semibold">
            <span className="title-gradient">SES Template Pilot</span>
          </h1>
        </div>
        <div className="flex justify-center">
          <InviteAcceptForm email={email} token={token} />
        </div>
      </div>
    </main>
  );
}
