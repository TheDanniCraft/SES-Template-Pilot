"use client";

import Link from "next/link";
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
import { Plus } from "lucide-react";

type TemplateRow = {
  name: string;
  subject: string;
  createdAt: Date | null;
};

type TemplatesTableProps = {
  templates: TemplateRow[];
  success: boolean;
  error?: string;
};

export function TemplatesTable({ templates, success, error }: TemplatesTableProps) {
  return (
    <Card className="panel rounded-2xl">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Templates</p>
          <h1 className="text-xl font-semibold">Template Library</h1>
        </div>
        <Button
          as={Link}
          color="primary"
          href="/templates/new"
          startContent={<Plus className="h-4 w-4" />}
          variant="shadow"
        >
          Create Template
        </Button>
      </CardHeader>

      <CardBody className="space-y-4">
        <Table aria-label="SES templates table" removeWrapper>
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>SUBJECT</TableColumn>
            <TableColumn>CREATED AT</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              success ? "No templates found in SES." : `Failed to load SES templates: ${error}`
            }
          >
            {templates.map((template) => (
              <TableRow key={template.name}>
                <TableCell>
                  <Link className="font-medium text-cyan-300 hover:underline" href={`/templates/${template.name}`}>
                    {template.name || "-"}
                  </Link>
                </TableCell>
                <TableCell>{template.subject || "-"}</TableCell>
                <TableCell>
                  {template.createdAt ? new Date(template.createdAt).toLocaleString() : "-"}
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
