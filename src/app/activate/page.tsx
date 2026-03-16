import { redirect } from "next/navigation";
import { isUserLicenseActive } from "@/lib/license";
import { ensurePersonalOrgForUser } from "@/lib/org";
import { getServerSessionUser } from "@/lib/server-auth";
import { LicenseActivationForm } from "@/components/license-activation-form";

export const dynamic = "force-dynamic";

export default async function ActivatePage() {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login");
  }

  const organization = await ensurePersonalOrgForUser(user);

  const isActive = await isUserLicenseActive(user.id);
  if (isActive) {
    redirect("/app");
  }

  const purchaseUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL?.trim() ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LicenseActivationForm
        email={user.email}
        organizationName={organization.organizationName}
        purchaseUrl={purchaseUrl}
      />
    </main>
  );
}
