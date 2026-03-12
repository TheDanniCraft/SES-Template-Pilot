import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/login");
  }

  redirect("/app");
}
