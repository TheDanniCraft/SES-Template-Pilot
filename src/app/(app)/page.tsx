import { DashboardOverview } from "@/components/dashboard-overview";
import { getDashboardStats } from "@/lib/actions/dashboard";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return <DashboardOverview {...stats} />;
}
