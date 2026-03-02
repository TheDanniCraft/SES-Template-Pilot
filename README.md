# SES Template Pilot

![SES Template Pilot](https://socialify.git.ci/TheDanniCraft/ses-template-pilot/image?forks=1&issues=1&language=1&logo=https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F66677362&name=1&owner=1&pattern=Solid&pulls=1&stargazers=1&theme=Auto)

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-20232a?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/HeroUI-2.x-00ACC1?style=for-the-badge" alt="HeroUI">
  <img src="https://img.shields.io/badge/TailwindCSS-4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Drizzle-ORM-c5f74f?style=for-the-badge" alt="Drizzle ORM">
  <img src="https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/AWS-SES-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS SES">
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" alt="MIT">
</p>

Secure, local-first campaign operations UI for Amazon SES.  
Design templates, sync with SES, manage recipients, send campaigns, and monitor delivery metrics.

## Highlights

- Visual email builder (table-first) plus raw HTML mode.
- Plain text editor with optional auto-generate from HTML.
- Local draft storage in PostgreSQL with SES sync.
- Brand kits and contact books.
- Bulk send with per-recipient template variables JSON.
- Dashboard with SES quota and CloudWatch deliverability stats.
- Paginated send logs for campaign auditing.

## Tech Stack

- Next.js 16 App Router
- React 19 + TypeScript
- HeroUI + Tailwind CSS v4
- Drizzle ORM + PostgreSQL
- AWS SDK v3 (`SES`, `CloudWatch`)

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Copy env file.

```bash
cp .env.example .env
```

3. Start PostgreSQL (Docker).

```bash
docker compose up -d db
```

4. Push schema.

```bash
npm run db:push
```

5. Start app.

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Environment

```env
NODE_ENV=development
APP_PASSWORD=password
COOKIE_SECRET=change-me-to-a-long-random-value
DATABASE_URL=postgres://postgres:postgres@localhost:5433/ses_ui
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
SES_SOURCE_EMAIL=no-reply@example.com
```

- `APP_PASSWORD`: login password for the app.
- `COOKIE_SECRET`: required for session cookie signing.
- `SES_SOURCE_EMAIL`: sender address used for SES sends.

## Docker (App + DB)

```bash
docker compose up -d
```

- App: `http://localhost:3000`
- DB: `localhost:5433`

## AWS Permissions

Required for full functionality:

- SES template actions and send actions.
- `ses:GetSendQuota`.
- `cloudwatch:GetMetricData` for deliverability charts.

## Routes

- `/login` - login
- `/` - dashboard
- `/templates` - template list
- `/templates/new` - new draft
- `/templates/[id]` - edit draft or SES template
- `/send` - campaign builder + preview + send
- `/logs` - sent logs
- `/brand-kits` - brand kit manager
- `/contact-books` - contact book manager

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Build app |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema to DB |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Troubleshooting

- `DATABASE_URL is not set`: set it in `.env`.
- `COOKIE_SECRET is not set`: set `COOKIE_SECRET` in `.env`.
- Postgres `28P01` auth error: verify DB credentials in `DATABASE_URL`.
- CloudWatch metrics unavailable: add `cloudwatch:GetMetricData` permission.
- SES send fails: verify AWS creds, region, sender identity, and template name.

## License

MIT
