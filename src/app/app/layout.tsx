import { Sidebar } from "@/components/sidebar";
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

  return (
    <div className="app-shell flex min-h-screen flex-col gap-4 lg:flex-row lg:gap-5">
      <Sidebar currentUserEmail={user.email} />
      <main className="min-w-0 flex-1 pb-6">{children}</main>
    </div>
  );
}
