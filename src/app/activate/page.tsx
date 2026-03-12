import { redirect } from "next/navigation";
import { LicenseActivationForm } from "@/components/license-activation-form";
import { isUserLicenseActive } from "@/lib/license";
import { ensurePersonalOrgForUser } from "@/lib/org";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function ActivatePage() {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login");
  }

  await ensurePersonalOrgForUser(user);

  const isActive = await isUserLicenseActive(user.id);
  if (isActive) {
    redirect("/app");
  }
  const purchaseUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL?.trim() ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
            License Required
          </p>
          <h1 className="mt-2 text-4xl font-semibold">
            <span className="title-gradient">SES Template Pilot</span>
          </h1>
        </div>
        <div className="flex justify-center">
          <LicenseActivationForm email={user.email} purchaseUrl={purchaseUrl} />
        </div>
      </div>
    </main>
  );
}
