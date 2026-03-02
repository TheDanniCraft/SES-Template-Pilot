import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow
} from "lucide-react";

export const metadata: Metadata = {
  title: "SES Template Pilot | From Draft to Delivery",
  description:
    "Stop juggling SES console, scripts, and spreadsheets. SES Template Pilot gives email teams one focused workspace to build, send, and monitor campaigns.",
  alternates: {
    canonical: "https://sespilot.app"
  },
  openGraph: {
    title: "SES Template Pilot",
    description:
      "A focused AWS SES workspace for teams that need fast campaign execution and clear deliverability visibility.",
    url: "https://sespilot.app",
    siteName: "SES Template Pilot",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "SES Template Pilot",
    description:
      "From Draft to Delivery. Build, launch, and monitor SES campaigns in one control center."
  }
};

const quickWins = [
  "Launch campaigns faster",
  "Catch mistakes before send",
  "See delivery health instantly"
] as const;

const outcomes = [
  {
    title: "Move from idea to send in one flow",
    description:
      "Create or import templates, preview with real variables, and push live without switching tools.",
    icon: Workflow
  },
  {
    title: "Protect every campaign from avoidable errors",
    description:
      "Recipient checks, variable previews, and controlled template sync reduce broken sends.",
    icon: CheckCircle2
  },
  {
    title: "Know what happened after send",
    description:
      "Track quotas, delivery, bounces, opens, and clicks from a dashboard built for operators.",
    icon: Gauge
  }
] as const;

const useCases = [
  {
    title: "Product + Lifecycle Emails",
    description:
      "Keep high-frequency lifecycle campaigns reliable while iterating quickly."
  },
  {
    title: "Agency / Team Operations",
    description:
      "Give multiple users clean, scoped access without sharing raw SES credentials."
  },
  {
    title: "High-Change Campaign Work",
    description:
      "Ideal when templates and audiences change often and execution speed matters."
  }
] as const;

const flow = [
  {
    title: "Draft",
    description: "Build visually or edit raw HTML. Preview with real template vars.",
    icon: Sparkles
  },
  {
    title: "Launch",
    description: "Pick recipients via contact books or CSV and send with confidence.",
    icon: Mail
  },
  {
    title: "Optimize",
    description: "Use live metrics and logs to improve delivery and campaign quality.",
    icon: Clock3
  }
] as const;

const trustPoints = [
  "Magic-link authentication",
  "Per-user data and SES settings",
  "Encrypted credentials at rest",
  "Security headers and guarded routes"
] as const;

const faqs = [
  {
    q: "Who is this for?",
    a: "Teams running real AWS SES campaigns that need faster execution and fewer operational mistakes."
  },
  {
    q: "Does it send through SES or SMTP?",
    a: "Campaign emails are sent through AWS SES. SMTP is used for magic-link login emails."
  },
  {
    q: "Do users share one SES credential set?",
    a: "No. Credentials are user-scoped and encrypted before persistence."
  }
] as const;

export default function LandingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SES Template Pilot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Focused AWS SES control center for template authoring, campaign sending, and deliverability monitoring.",
    url: "https://sespilot.app"
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 md:py-8">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        type="application/ld+json"
      />

      <header className="landing-reveal panel sticky top-3 z-40 rounded-2xl border-white/15 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm font-semibold tracking-wide text-cyan-100" href="/">
            SES Template Pilot
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
              href="/login"
            >
              Sign In
            </Link>
            <Link
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/60 bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-50 transition hover:bg-cyan-500/30"
              href="/app"
            >
              Open App
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <section
        className="landing-reveal panel landing-hero-glow rounded-3xl border-white/15 p-6 sm:p-8 lg:p-10"
        style={{ animationDelay: "80ms" }}
      >
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200">
              Email Operations For AWS SES Teams
            </p>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl xl:text-6xl">
              <span className="title-gradient">Run Campaign Ops Without SES Chaos</span>
            </h1>

            <p className="max-w-2xl text-sm text-slate-300 md:text-base">
              Stop bouncing between console screens, scripts, and docs. SES Template
              Pilot gives you one clean control center to build, send, and monitor
              campaigns from draft to delivery.
            </p>

            <div className="flex flex-wrap gap-2">
              {quickWins.map((chip) => (
                <span
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-slate-200"
                  key={chip}
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-500/30"
                href="/login"
              >
                Start With Magic Link
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                href="/app"
              >
                See The Workspace
              </Link>
            </div>
          </div>

          <article className="rounded-2xl border border-white/15 bg-slate-950/55 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300/90">
              What Changes On Day One
            </p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400">Before</p>
                <p className="mt-1 text-sm text-slate-200">
                  Campaigns are fragmented across SES console, local files, and manual checks.
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                <p className="text-xs text-cyan-200">After</p>
                <p className="mt-1 text-sm text-cyan-50">
                  One operational flow for template editing, launch, and performance tracking.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="flex items-center gap-2 text-sm text-emerald-100">
                  <span className="status-breathing-dot status-breathing-dot-success" />
                  Live SES connection signal in-app
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        className="landing-reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        style={{ animationDelay: "130ms" }}
      >
        {outcomes.map(({ title, description, icon: Icon }) => (
          <article className="panel rounded-2xl p-5" key={title}>
            <header className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-cyan-300" />
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            </header>
            <p className="mt-3 text-sm text-slate-300">{description}</p>
          </article>
        ))}
      </section>

      <section
        className="landing-reveal panel rounded-3xl border-white/15 p-6 sm:p-8"
        style={{ animationDelay: "180ms" }}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">How It Feels</p>
        <h2 className="mt-2 text-2xl font-semibold">Simple Flow, Professional Output</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {flow.map(({ title, description, icon: Icon }, index) => (
            <article className="rounded-xl border border-white/10 bg-slate-950/45 p-4" key={title}>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 text-xs font-semibold text-cyan-200">
                  {index + 1}
                </span>
                <Icon className="h-4 w-4 text-cyan-300" />
                {title}
              </p>
              <p className="mt-2 text-xs text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="landing-reveal grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        style={{ animationDelay: "220ms" }}
      >
        <article className="panel rounded-3xl border-white/15 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Best Fit</p>
          <h2 className="mt-2 text-2xl font-semibold">Built For Real Campaign Teams</h2>
          <div className="mt-4 grid gap-3">
            {useCases.map((item) => (
              <div
                className="rounded-xl border border-white/10 bg-white/5 p-3"
                key={item.title}
              >
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel rounded-3xl border-white/15 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Trust Layer</p>
          <h2 className="mt-2 text-2xl font-semibold">Secure By Design</h2>
          <div className="mt-4 space-y-2">
            {trustPoints.map((item) => (
              <div
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200"
                key={item}
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section
        className="landing-reveal panel rounded-3xl border-white/15 p-6 sm:p-8"
        style={{ animationDelay: "260ms" }}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">FAQ</p>
        <h2 className="mt-2 text-2xl font-semibold">Fast Answers</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {faqs.map((item) => (
            <article className="rounded-xl border border-white/10 bg-white/5 p-4" key={item.q}>
              <h3 className="text-sm font-semibold text-slate-100">{item.q}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="landing-reveal panel rounded-3xl border-cyan-300/25 p-6 sm:p-8"
        style={{ animationDelay: "300ms" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Ready To Pilot</p>
            <h2 className="mt-2 text-2xl font-semibold">Turn SES Into A Workflow Your Team Actually Likes</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              If campaign work currently feels fragile or slow, this is the cleanest path
              to faster execution and better visibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:bg-cyan-500/30"
              href="/login"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              href="/app"
            >
              Open App
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
