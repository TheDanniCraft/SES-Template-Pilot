"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow
} from "@heroui/react";
import { Plus, RefreshCw } from "lucide-react";

type TemplateRow = {
  id: string;
  href: string;
  name: string;
  subject: string;
  createdAt: string | null;
  source: "local" | "ses" | "synced";
};

type TemplatesTableProps = {
  templates: TemplateRow[];
  success: boolean;
  error?: string;
};

export function TemplatesTable({ templates, success, error }: TemplatesTableProps) {
  const router = useRouter();
  const [isRefreshing, startRefreshing] = useTransition();

  const formatCreatedAt = (value: string | null) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
  };

  const onReloadFromSes = () => {
    startRefreshing(() => {
      router.refresh();
    });
  };

  return (
    <Card className="panel rounded-2xl">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Templates</p>
          <h1 className="text-xl font-semibold">Template Library</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            isLoading={isRefreshing}
            startContent={!isRefreshing ? <RefreshCw className="h-4 w-4" /> : undefined}
            variant="flat"
            onPress={onReloadFromSes}
          >
            Reload from SES
          </Button>
          <Button
            as={Link}
            color="primary"
            href="/app/templates/new"
            startContent={<Plus className="h-4 w-4" />}
            variant="shadow"
          >
            Create Template
          </Button>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <Table aria-label="SES templates table" removeWrapper>
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>SUBJECT</TableColumn>
            <TableColumn>SOURCE</TableColumn>
            <TableColumn>CREATED AT</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              success
                ? "No templates found yet. Create one or save a local draft."
                : `Failed to load SES templates: ${error}`
            }
          >
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <Link className="font-medium text-cyan-300 hover:underline" href={template.href}>
                    {template.name || "-"}
                  </Link>
                </TableCell>
                <TableCell>{template.subject || "-"}</TableCell>
                <TableCell>
                  <Chip
                    color={
                      template.source === "local"
                        ? "warning"
                        : template.source === "synced"
                          ? "success"
                          : "default"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {template.source === "local"
                      ? "Local draft"
                      : template.source === "synced"
                        ? "SES + local"
                        : "SES only"}
                  </Chip>
                </TableCell>
                <TableCell>
                  {formatCreatedAt(template.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Chip variant="flat">Click a template name to open the editor.</Chip>
      </CardBody>
    </Card>
  );
}
