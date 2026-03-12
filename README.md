<div id="top" align="center">

<img src="./assets/readme/banner.svg" alt="SES Template Pilot Banner" width="100%">

<em>Design, sync, and send SES campaigns with local draft control and live deliverability insights.</em>

<br><br>

<a href="https://sespilot.app"><strong>sespilot.app</strong></a>

<br><br>

<img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs" alt="Next.js">
<img src="https://img.shields.io/badge/React-19-20232a?style=for-the-badge&logo=react" alt="React">
<img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/HeroUI-2.x-00ACC1?style=for-the-badge" alt="HeroUI">
<img src="https://img.shields.io/badge/TailwindCSS-4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
<img src="https://img.shields.io/badge/Drizzle-ORM-c5f74f?style=for-the-badge" alt="Drizzle ORM">
<img src="https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
<img src="https://img.shields.io/badge/AWS-SES-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS SES">
<img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT">

</div>

<img src="./assets/readme/divider.svg" alt="divider" width="100%">

## Quick Links

- [Live App](https://sespilot.app)
- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Environment](#environment)
- [Routes](#routes)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)

<img src="./assets/readme/divider.svg" alt="divider" width="100%">

## Overview

SES Template Pilot is a secure, local-first operations UI for Amazon SES.

It combines:

- password authentication
- visual email editing
- SES template sync
- campaign sending
- contact books
- brand kits
- org-scoped SES credentials
- dashboard metrics + send logs

Everything is built around practical campaign workflows with an editable draft layer in PostgreSQL.

## Features

- **Template Studio**
  - table-first drag-and-drop builder
  - raw HTML editor
  - plain text mode (manual or auto from HTML)
- **Auth + Tenancy**
  - password-based login
  - organization-based access control
- **SES Sync**
  - list/get/create/update/delete SES templates
  - reset local drafts from SES
- **Campaign Send**
  - recipients from tags, CSV upload, or contact books
  - per-recipient `Template Variables JSON`
- **Brand Kits**
  - reusable color/branding defaults + logo URL
- **Ops Dashboard**
  - SES send quota/rate
  - CloudWatch deliverability metrics + charts
- **Audit Trail**
  - paginated sent-email logs with status and errors

## Quick Start

1. Install dependencies.

```bash
bun install
```

2. Copy env file.

```bash
cp .env.example .env
```

3. Start database.

```bash
docker compose up -d db
```

4. Apply schema.

```bash
bun run db:push
```

5. Run app.

```bash
bun run dev
```

6. Open `http://localhost:3000`.
7. Create your first account on `/setup`.

## Environment

```env
NODE_ENV=development
COOKIE_SECRET=change-me-to-a-long-random-value
DB_SECRET_KEY=base64-encoded-32-byte-key
DATABASE_URL=postgres://postgres:postgres@localhost:5433/ses_ui
APP_BASE_URL=http://localhost:3000
SES_WEBHOOK_URL=
SES_WEBHOOK_SECRET=
```

- `COOKIE_SECRET`: required for auth cookie signing
- `DB_SECRET_KEY`: AES-256 key (base64 32 bytes) for encrypted SES credentials in DB
- `SES_WEBHOOK_SECRET`: shared secret checked by `/api/webhooks/ses`
- `SES_WEBHOOK_URL`: optional override; defaults to `${APP_BASE_URL}/api/webhooks/ses`
- SES credentials are configured per organization in `/app/organization`

## Docker

```bash
docker compose up -d
```

- App: `http://localhost:3000`
- DB: `localhost:5433`

## AWS Permissions

For full functionality:

- SES template + send permissions (SESv2 + SES)
- `ses:GetSendQuota`
- `cloudwatch:GetMetricData` (dashboard deliverability)
- Attach AWS managed policy `AmazonSNSFullAccess` for webhook setup automation
- Alternative: custom SNS policy with `CreateTopic`, `Subscribe`, `SetTopicAttributes`, `ListSubscriptionsByTopic`

## Routes

- `/login` - login page
- `/` - public landing page
- `/app` - dashboard
- `/app/templates` - template list
- `/app/templates/new` - create template draft
- `/app/templates/[id]` - edit draft or SES template
- `/app/send` - build/send campaigns
- `/app/logs` - send logs
- `/app/brand-kits` - brand kit manager
- `/app/contact-books` - contact book manager
- `/app/settings` - account settings
- `/app/organization` - org members, invites, license, org SES credentials

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start dev server |
| `bun run build` | Build app |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema to DB |
| `bun run db:generate` | Generate migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Open Drizzle Studio |

## Troubleshooting

- `DATABASE_URL is not set`: add it to `.env`.
- `COOKIE_SECRET is not set`: add `COOKIE_SECRET` to `.env`.
- Postgres auth error `28P01`: verify DB user/password in `DATABASE_URL`.
- Deliverability metrics unavailable: ensure `cloudwatch:GetMetricData` is allowed.
- SES send failures: open `/app/organization` and verify org SES credentials + source email.
- Webhook events missing: verify `SES_WEBHOOK_SECRET` and that SES can reach `/api/webhooks/ses`.

<img src="./assets/readme/divider.svg" alt="divider" width="100%">

## License

MIT

<div align="center">

[Back to top](#top)

</div>
