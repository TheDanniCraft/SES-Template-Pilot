import { UserSesSettingsForm } from "@/components/user-ses-settings-form";
import { getServerSessionUser } from "@/lib/server-auth";
import { getUserSesConfig } from "@/lib/user-ses";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getServerSessionUser();
  let config = null;
  let loadError: string | null = null;

  if (user) {
    try {
      config = await getUserSesConfig(user.id);
    } catch (error) {
      loadError =
        error instanceof Error
          ? error.message
          : "Failed to decrypt stored SES settings.";
    }
  }

  return (
    <section className="space-y-4">
      <header className="panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Account</p>
        <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
      </header>
      <UserSesSettingsForm
        loadError={loadError}
        initialConfig={
          config ?? {
            awsRegion: null,
            accessKeyId: null,
            secretAccessKey: null,
            sessionToken: null,
            sourceEmail: null
          }
        }
      />
    </section>
  );
}
