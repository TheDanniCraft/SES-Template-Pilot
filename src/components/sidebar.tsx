"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Card, CardBody } from "@heroui/react";
import {
  BarChart3,
  BookUser,
  FileText,
  LayoutDashboard,
  Palette,
  Send,
  ShieldCheck
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/contact-books", label: "Contact Books", icon: BookUser },
  { href: "/send", label: "Bulk Send", icon: Send },
  { href: "/logs", label: "Sent Logs", icon: BarChart3 }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <Card className="panel w-full lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:max-w-[280px]">
      <CardBody className="flex flex-col gap-4 p-4">
        <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/8 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <p className="text-sm font-semibold">SES Template Pilot</p>
          </div>
          <p className="mt-1 text-xs text-gray-300">Template design, sending, and delivery operations</p>
        </div>

        <nav className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              className={`flex min-w-[142px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition lg:min-w-0 ${
                pathname === href
                  ? "border-cyan-300/60 bg-cyan-500/16 text-cyan-50"
                  : "border-white/10 bg-white/0 text-white/85 hover:border-cyan-500/60 hover:bg-cyan-500/10"
              }`}
              key={href}
              href={href}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <form action={logoutAction}>
          <Button
            as={Link}
            className="mb-2 w-full"
            color="primary"
            href="/brand-kits"
            startContent={<Palette className="h-4 w-4" />}
            variant="flat"
          >
            Manage Brand Kits
          </Button>
          <Button className="w-full" color="danger" type="submit" variant="flat">
            Logout
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
