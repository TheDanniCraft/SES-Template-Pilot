import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
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

  const [totalResult] = await db
    .select({ value: count() })
    .from(sentEmails)
    .where(eq(sentEmails.userId, user.id));
  const total = totalResult?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const boundedPage = Math.min(safePage, totalPages);
  const offset = (boundedPage - 1) * safePageSize;

  const logs = await db
    .select()
    .from(sentEmails)
    .where(eq(sentEmails.userId, user.id))
    .orderBy(desc(sentEmails.timestamp))
    .limit(safePageSize)
    .offset(offset);

  return {
    logs,
    total,
    page: boundedPage,
    pageSize: safePageSize,
    totalPages
  };
}
