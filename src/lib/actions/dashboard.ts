import { and, count, eq, gte } from "drizzle-orm";
import { listSesTemplates } from "@/lib/actions/templates";
import { db } from "@/lib/db";
import { getRequiredUserOrg } from "@/lib/org";
import { sentEmails } from "@/lib/schema";
import { getSesSendingQuota } from "@/lib/ses-quota";
import { getServerSessionUser } from "@/lib/server-auth";

const SEND_RATE_HEADROOM = 0.9;
const DEFAULT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function toRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function toUtcDayStart(input: Date) {
  return Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
}

function createEmptyPoint(timestamp: number): DeliverabilitySeriesPoint {
  return {
    timestamp: new Date(timestamp).toISOString(),
    sent: 0,
    delivered: 0,
    complaints: 0,
    bounces: 0,
    transientBounces: 0,
    permanentBounces: 0,
    opens: 0,
    clicks: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0
  };
}

async function getWebhookDeliverabilitySnapshot(
  organizationId: string,
  windowDays = DEFAULT_WINDOW_DAYS
) {
  const safeWindowDays = Math.max(1, Math.min(30, windowDays));
  const now = new Date();
  const endDay = toUtcDayStart(now);
  const startDay = endDay - (safeWindowDays - 1) * DAY_MS;

  const rows = await db
    .select({
      status: sentEmails.status,
      timestamp: sentEmails.timestamp
    })
    .from(sentEmails)
    .where(
      and(
        eq(sentEmails.organizationId, organizationId),
        gte(sentEmails.timestamp, new Date(startDay))
      )
    );

  const pointsByDay = new Map<number, DeliverabilitySeriesPoint>();
  for (let offset = 0; offset < safeWindowDays; offset += 1) {
    const dayStart = startDay + offset * DAY_MS;
    pointsByDay.set(dayStart, createEmptyPoint(dayStart));
  }

  for (const row of rows) {
    const status = (row.status ?? "").trim().toUpperCase();
    const eventTime = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp);
    const dayStart = toUtcDayStart(eventTime);
    if (!pointsByDay.has(dayStart)) {
      continue;
    }

    const point = pointsByDay.get(dayStart)!;
    if (status === "SENT") {
      point.sent += 1;
      continue;
    }
    if (status === "DELIVERED") {
      point.delivered += 1;
      continue;
    }
    if (status === "COMPLAINT") {
      point.complaints += 1;
      continue;
    }
    if (status === "BOUNCE") {
      point.bounces += 1;
      continue;
    }
    if (status === "TRANSIENT_BOUNCE") {
      point.transientBounces += 1;
      point.bounces += 1;
      continue;
    }
    if (status === "PERMANENT_BOUNCE") {
      point.permanentBounces += 1;
      point.bounces += 1;
      continue;
    }
    if (status === "OPEN") {
      point.opens += 1;
      continue;
    }
    if (status === "CLICK") {
      point.clicks += 1;
    }
  }

  const series = Array.from(pointsByDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, point]) => ({
      ...point,
      deliveryRate: toRate(point.delivered, point.sent),
      openRate: toRate(point.opens, point.delivered),
      clickRate: toRate(point.clicks, point.delivered)
    }));

  const totals = series.reduce(
    (acc, point) => {
      acc.sent += point.sent;
      acc.delivered += point.delivered;
      acc.complaints += point.complaints;
      acc.bounces += point.bounces;
      acc.transientBounces += point.transientBounces;
      acc.permanentBounces += point.permanentBounces;
      acc.opens += point.opens;
      acc.clicks += point.clicks;
      return acc;
    },
    {
      sent: 0,
      delivered: 0,
      complaints: 0,
      bounces: 0,
      transientBounces: 0,
      permanentBounces: 0,
      opens: 0,
      clicks: 0
    }
  );

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

  return snapshot;
}

export async function getDashboardStats() {
  const user = await getServerSessionUser();
  if (!user) {
    return {
      totalEmailsSent: 0,
      totalSesTemplates: 0,
      sesError: "Unauthorized",
      sesQuota: null,
      deliverability: null,
      deliverabilityError: "Unauthorized"
    };
  }
  const org = await getRequiredUserOrg(user.id);

  const [emailCount] = await db
    .select({ value: count() })
    .from(sentEmails)
    .where(
      and(
        eq(sentEmails.organizationId, org.organizationId),
        eq(sentEmails.status, "SENT")
      )
    );
  const [sesTemplates, sesQuotaResult, deliverability] = await Promise.all([
    listSesTemplates(),
    getSesSendingQuota(user.id, { useCache: true }),
    getWebhookDeliverabilitySnapshot(org.organizationId, DEFAULT_WINDOW_DAYS)
  ]);

  const sesError = sesTemplates.success
    ? sesQuotaResult.success
      ? null
      : sesQuotaResult.error
    : sesTemplates.error;

  const sesQuota = sesQuotaResult.success
    ? {
        ...sesQuotaResult.data,
        effectiveThrottleRate: Number(
          (sesQuotaResult.data.maxSendRate * SEND_RATE_HEADROOM).toFixed(2)
        )
      }
    : null;

  return {
    totalEmailsSent: emailCount?.value ?? 0,
    totalSesTemplates: sesTemplates.data.length,
    sesError,
    sesQuota,
    deliverability,
    deliverabilityError: null
  };
}
