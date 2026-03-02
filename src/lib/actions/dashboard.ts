import { count } from "drizzle-orm";
import { listSesTemplates } from "@/lib/actions/templates";
import { db } from "@/lib/db";
import { sentEmails } from "@/lib/schema";
import { getSesDeliverabilitySnapshot } from "@/lib/ses-deliverability";
import { getSesSendingQuota } from "@/lib/ses-quota";
import { isServerSessionAuthenticated } from "@/lib/server-auth";

const SEND_RATE_HEADROOM = 0.9;

export async function getDashboardStats() {
  if (!(await isServerSessionAuthenticated())) {
    return {
      totalEmailsSent: 0,
      totalSesTemplates: 0,
      sesError: "Unauthorized",
      sesQuota: null,
      deliverability: null,
      deliverabilityError: "Unauthorized"
    };
  }

  const [emailCount] = await db.select({ value: count() }).from(sentEmails);
  const [sesTemplates, sesQuotaResult, deliverabilityResult] = await Promise.all([
    listSesTemplates(),
    getSesSendingQuota(),
    getSesDeliverabilitySnapshot(7)
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

  const deliverability = deliverabilityResult.success
    ? deliverabilityResult.data
    : null;
  const deliverabilityError = deliverabilityResult.success
    ? null
    : deliverabilityResult.error;

  return {
    totalEmailsSent: emailCount?.value ?? 0,
    totalSesTemplates: sesTemplates.data.length,
    sesError,
    sesQuota,
    deliverability,
    deliverabilityError
  };
}
