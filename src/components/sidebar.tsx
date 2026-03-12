"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem
} from "@heroui/react";
import {
  BarChart3,
  BookUser,
  Brush,
  Cog,
  FileText,
  LayoutDashboard,
  Building2,
  Plus,
  Send,
  ShieldCheck
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import {
  createOrganizationAction,
  switchActiveOrganizationAction
} from "@/lib/actions/organization";
import { toast } from "sonner";

const primaryNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/templates", label: "Templates", icon: FileText },
  { href: "/app/brand-kits", label: "Brand Kits", icon: Brush },
  { href: "/app/contact-books", label: "Contact Books", icon: BookUser },
  { href: "/app/send", label: "Bulk Send", icon: Send },
  { href: "/app/logs", label: "Sent Logs", icon: BarChart3 }
];

const secondaryNavItems = [
  { href: "/app/settings", label: "Settings", icon: Cog },
  { href: "/app/organization", label: "Manage Org", icon: Building2 }
];

type SidebarProps = {
  activeOrganizationId: string;
  canCreateOrganizations: boolean;
  currentUserEmail: string;
  hasActiveLicense: boolean;
  organizations: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
  }>;
};

export function Sidebar({
  activeOrganizationId,
  canCreateOrganizations,
  currentUserEmail,
  hasActiveLicense,
  organizations
}: SidebarProps) {
  const [isPending, startTransition] = useTransition();
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const orgOptions = useMemo(
    () => [
      ...organizations.map((org) => ({
        organizationId: org.organizationId,
        organizationName: org.organizationName
      })),
      ...(canCreateOrganizations
        ? [
            {
              organizationId: "__create__",
              organizationName: "Create organization"
            }
          ]
        : [])
    ],
    [canCreateOrganizations, organizations]
  );
  const isActivePath = (href: string) => {
    if (href === "/app") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <Card className="panel w-full lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:max-w-[280px]">
      <CardBody className="flex flex-col gap-4 p-4">
        <Select
          disallowEmptySelection
          items={orgOptions}
          isDisabled={isPending}
          label="Organization"
          selectedKeys={new Set([activeOrganizationId])}
          size="sm"
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            if (!selected || typeof selected !== "string") {
              return;
            }
            if (selected === "__create__") {
              if (!canCreateOrganizations) {
                return;
              }
              setIsCreateOrgModalOpen(true);
              return;
            }
            if (selected === activeOrganizationId) {
              return;
            }
            startTransition(async () => {
              const result = await switchActiveOrganizationAction({
                organizationId: selected
              });
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {(org) => (
            <SelectItem
              key={org.organizationId}
              startContent={
                org.organizationId === "__create__" ? <Plus className="h-4 w-4" /> : undefined
              }
            >
              {org.organizationName}
            </SelectItem>
          )}
        </Select>

        <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/8 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <p className="text-sm font-semibold">SES Template Pilot</p>
          </div>
          <p className="mt-1 text-xs text-gray-300">Template design, sending, and delivery operations</p>
          <p className="mt-2 break-all text-[11px] text-cyan-200/90">{currentUserEmail}</p>
        </div>
        {!hasActiveLicense ? (
          <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-xs text-amber-100">
            <p className="font-semibold">Read-only mode</p>
            <p className="mt-1 text-amber-100/85">
              License is not active. Viewing is allowed. Activate to unlock full access.
            </p>
            <Button
              as={Link}
              className="mt-2 w-full"
              color="warning"
              href="/activate"
              size="sm"
              variant="flat"
            >
              Activate License
            </Button>
          </div>
        ) : null}

        <nav className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {primaryNavItems.map(({ href, icon: Icon, label }) => (
            <Link
              className={`flex min-w-[142px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition lg:min-w-0 ${
                isActivePath(href)
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

        <div className="space-y-2 border-t border-white/10 pt-3">
          {secondaryNavItems.map(({ href, icon: Icon, label }) => (
            <Link
              className={`flex min-w-[142px] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm transition lg:min-w-0 ${
                isActivePath(href)
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
        </div>

        <form action={logoutAction}>
          <Button className="w-full" color="danger" type="submit" variant="flat">
            Logout
          </Button>
        </form>
      </CardBody>

      <Modal isOpen={isCreateOrgModalOpen} onOpenChange={setIsCreateOrgModalOpen}>
        <ModalContent>
          <ModalHeader>Create Organization</ModalHeader>
          <ModalBody>
            <Input
              autoFocus
              isDisabled={isPending}
              label="Organization Name"
              placeholder="Acme Team"
              value={newOrgName}
              onValueChange={setNewOrgName}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => {
                setIsCreateOrgModalOpen(false);
                setNewOrgName("");
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={isPending || newOrgName.trim().length < 2}
              isLoading={isPending}
              onPress={() => {
                startTransition(async () => {
                  const result = await createOrganizationAction({
                    name: newOrgName
                  });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  setNewOrgName("");
                  setIsCreateOrgModalOpen(false);
                  toast.success("Organization created");
                  router.refresh();
                });
              }}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
