import { GetSendQuotaCommand } from "@aws-sdk/client-ses";
import { unstable_cache } from "next/cache";
import { getUserSesClients } from "@/lib/user-ses";

export type SesSendingQuota = {
  max24HourSend: number;
  maxSendRate: number;
  sentLast24Hours: number;
  remaining24HourSend: number;
};

const ONE_DAY_SECONDS = 60 * 60 * 24;

async function fetchSesSendingQuota(userId: string) {
  const ses = await getUserSesClients(userId);
  if (!ses.success) {
    return {
      success: false as const,
      error: ses.error,
      data: null
    };
  }

  try {
    const response = await ses.data.sesClient.send(new GetSendQuotaCommand({}));

    const max24HourSend = Number(response.Max24HourSend ?? 0);
    const maxSendRate = Number(response.MaxSendRate ?? 0);
    const sentLast24Hours = Number(response.SentLast24Hours ?? 0);
    const remaining24HourSend = Math.max(0, max24HourSend - sentLast24Hours);

    return {
      success: true as const,
      data: {
        max24HourSend,
        maxSendRate,
        sentLast24Hours,
        remaining24HourSend
      }
    };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch SES sending quota",
      data: null
    };
  }
}

const getCachedSesSendingQuota = unstable_cache(
  async (userId: string) => fetchSesSendingQuota(userId),
  ["ses-sending-quota"],
  {
    revalidate: ONE_DAY_SECONDS
  }
);

export async function getSesSendingQuota(
  userId: string,
  options?: { useCache?: boolean }
) {
  if (options?.useCache) {
    return getCachedSesSendingQuota(userId);
  }
  return fetchSesSendingQuota(userId);
}

