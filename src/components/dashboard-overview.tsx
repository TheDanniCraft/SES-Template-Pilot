"use client";

import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { ArrowUpRight, FilePlus2, Rocket } from "lucide-react";
import { SesMetricsCharts } from "@/components/ses-metrics-charts";

type DashboardOverviewProps = {
  totalEmailsSent: number;
  totalSesTemplates: number;
  sesError: string | null | undefined;
  sesQuota: {
    max24HourSend: number;
    maxSendRate: number;
    sentLast24Hours: number;
    remaining24HourSend: number;
    effectiveThrottleRate: number;
  } | null;
  deliverability: {
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
    series: Array<{
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
    }>;
  } | null;
  deliverabilityError: string | null;
};

export function DashboardOverview({
  totalEmailsSent,
  totalSesTemplates,
  sesError,
  sesQuota,
  deliverability,
  deliverabilityError
}: DashboardOverviewProps) {
  const sesConnected = !sesError;
  const formatInt = (value: number) =>
    new Intl.NumberFormat("en-US").format(Math.round(value));

  return (
    <div className="space-y-6">
      <section className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/90">
              SES Template Pilot
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              <span className="title-gradient">Campaign Operations Hub</span>
            </h1>
          </div>
          <Chip
            className="overflow-hidden"
            color={sesConnected ? "success" : "danger"}
            startContent={
              <span className="inline-flex pl-1">
                <span
                  className={`status-breathing-dot ${
                    sesConnected ? "status-breathing-dot-success" : "status-breathing-dot-danger"
                  }`}
                />
              </span>
            }
            variant="flat"
          >
            {sesConnected ? "Connected to SES" : "SES connection error"}
          </Chip>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="panel border border-cyan-400/25">
          <CardHeader className="pb-0 text-lg font-semibold">Create Template</CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-300">
              Build drafts with visual editing, preview variables instantly, then push to SES.
            </p>
            <Button
              as={Link}
              color="primary"
              endContent={<ArrowUpRight className="h-4 w-4" />}
              href="/templates/new"
              startContent={<FilePlus2 className="h-4 w-4" />}
            >
              New Template
            </Button>
          </CardBody>
        </Card>

        <Card className="panel border border-emerald-400/25">
          <CardHeader className="pb-0 text-lg font-semibold">Launch Campaign</CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-300">
              Select your SES template, load recipients, and trigger campaign delivery.
            </p>
            <Button
              as={Link}
              color="success"
              endContent={<ArrowUpRight className="h-4 w-4" />}
              href="/send"
              startContent={<Rocket className="h-4 w-4" />}
            >
              Start Campaign
            </Button>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Total Templates in SES
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-5xl font-bold text-cyan-300">{totalSesTemplates}</p>
          </CardBody>
        </Card>

        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Total Emails Sent
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-5xl font-bold text-emerald-300">{totalEmailsSent}</p>
          </CardBody>
        </Card>

        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            SES Daily Quota
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-4xl font-bold text-cyan-300">
              {sesQuota ? formatInt(sesQuota.max24HourSend) : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Used: {sesQuota ? formatInt(sesQuota.sentLast24Hours) : "-"}
            </p>
          </CardBody>
        </Card>

        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Max Send Rate
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-4xl font-bold text-cyan-300">
              {sesQuota ? sesQuota.maxSendRate.toFixed(2) : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Throttle: {sesQuota ? sesQuota.effectiveThrottleRate.toFixed(2) : "-"} / sec
            </p>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Send Volume ({deliverability?.windowDays ?? 7}d)
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-4xl font-bold text-cyan-300">
              {deliverability ? formatInt(deliverability.sent) : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Delivered:{" "}
              {deliverability ? formatInt(deliverability.delivered) : "-"}
            </p>
          </CardBody>
        </Card>

        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Delivery Rate
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-4xl font-bold text-emerald-300">
              {deliverability ? `${deliverability.deliveryRate.toFixed(2)}%` : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Bounces: {deliverability ? formatInt(deliverability.bounces) : "-"}
            </p>
          </CardBody>
        </Card>

        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Open Rate
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-4xl font-bold text-cyan-300">
              {deliverability ? `${deliverability.openRate.toFixed(2)}%` : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Opens: {deliverability ? formatInt(deliverability.opens) : "-"}
            </p>
          </CardBody>
        </Card>

        <Card className="panel">
          <CardHeader className="text-xs uppercase tracking-[0.16em] text-gray-400">
            Click Rate
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-4xl font-bold text-cyan-300">
              {deliverability ? `${deliverability.clickRate.toFixed(2)}%` : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Complaints:{" "}
              {deliverability ? formatInt(deliverability.complaints) : "-"}
            </p>
          </CardBody>
        </Card>
      </section>

      {deliverability ? <SesMetricsCharts points={deliverability.series} /> : null}

      {sesError ? (
        <Chip className="w-fit" color="warning" variant="flat">
          SES warning: {sesError}
        </Chip>
      ) : null}

      {deliverabilityError ? (
        <Chip
          className="w-fit max-w-full"
          color="warning"
          title={deliverabilityError}
          variant="flat"
        >
          Deliverability metrics unavailable
        </Chip>
      ) : null}
    </div>
  );
}
