import { AccountSettingsForm } from "@/components/account-settings-form";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getServerSessionUser();
  if (!user) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header className="panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">Account</p>
        <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
      </header>
      <AccountSettingsForm
        email={user.email}
        name={user.name?.trim() || user.email.split("@")[0] || "User"}
      />
    </section>
  );
}
