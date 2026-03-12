import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sentEmails } from "@/lib/schema";

type SnsEnvelope = {
  Type?: string;
  Message?: string;
  SubscribeURL?: string;
};

type SesEvent = {
  eventType?: string;
  notificationType?: string;
  mail?: {
    messageId?: string;
    timestamp?: string;
    destination?: string[];
    commonHeaders?: {
      subject?: string;
    };
    tags?: Record<string, string[] | undefined>;
  };
  delivery?: {
    timestamp?: string;
    recipients?: string[];
  };
  bounce?: {
    timestamp?: string;
    bounceType?: string;
    bouncedRecipients?: Array<{
      emailAddress?: string;
      diagnosticCode?: string;
    }>;
  };
  complaint?: {
    timestamp?: string;
    complaintFeedbackType?: string;
    complainedRecipients?: Array<{
      emailAddress?: string;
    }>;
  };
  open?: {
    timestamp?: string;
  };
  click?: {
    timestamp?: string;
    link?: string;
  };
  reject?: {
    timestamp?: string;
    reason?: string;
  };
  deliveryDelay?: {
    timestamp?: string;
    delayType?: string;
    delayedRecipients?: Array<{
      emailAddress?: string;
      diagnosticCode?: string;
    }>;
  };
  renderingFailure?: {
    timestamp?: string;
    errorMessage?: string;
  };
};

function parseJsonSafe<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function pickTagValue(
  tags: Record<string, string[] | undefined> | undefined,
  key: string
) {
  const value = tags?.[key]?.[0];
  return typeof value === "string" ? value.trim() : "";
}

function mapSesEventStatus(event: SesEvent) {
  const eventType = (event.eventType ?? event.notificationType ?? "").trim().toUpperCase();

  if (eventType === "DELIVERY") {
    return { status: "DELIVERED", error: null as string | null };
  }

  if (eventType === "BOUNCE") {
    const bounceType = (event.bounce?.bounceType ?? "").trim().toUpperCase();
    const diagnostic = event.bounce?.bouncedRecipients?.[0]?.diagnosticCode?.trim() ?? "";
    if (bounceType === "TRANSIENT") {
      return { status: "TRANSIENT_BOUNCE", error: diagnostic || "Transient bounce" };
    }
    if (bounceType === "PERMANENT") {
      return { status: "PERMANENT_BOUNCE", error: diagnostic || "Permanent bounce" };
    }
    return { status: "BOUNCE", error: diagnostic || null };
  }

  if (eventType === "COMPLAINT") {
    return {
      status: "COMPLAINT",
      error: event.complaint?.complaintFeedbackType?.trim() || null
    };
  }

  if (eventType === "OPEN") {
    return { status: "OPEN", error: null as string | null };
  }

  if (eventType === "CLICK") {
    return { status: "CLICK", error: event.click?.link?.trim() || null };
  }

  if (eventType === "REJECT") {
    return { status: "REJECTED", error: event.reject?.reason?.trim() || null };
  }

  if (eventType === "DELIVERYDELAY") {
    const delayedCode = event.deliveryDelay?.delayedRecipients?.[0]?.diagnosticCode?.trim();
    const delayType = event.deliveryDelay?.delayType?.trim();
    return {
      status: "DELIVERY_DELAY",
      error: delayedCode || delayType || null
    };
  }

  if (eventType === "RENDERING FAILURE") {
    return {
      status: "RENDERING_FAILURE",
      error: event.renderingFailure?.errorMessage?.trim() || null
    };
  }

  if (eventType === "SEND") {
    return { status: "SENT", error: null as string | null };
  }

  return {
    status: eventType.replace(/\s+/g, "_") || "UNKNOWN",
    error: null as string | null
  };
}

function extractRecipient(event: SesEvent) {
  const fromDelivery = event.delivery?.recipients?.[0]?.trim();
  if (fromDelivery) {
    return fromDelivery;
  }

  const fromBounce = event.bounce?.bouncedRecipients?.[0]?.emailAddress?.trim();
  if (fromBounce) {
    return fromBounce;
  }

  const fromComplaint = event.complaint?.complainedRecipients?.[0]?.emailAddress?.trim();
  if (fromComplaint) {
    return fromComplaint;
  }

  const fromDelay = event.deliveryDelay?.delayedRecipients?.[0]?.emailAddress?.trim();
  if (fromDelay) {
    return fromDelay;
  }

  const fromMail = event.mail?.destination?.[0]?.trim();
  if (fromMail) {
    return fromMail;
  }

  return "";
}

