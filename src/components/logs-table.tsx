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

type LogRow = {
  id: number;
  recipient: string;
  templateUsed: string;
  status: string;
  messageId: string | null;
  timestamp: Date;
};

type LogsTableProps = {
  logs: LogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function statusColor(status: string): "success" | "danger" | "warning" | "default" {
  if (status === "SENT") {
    return "success";
  }
  if (status === "FAILED") {
    return "danger";
  }
  if (status === "QUEUED") {
    return "warning";
  }
  return "default";
}

function buildLogsPageHref(page: number) {
  return page <= 1 ? "/logs" : `/logs?page=${page}`;
}

export function LogsTable({
  logs,
  page,
  pageSize,
  total,
  totalPages
}: LogsTableProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(total, page * pageSize);

  return (
    <Card className="panel rounded-2xl">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Delivery History</p>
          <h1 className="text-xl font-semibold">Sent Logs</h1>
        </div>
        <p className="text-xs text-slate-300">
          Showing {from}-{to} of {total}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <Table aria-label="Sent emails table" removeWrapper>
          <TableHeader>
            <TableColumn>RECIPIENT</TableColumn>
            <TableColumn>TEMPLATE</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>MESSAGE ID</TableColumn>
            <TableColumn>TIMESTAMP</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No sent emails logged yet.">
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.recipient}</TableCell>
                <TableCell>{log.templateUsed}</TableCell>
                <TableCell>
                  <Chip color={statusColor(log.status)} size="sm" variant="flat">
                    {log.status}
                  </Chip>
                </TableCell>
                <TableCell>{log.messageId ?? "-"}</TableCell>
                <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between gap-3">
          <Button
            as={Link}
            href={buildLogsPageHref(page - 1)}
            isDisabled={page <= 1}
            type="button"
            variant="flat"
          >
            Previous
          </Button>
          <p className="text-xs text-slate-300">
            Page {page} / {totalPages}
          </p>
          <Button
            as={Link}
            href={buildLogsPageHref(page + 1)}
            isDisabled={page >= totalPages}
            type="button"
            variant="flat"
          >
            Next
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
