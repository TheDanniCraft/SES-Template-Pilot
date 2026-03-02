import { GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { cloudWatchClient } from "@/lib/aws-cloudwatch";

type DeliverabilitySnapshot = {
  windowDays: number;
  sent: number;
  delivered: number;
  complaints: number;
  bounces: number;
  transientBounces: number;
  permanentBounces: number;
  opens: number;
  clicks: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  series: DeliverabilitySeriesPoint[];
};

const METRIC_CONFIG = [
  { id: "m_sent", key: "sent", metricName: "Send", dimensions: undefined },
  {
    id: "m_delivered",
    key: "delivered",
    metricName: "Delivery",
    dimensions: undefined
  },
  {
    id: "m_complaints",
    key: "complaints",
    metricName: "Complaint",
    dimensions: undefined
  },
  {
    id: "m_transient_bounces",
    key: "transientBounces",
    metricName: "Bounce",
    dimensions: [{ Name: "BounceType", Value: "Transient" }]
  },
  {
    id: "m_permanent_bounces",
    key: "permanentBounces",
    metricName: "Bounce",
    dimensions: [{ Name: "BounceType", Value: "Permanent" }]
  },
  {
    id: "m_bounces",
    key: "bounces",
    metricName: "Bounce",
    dimensions: undefined
  },
  { id: "m_opens", key: "opens", metricName: "Open", dimensions: undefined },
  { id: "m_clicks", key: "clicks", metricName: "Click", dimensions: undefined }
] as Array<{
  id: string;
  key:
    | "sent"
    | "delivered"
    | "complaints"
    | "bounces"
    | "transientBounces"
    | "permanentBounces"
    | "opens"
    | "clicks";
  metricName: "Send" | "Delivery" | "Complaint" | "Bounce" | "Open" | "Click";
  dimensions?: Array<{ Name: string; Value: string }>;
}>;

type DeliverabilitySeriesPoint = {
  timestamp: string;
  sent: number;
  delivered: number;
  complaints: number;
  bounces: number;
  transientBounces: number;
  permanentBounces: number;
  opens: number;
  clicks: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
};

function sumValues(values: Array<number | undefined> | undefined) {
  if (!values || values.length === 0) {
    return 0;
  }

  let total = 0;
  for (const value of values) {
    total += value ?? 0;
  }
  return total;
}

function toRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export async function getSesDeliverabilitySnapshot(windowDays = 7) {
  const safeWindowDays = Math.max(1, Math.min(30, windowDays));
  const periodSeconds = 24 * 60 * 60;
  const periodMs = periodSeconds * 1000;
  const endMs = Math.floor(Date.now() / (60 * 60 * 1000)) * (60 * 60 * 1000);
  const end = new Date(endMs);
  const start = new Date(endMs - safeWindowDays * periodMs);

  try {
    const response = await cloudWatchClient.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        ScanBy: "TimestampAscending",
        MetricDataQueries: METRIC_CONFIG.map((metric) => ({
          Id: metric.id,
          ReturnData: true,
          MetricStat: {
            Metric: {
              Namespace: "AWS/SES",
              MetricName: metric.metricName,
              Dimensions: metric.dimensions
            },
            Period: periodSeconds,
            Stat: "Sum"
          }
        }))
      })
    );

    const resultById = new Map(
      (response.MetricDataResults ?? []).map((result) => [result.Id, result])
    );

    const totals = Object.fromEntries(
      METRIC_CONFIG.map((metric) => {
        const metricResult = resultById.get(metric.id);
        return [metric.key, Math.round(sumValues(metricResult?.Values))];
      })
    ) as Record<(typeof METRIC_CONFIG)[number]["key"], number>;

    const seriesByMetric: Partial<
      Record<(typeof METRIC_CONFIG)[number]["key"], Map<number, number>>
    > = {};
    for (const metric of METRIC_CONFIG) {
      const metricResult = resultById.get(metric.id);
      const timestamps = metricResult?.Timestamps ?? [];
      const values = metricResult?.Values ?? [];
      const map = new Map<number, number>();
      for (let index = 0; index < timestamps.length; index += 1) {
        const timestamp = timestamps[index];
        const value = values[index];
        if (!timestamp) {
          continue;
        }
        map.set(new Date(timestamp).getTime(), Number(value ?? 0));
      }
      seriesByMetric[metric.key] = map;
    }

    const fallbackTimestamps: number[] = [];
    for (let day = safeWindowDays - 1; day >= 0; day -= 1) {
      fallbackTimestamps.push(endMs - day * periodMs);
    }

    const allTimestamps = new Set<number>(fallbackTimestamps);
    Object.values(seriesByMetric).forEach((metricMap) => {
      metricMap?.forEach((_value, timestamp) => {
        allTimestamps.add(timestamp);
      });
    });

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    const series: DeliverabilitySeriesPoint[] = sortedTimestamps.map((timestamp) => {
      const sent = Math.round(seriesByMetric.sent?.get(timestamp) ?? 0);
      const delivered = Math.round(seriesByMetric.delivered?.get(timestamp) ?? 0);
      const complaints = Math.round(seriesByMetric.complaints?.get(timestamp) ?? 0);
      const bounces = Math.round(seriesByMetric.bounces?.get(timestamp) ?? 0);
      const transientBounces = Math.round(
        seriesByMetric.transientBounces?.get(timestamp) ?? 0
      );
      const permanentBounces = Math.round(
        seriesByMetric.permanentBounces?.get(timestamp) ?? 0
      );
      const opens = Math.round(seriesByMetric.opens?.get(timestamp) ?? 0);
      const clicks = Math.round(seriesByMetric.clicks?.get(timestamp) ?? 0);

      return {
        timestamp: new Date(timestamp).toISOString(),
        sent,
        delivered,
        complaints,
        bounces,
        transientBounces,
        permanentBounces,
        opens,
        clicks,
        deliveryRate: toRate(delivered, sent),
        openRate: toRate(opens, delivered),
        clickRate: toRate(clicks, delivered)
      };
    });

    const snapshot: DeliverabilitySnapshot = {
      windowDays: safeWindowDays,
      sent: totals.sent,
      delivered: totals.delivered,
      complaints: totals.complaints,
      bounces: totals.bounces,
      transientBounces: totals.transientBounces,
      permanentBounces: totals.permanentBounces,
      opens: totals.opens,
      clicks: totals.clicks,
      deliveryRate: toRate(totals.delivered, totals.sent),
      openRate: toRate(totals.opens, totals.delivered),
      clickRate: toRate(totals.clicks, totals.delivered),
      series
    };

    return {
      success: true as const,
      data: snapshot
    };
  } catch (error) {
    const rawMessage =
      error instanceof Error
        ? error.message
        : "Failed to fetch SES deliverability metrics";
    const lowered = rawMessage.toLowerCase();
    const friendlyMessage =
      lowered.includes("cloudwatch:getmetricdata") &&
      lowered.includes("not authorized")
        ? "Missing CloudWatch permission: cloudwatch:GetMetricData"
        : rawMessage;

    return {
      success: false as const,
      error: friendlyMessage,
      data: null
    };
  }
}
