"use client";

import { useState } from "react";

type SeriesPoint = {
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

type SesMetricsChartsProps = {
  points: SeriesPoint[];
};

type MetricConfig = {
  key: keyof Omit<SeriesPoint, "timestamp">;
  label: string;
  color: string;
};

const VOLUME_METRICS: MetricConfig[] = [
  { key: "sent", label: "Sent", color: "#22d3ee" },
  { key: "delivered", label: "Delivered", color: "#10b981" },
  { key: "complaints", label: "Complaints", color: "#f97316" },
  { key: "transientBounces", label: "Transient bounces", color: "#f59e0b" },
  { key: "permanentBounces", label: "Permanent bounces", color: "#ef4444" },
  { key: "opens", label: "Opens", color: "#818cf8" },
  { key: "clicks", label: "Clicks", color: "#ec4899" }
];

const RATE_METRICS: MetricConfig[] = [
  { key: "deliveryRate", label: "Delivery rate", color: "#10b981" },
  { key: "openRate", label: "Open rate", color: "#818cf8" },
  { key: "clickRate", label: "Click rate", color: "#ec4899" }
];

const SVG_WIDTH = 980;
const PLOT_X = 56;
const PLOT_Y = 16;
const PLOT_WIDTH = 900;
const PLOT_HEIGHT = 204;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function linePath(values: number[], width: number, height: number, maxY: number) {
  if (values.length === 0) {
    return "";
  }

  const xStep = values.length > 1 ? width / (values.length - 1) : 0;
  const commands = values.map((value, index) => {
    const x = index * xStep;
    const y = maxY <= 0 ? height : height - (value / maxY) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return commands.join(" ");
}

function formatUtcLabel(value: string) {
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(new Date(value))} UTC`;
}

function ChartBlock({
  title,
  points,
  metrics,
  isPercent
}: {
  title: string;
  points: SeriesPoint[];
  metrics: MetricConfig[];
  isPercent?: boolean;
}) {
  const maxRaw = Math.max(
    1,
    ...metrics.flatMap((metric) => points.map((point) => Number(point[metric.key] ?? 0)))
  );
  const maxY = isPercent ? 100 : maxRaw;

  const xLabelStep = points.length > 8 ? Math.ceil(points.length / 8) : 1;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIndex = hoveredIndex ?? points.length - 1;
  const activePoint = points[activeIndex];
  const hoverX = points.length > 1 ? (activeIndex / (points.length - 1)) * PLOT_WIDTH : 0;

  const getY = (value: number) => (maxY <= 0 ? PLOT_HEIGHT : PLOT_HEIGHT - (value / maxY) * PLOT_HEIGHT);
  const getMetricValue = (metric: MetricConfig) => Number(activePoint[metric.key] ?? 0);

  const handlePointerMove = (
    clientX: number,
    svgRect: { left: number; width: number }
  ) => {
    if (points.length <= 1 || svgRect.width <= 0) {
      setHoveredIndex(0);
      return;
    }

    const svgX = ((clientX - svgRect.left) / svgRect.width) * SVG_WIDTH;
    const plotX = clamp(svgX - PLOT_X, 0, PLOT_WIDTH);
    const nextIndex = Math.round((plotX / PLOT_WIDTH) * (points.length - 1));
    setHoveredIndex(nextIndex);
  };

  return (
    <div className="panel rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
          {metrics.map((metric) => (
            <span className="inline-flex items-center gap-1.5" key={metric.key}>
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
              {metric.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden">
        <svg
          className="h-[260px] w-full"
          onMouseLeave={() => setHoveredIndex(null)}
          onMouseMove={(event) =>
            handlePointerMove(event.clientX, event.currentTarget.getBoundingClientRect())
          }
          onTouchEnd={() => setHoveredIndex(null)}
          onTouchMove={(event) =>
            handlePointerMove(event.touches[0]?.clientX ?? 0, event.currentTarget.getBoundingClientRect())
          }
          viewBox="0 0 980 260"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform={`translate(${PLOT_X},${PLOT_Y})`}>
            <rect fill="rgba(2,6,23,0.28)" height={PLOT_HEIGHT} rx="10" width={PLOT_WIDTH} x="0" y="0" />

            {[0, 25, 50, 75, 100].map((tick) => {
              const y = PLOT_HEIGHT - (tick / 100) * PLOT_HEIGHT;
              const labelValue = isPercent
                ? `${tick}%`
                : Math.round((tick / 100) * maxY).toLocaleString("en-US");
              return (
                <g key={tick}>
                  <line
                    stroke="rgba(148,163,184,0.2)"
                    strokeDasharray="4 4"
                    x1="0"
                    x2={PLOT_WIDTH}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="rgba(148,163,184,0.8)"
                    fontSize="10"
                    textAnchor="end"
                    x="-8"
                    y={y + 3}
                  >
                    {labelValue}
                  </text>
                </g>
              );
            })}

            {metrics.map((metric) => {
              const values = points.map((point) => Number(point[metric.key] ?? 0));
              const path = linePath(values, 900, 204, maxY);
              return (
                <path
                  d={path}
                  fill="none"
                  key={metric.key}
                  stroke={metric.color}
                  strokeWidth="2.5"
                />
              );
            })}

            <line
              stroke="rgba(148,163,184,0.35)"
              strokeDasharray="4 4"
              x1={hoverX}
              x2={hoverX}
              y1="0"
              y2={PLOT_HEIGHT}
            />

            {metrics.map((metric) => {
              const value = getMetricValue(metric);
              return (
                <circle
                  cx={hoverX}
                  cy={getY(value)}
                  fill={metric.color}
                  key={`${metric.key}-hover-point`}
                  r="4"
                  stroke="rgba(2,6,23,0.95)"
                  strokeWidth="1.5"
                />
              );
            })}

            {points.map((point, index) => {
              if (index % xLabelStep !== 0 && index !== points.length - 1) {
                return null;
              }

              const x =
                points.length > 1 ? (index / (points.length - 1)) * PLOT_WIDTH : 0;
              return (
                <g key={point.timestamp}>
                  <line
                    stroke="rgba(148,163,184,0.2)"
                    x1={x}
                    x2={x}
                    y1="204"
                    y2="208"
                  />
                  <text
                    fill="rgba(148,163,184,0.9)"
                    fontSize="10"
                    textAnchor="middle"
                    x={x}
                    y="223"
                  >
                    {formatUtcLabel(point.timestamp)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          {formatUtcLabel(activePoint.timestamp)}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-200">
          {metrics.map((metric) => {
            const value = getMetricValue(metric);
            const formattedValue = isPercent ? `${value.toFixed(2)}%` : value.toLocaleString("en-US");
            return (
              <span className="inline-flex items-center gap-1.5" key={`${metric.key}-active-value`}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                {metric.label}: {formattedValue}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SesMetricsCharts({ points }: SesMetricsChartsProps) {
  if (!points.length) {
    return null;
  }

  return (
    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(560px,1fr))]">
      <ChartBlock metrics={VOLUME_METRICS} points={points} title="Metrics Volume (UTC)" />
      <ChartBlock isPercent metrics={RATE_METRICS} points={points} title="Metrics Rate (UTC)" />
    </section>
  );
}
