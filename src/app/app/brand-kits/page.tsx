import { BrandKitsManager } from "@/components/brand-kits-manager";
import { listBrandKits } from "@/lib/brand-kits-store";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function BrandKitsPage() {
  const user = await getServerSessionUser();
  const kits = user ? await listBrandKits(user.id) : [];
  return <BrandKitsManager initialKits={kits} />;
}
