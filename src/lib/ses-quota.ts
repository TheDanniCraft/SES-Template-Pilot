import { GetSendQuotaCommand } from "@aws-sdk/client-ses";
import { sesClient } from "@/lib/aws-ses";

export type SesSendingQuota = {
  max24HourSend: number;
  maxSendRate: number;
  sentLast24Hours: number;
  remaining24HourSend: number;
};

export async function getSesSendingQuota() {
  try {
    const response = await sesClient.send(new GetSendQuotaCommand({}));

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

