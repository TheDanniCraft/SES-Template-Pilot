import { Sidebar } from "@/components/sidebar";
import { getUserLicenseState } from "@/lib/license";
import { ensurePersonalOrgForUser, getUserOrganizations, isInitialOwner } from "@/lib/org";
import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login");
  }
  const activeOrg = await ensurePersonalOrgForUser(user);
  const organizations = await getUserOrganizations(user.id);
  const canCreateOrganizations = await isInitialOwner(user.id);
  const license = await getUserLicenseState(user.id);

  return (
    <div className="app-shell flex min-h-screen flex-col gap-4 lg:flex-row lg:gap-5">
      <Sidebar
        activeOrganizationId={activeOrg.organizationId}
        currentUserEmail={user.email}
        hasActiveLicense={license.isActive}
        organizations={organizations}
        canCreateOrganizations={canCreateOrganizations}
      />
      <main className="min-w-0 flex-1 pb-6">{children}</main>
    </div>
  );
}
