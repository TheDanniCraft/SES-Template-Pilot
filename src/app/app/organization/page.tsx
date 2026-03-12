import { and, eq, isNull } from "drizzle-orm";
import { ManageOrgPanel } from "@/components/manage-org-panel";
import { UserSesSettingsForm } from "@/components/user-ses-settings-form";
import { getAwsSesRegions } from "@/lib/aws-regions";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { getServerSessionUser } from "@/lib/server-auth";
import {
  organizationInvites,
  organizationLicenses,
  organizationMembers,
  organizations,
  users
} from "@/lib/schema";
import { getUserSesConfig } from "@/lib/user-ses";

export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  const user = await getServerSessionUser();
  if (!user) {
    return null;
  }

  const org = await getRequiredUserOrg(user.id);
  const [orgRow] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, org.organizationId))
    .limit(1);

  const members = await db
    .select({
      userId: organizationMembers.userId,
      userEmail: users.email,
      role: organizationMembers.role
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, org.organizationId));

  const [license] = await db
    .select({
      status: organizationLicenses.status
    })
    .from(organizationLicenses)
    .where(eq(organizationLicenses.organizationId, org.organizationId))
    .limit(1);

  const pendingInvites = await db
    .select({
      inviteId: organizationInvites.id,
      email: organizationInvites.email
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, org.organizationId),
        isNull(organizationInvites.usedAt)
      )
    );
  let sesConfig = null;
  let sesLoadError: string | null = null;
  const regions = await getAwsSesRegions();
  try {
    sesConfig = await getUserSesConfig(user.id);
  } catch (error) {
    sesLoadError =
      error instanceof Error ? error.message : "Failed to decrypt stored SES settings.";
  }

  const isOwner =
    members.find((member) => member.userId === user.id)?.role.toLowerCase() === "owner";

  return (
    <section className="space-y-4">
      <header className="panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Organization</p>
        <h1 className="mt-1 text-2xl font-semibold">Manage Org</h1>
      </header>
      <ManageOrgPanel
        canManage={isOwner}
        currentUserId={user.id}
        initialName={orgRow?.name ?? "Organization"}
        licenseStatus={license?.status ?? null}
        members={members}
        pendingInvites={pendingInvites}
      />
      <UserSesSettingsForm
        loadError={sesLoadError}
        regions={regions}
        initialConfig={
          sesConfig ?? {
            awsRegion: null,
            accessKeyId: null,
            secretAccessKey: null,
            sessionToken: null,
            sourceEmail: null,
            openTrackingEnabled: true,
            clickTrackingEnabled: true
          }
        }
      />
    </section>
  );
}
