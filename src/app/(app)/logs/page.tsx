import { LogsTable } from "@/components/logs-table";
import { getSentLogs } from "@/lib/actions/logs";

type LogsPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const { page } = await searchParams;
  const parsedPage = Number.parseInt(page ?? "1", 10);
  const currentPage = Number.isNaN(parsedPage) ? 1 : parsedPage;

  const result = await getSentLogs(currentPage);

  return (
    <LogsTable
      logs={result.logs}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
      totalPages={result.totalPages}
    />
  );
}
