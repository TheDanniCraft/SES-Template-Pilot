import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell flex min-h-screen flex-col gap-4 lg:flex-row lg:gap-5">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-6">{children}</main>
    </div>
  );
}
