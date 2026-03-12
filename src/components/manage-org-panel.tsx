"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Snippet,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip
} from "@heroui/react";
import { toast } from "sonner";
import { createInviteLinkAction } from "@/lib/actions/auth";
import { Clock3, Eye, Trash2, UserPlus } from "lucide-react";
import {
  deletePendingInviteAction,
  deactivateOrganizationLicenseAction,
  getPendingInviteLinkAction,
  removeOrganizationMemberAction,
  updateOrganizationNameAction
} from "@/lib/actions/organization";

type OrgMember = {
  role: string;
  userEmail: string;
  userId: string;
};

type ManageOrgPanelProps = {
  canManage: boolean;
  currentUserId: string;
  initialName: string;
  licenseStatus: string | null;
  members: OrgMember[];
  pendingInvites: Array<{
    inviteId: string;
    email: string;
  }>;
};

export function ManageOrgPanel({
  canManage,
  currentUserId,
  initialName,
  licenseStatus,
  members,
  pendingInvites
}: ManageOrgPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [inviteMode, setInviteMode] = useState<"create" | "view">("create");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === "owner" ? -1 : 1;
        }
        return a.userEmail.localeCompare(b.userEmail);
      }),
    [members]
  );
  const tableRows = useMemo(
    () => [
      ...sortedMembers.map((member) => ({
        id: `member:${member.userId}`,
        kind: "member" as const,
        email: member.userEmail,
        role: member.role,
        userId: member.userId
      })),
      ...pendingInvites.map((invite) => ({
        id: `pending:${invite.inviteId}`,
        kind: "pending" as const,
        email: invite.email,
        role: "member",
        inviteId: invite.inviteId
      }))
    ],
    [pendingInvites, sortedMembers]
  );

  return (
    <div className="space-y-4">
      <Card className="panel rounded-2xl">
        <CardHeader>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Organization</p>
            <h2 className="text-lg font-semibold">Profile & License</h2>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            isDisabled={!canManage || isPending}
            label="Organization Name"
            value={name}
            onValueChange={setName}
          />
          <Button
            color="primary"
            isDisabled={!canManage || name.trim().length < 2}
            isLoading={isPending}
            onPress={() => {
              startTransition(async () => {
                const result = await updateOrganizationNameAction({ name });
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Organization updated");
              });
            }}
          >
            Save Name
          </Button>

          <div className="mt-2 rounded-xl border border-white/10 p-3">
            <p className="text-sm text-slate-200">
              Current license status:{" "}
              <span className="font-semibold">{licenseStatus ?? "none"}</span>
            </p>
            <Button
              className="mt-2"
              color="danger"
              isDisabled={!canManage}
              isLoading={isPending}
              size="sm"
              variant="flat"
              onPress={() => {
                startTransition(async () => {
                  const result = await deactivateOrganizationLicenseAction();
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("License deactivated");
                });
              }}
            >
              Deactivate License
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="panel rounded-2xl w-full">
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Members</p>
            <h2 className="text-lg font-semibold">Users & Invites</h2>
          </div>
          <Button
            color="primary"
            isDisabled={!canManage}
            startContent={<UserPlus className="h-4 w-4" />}
            onPress={() => {
              setInviteMode("create");
              setInviteEmail("");
              setInviteUrl("");
              setIsInviteModalOpen(true);
            }}
          >
            Invite User
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          <Table aria-label="Organization members">
            <TableHeader>
              <TableColumn>User</TableColumn>
              <TableColumn>Role</TableColumn>
              <TableColumn>Action</TableColumn>
            </TableHeader>
            <TableBody items={tableRows}>
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.kind === "pending" ? (
                      <span className="inline-flex items-center gap-2 text-warning-300">
                        <Clock3 className="h-4 w-4" />
                        {row.email}
                      </span>
                    ) : (
                      row.email
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {row.role}
                  </TableCell>
                  <TableCell>
                    {row.kind === "member" ? (
                      canManage && row.userId !== currentUserId ? (
                        <Tooltip content="Remove user">
                          <Button
                            isIconOnly
                            color="danger"
                            isLoading={isPending}
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              startTransition(async () => {
                                const result = await removeOrganizationMemberAction({
                                  userId: row.userId
                                });
                                if (!result.success) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success("User removed");
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )
                    ) : canManage ? (
                      <div className="flex gap-2">
                        <Tooltip content="View invite link">
                          <Button
                            isIconOnly
                            isLoading={isPending}
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              startTransition(async () => {
                                const result = await getPendingInviteLinkAction({
                                  inviteId: row.inviteId
                                });
                                if (!result.success) {
                                  toast.error(result.error);
                                  return;
                                }
                                setInviteMode("view");
                                setInviteUrl(result.inviteUrl ?? "");
                                setInviteEmail(row.email);
                                setIsInviteModalOpen(true);
                              });
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Delete invite">
                          <Button
                            isIconOnly
                            color="danger"
                            isLoading={isPending}
                            size="sm"
                            variant="flat"
                            onPress={() => {
                              startTransition(async () => {
                                const result = await deletePendingInviteAction({
                                  inviteId: row.inviteId
                                });
                                if (!result.success) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success("Pending invite deleted");
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <ModalContent>
          <ModalHeader>Invite User</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              isDisabled={!canManage || isPending || inviteMode === "view"}
              label="User Email"
              placeholder="teammate@example.com"
              type="email"
              value={inviteEmail}
              onValueChange={setInviteEmail}
            />
            {inviteUrl ? (
              <div className="flex-1 overflow-hidden">
                <Snippet
                  className="w-full max-w-full"
                  classNames={{
                    pre: "overflow-hidden whitespace-nowrap"
                  }}
                  hideCopyButton={false}
                  symbol=""
                  variant="flat"
                >
                  {inviteUrl}
                </Snippet>
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => {
                setInviteEmail("");
                setInviteUrl("");
                setInviteMode("create");
                setIsInviteModalOpen(false);
              }}
            >
              Close
            </Button>
            {inviteMode === "create" ? (
              <Button
                color="primary"
                isDisabled={!canManage || inviteEmail.trim().length < 5}
                isLoading={isPending}
                onPress={() => {
                  startTransition(async () => {
                    const result = await createInviteLinkAction({ email: inviteEmail });
                    if (!result.success) {
                      toast.error(result.error);
                      return;
                    }
                    setInviteUrl(result.inviteUrl ?? "");
                    toast.success("Invite link created");
                  });
                }}
              >
                Create Invite
              </Button>
            ) : null}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
