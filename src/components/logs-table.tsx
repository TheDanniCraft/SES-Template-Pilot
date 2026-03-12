"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
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
  history: {
    messageId: string;
    rows: LogRow[];
  } | null;
  logs: LogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function statusColor(
  status: string
): "primary" | "success" | "danger" | "warning" | "default" {
  const normalized = status.toUpperCase();
  if (normalized === "SENT") {
    return "primary";
  }
  if (normalized === "DELIVERED") {
    return "success";
  }
  if (normalized === "OPEN" || normalized === "CLICK") {
    return "warning";
  }
  if (
    normalized === "FAILED" ||
    normalized === "BOUNCE" ||
    normalized === "TRANSIENT_BOUNCE" ||
    normalized === "PERMANENT_BOUNCE" ||
    normalized === "COMPLAINT" ||
    normalized === "REJECTED"
  ) {
    return "danger";
  }
  if (normalized === "QUEUED" || normalized === "DELIVERY_DELAY") {
    return "warning";
  }
  return "default";
}

function statusDotClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "DELIVERED") {
    return "bg-success";
  }
  if (normalized === "SENT") {
    return "bg-primary";
  }
  if (
    normalized === "FAILED" ||
    normalized === "BOUNCE" ||
    normalized === "TRANSIENT_BOUNCE" ||
    normalized === "PERMANENT_BOUNCE" ||
    normalized === "COMPLAINT" ||
    normalized === "REJECTED"
  ) {
    return "bg-danger";
  }
  if (normalized === "OPEN" || normalized === "CLICK" || normalized === "DELIVERY_DELAY") {
    return "bg-warning";
  }
  return "bg-default";
}

function buildLogsPageHref(page: number) {
  return page <= 1 ? "/app/logs" : `/app/logs?page=${page}`;
}

function buildHistoryHref(page: number, messageId: string) {
  return `/app/logs?page=${page}&messageId=${encodeURIComponent(messageId)}`;
}

function formatTimestamp(timestamp: Date) {
  const iso = new Date(timestamp).toISOString();
  return iso.replace("T", " ").replace("Z", " UTC");
}

export function LogsTable({
  history,
  logs,
  page,
  pageSize,
  total,
  totalPages
}: LogsTableProps) {
  const router = useRouter();
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
              <TableRow
                key={log.id}
                className={log.messageId ? "cursor-pointer" : ""}
                onClick={() => {
                  if (!log.messageId) {
                    return;
                  }
                  router.push(buildHistoryHref(page, log.messageId));
                }}
              >
                <TableCell>{log.recipient}</TableCell>
                <TableCell>{log.templateUsed}</TableCell>
                <TableCell>
                  <Chip color={statusColor(log.status)} size="sm" variant="flat">
                    {log.status}
                  </Chip>
                </TableCell>
                <TableCell>
                  {log.messageId ? (
                    <Link
                      className="cursor-pointer text-cyan-300 hover:text-cyan-200"
                      href={buildHistoryHref(page, log.messageId)}
                    >
                      {log.messageId}
                    </Link>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
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

      <Drawer
        isOpen={Boolean(history)}
        placement="right"
        classNames={{
          base: "max-w-none w-[min(96vw,980px)]"
        }}
        onOpenChange={(open) => {
          if (!open) {
            router.push(buildLogsPageHref(page));
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Message History</p>
            <p className="break-all text-sm font-semibold">{history?.messageId}</p>
          </DrawerHeader>
          <DrawerBody>
            <ol className="space-y-4">
              {(history?.rows ?? []).map((row, index, rows) => (
                <li key={row.id} className="relative pl-7">
                  <span
                    className={`absolute left-0 top-2 h-3 w-3 rounded-full ${statusDotClass(row.status)}`}
                  />
                  {index < rows.length - 1 ? (
                    <span className="absolute left-[5px] top-5 h-[calc(100%-0.5rem)] w-px bg-white/15" />
                  ) : null}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Chip color={statusColor(row.status)} size="sm" variant="flat">
                        {row.status}
                      </Chip>
                      <p className="text-xs text-slate-300">{formatTimestamp(row.timestamp)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-100">{row.recipient}</p>
                    <p className="text-xs text-slate-400">{row.templateUsed}</p>
                  </div>
                </li>
              ))}
            </ol>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Card>
  );
}