function extractEventTimestamp(event: SesEvent) {
  const raw =
    event.delivery?.timestamp ??
    event.bounce?.timestamp ??
    event.complaint?.timestamp ??
    event.open?.timestamp ??
    event.click?.timestamp ??
    event.reject?.timestamp ??
    event.deliveryDelay?.timestamp ??
    event.renderingFailure?.timestamp ??
    event.mail?.timestamp ??
    "";

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request) {
  const configuredSecret = process.env.SES_WEBHOOK_SECRET?.trim();
  if (configuredSecret) {
    const providedSecret =
      new URL(request.url).searchParams.get("secret")?.trim() ??
      request.headers.get("x-ses-webhook-secret")?.trim() ??
      "";
    if (!providedSecret || providedSecret !== configuredSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const bodyText = await request.text();
  if (!bodyText.trim()) {
    return NextResponse.json({ success: true, ignored: "empty" });
  }

  const envelope = parseJsonSafe<SnsEnvelope>(bodyText);
  if (!envelope) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
    try {
      await fetch(envelope.SubscribeURL);
      return NextResponse.json({ success: true, confirmed: true });
    } catch {
      return NextResponse.json({ success: true, confirmed: false });
    }
  }

  let sesEvent: SesEvent | null = null;
  if (envelope.Type === "Notification" && typeof envelope.Message === "string") {
    sesEvent = parseJsonSafe<SesEvent>(envelope.Message);
  } else {
    const directEvent = envelope as unknown as SesEvent;
    if (directEvent.eventType || directEvent.notificationType) {
      sesEvent = directEvent;
    }
  }

  if (!sesEvent) {
    return NextResponse.json({ success: true, ignored: envelope.Type ?? "unknown" });
  }

  const messageId = sesEvent.mail?.messageId?.trim() ?? "";
  if (!messageId) {
    return NextResponse.json({ success: true, ignored: "missing-message-id" });
  }

  const [latestByMessageId] = await db
    .select({
      organizationId: sentEmails.organizationId,
      userId: sentEmails.userId,
      recipient: sentEmails.recipient,
      templateUsed: sentEmails.templateUsed
    })
    .from(sentEmails)
    .where(eq(sentEmails.messageId, messageId))
    .orderBy(desc(sentEmails.timestamp))
    .limit(1);

  const taggedOrgId =
    pickTagValue(sesEvent.mail?.tags, "stp_org_id") ||
    pickTagValue(sesEvent.mail?.tags, "stp-org-id");
  const organizationId = taggedOrgId || latestByMessageId?.organizationId || "";
  if (!organizationId) {
    return NextResponse.json({ success: true, ignored: "missing-org-id" });
  }

  const taggedUserId =
    pickTagValue(sesEvent.mail?.tags, "stp_user_id") ||
    pickTagValue(sesEvent.mail?.tags, "stp-user-id");
  const userId = taggedUserId || latestByMessageId?.userId || null;

  const taggedTemplate =
    pickTagValue(sesEvent.mail?.tags, "stp_template") ||
    pickTagValue(sesEvent.mail?.tags, "stp-template");
  const templateUsed =
    taggedTemplate ||
    latestByMessageId?.templateUsed ||
    sesEvent.mail?.commonHeaders?.subject?.trim() ||
    "unknown-template";

  const recipient = extractRecipient(sesEvent) || latestByMessageId?.recipient || "unknown@recipient";
  const { status, error } = mapSesEventStatus(sesEvent);

  const [duplicate] = await db
    .select({ id: sentEmails.id })
    .from(sentEmails)
    .where(
      and(
        eq(sentEmails.organizationId, organizationId),
        eq(sentEmails.messageId, messageId),
        eq(sentEmails.recipient, recipient),
        eq(sentEmails.status, status)
      )
    )
    .limit(1);

  if (duplicate) {
    return NextResponse.json({ success: true, deduplicated: true });
  }

  await db.insert(sentEmails).values({
    organizationId,
    userId,
    recipient,
    templateUsed,
    status,
    messageId,
    error: error ?? null,
    timestamp: extractEventTimestamp(sesEvent) ?? new Date()
  });

  return NextResponse.json({ success: true });
}
