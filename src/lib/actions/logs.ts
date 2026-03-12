import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { sentEmails } from "@/lib/schema";
import { getServerSessionUser } from "@/lib/server-auth";

export const LOGS_PAGE_SIZE = 50;

export async function getSentLogs(page = 1, pageSize = LOGS_PAGE_SIZE) {
  const safePageSize = Math.max(1, Math.min(200, pageSize));
  const safePage = Math.max(1, page);

  const user = await getServerSessionUser();
  if (!user) {
    return {
      logs: [],
      total: 0,
      page: 1,
      pageSize: safePageSize,
      totalPages: 1
    };
  }
  const org = await getRequiredUserOrg(user.id);

  const rows = await db
    .select()
    .from(sentEmails)
    .where(eq(sentEmails.organizationId, org.organizationId))
    .orderBy(desc(sentEmails.timestamp), desc(sentEmails.id));

  const seenMessageIds = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = (row.messageId ?? "").trim();
    if (!key) {
      return true;
    }
    if (seenMessageIds.has(key)) {
      return false;
    }
    seenMessageIds.add(key);
    return true;
  });

  const total = deduped.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const boundedPage = Math.min(safePage, totalPages);
  const offset = (boundedPage - 1) * safePageSize;
  const logs = deduped.slice(offset, offset + safePageSize);

  return {
    logs,
    total,
    page: boundedPage,
    pageSize: safePageSize,
    totalPages
  };
}

export async function getSentLogHistory(messageId: string) {
  const user = await getServerSessionUser();
  if (!user) {
    return null;
  }
  const org = await getRequiredUserOrg(user.id);
  const normalized = messageId.trim();
  if (!normalized) {
    return null;
  }

  const rows = await db
    .select()
    .from(sentEmails)
    .where(
      and(
        eq(sentEmails.organizationId, org.organizationId),
        eq(sentEmails.messageId, normalized)
      )
    )
    .orderBy(desc(sentEmails.timestamp));
  if (rows.length === 0) {
    return null;
  }

  return {
    messageId: normalized,
    rows
  };
}
