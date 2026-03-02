import { BrandKitsManager } from "@/components/brand-kits-manager";
import { listBrandKits } from "@/lib/brand-kits-store";

export const dynamic = "force-dynamic";

export default async function BrandKitsPage() {
  const kits = await listBrandKits();
  return <BrandKitsManager initialKits={kits} />;
}
