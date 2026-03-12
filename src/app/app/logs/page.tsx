import { LogsTable } from "@/components/logs-table";
import { getSentLogHistory, getSentLogs } from "@/lib/actions/logs";

type LogsPageProps = {
  searchParams: Promise<{
    page?: string;
    messageId?: string;
  }>;
};

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const { page, messageId } = await searchParams;
  const parsedPage = Number.parseInt(page ?? "1", 10);
  const currentPage = Number.isNaN(parsedPage) ? 1 : parsedPage;

  const [result, history] = await Promise.all([
    getSentLogs(currentPage),
    messageId ? getSentLogHistory(messageId) : Promise.resolve(null)
  ]);

  return (
    <LogsTable
      history={history}
      logs={result.logs}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
      totalPages={result.totalPages}
    />
  );
}
