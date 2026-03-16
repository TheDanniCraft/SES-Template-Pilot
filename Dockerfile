# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.3-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
ARG POLAR_VALIDATE_INTERVAL_SECONDS=300
ARG NEXT_PUBLIC_POLAR_CHECKOUT_URL=
ARG LICENSE_SERVER_URL=
ENV POLAR_VALIDATE_INTERVAL_SECONDS=$POLAR_VALIDATE_INTERVAL_SECONDS
ENV NEXT_PUBLIC_POLAR_CHECKOUT_URL=$NEXT_PUBLIC_POLAR_CHECKOUT_URL
ENV LICENSE_SERVER_URL=$LICENSE_SERVER_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production
ARG POLAR_VALIDATE_INTERVAL_SECONDS=300
ARG NEXT_PUBLIC_POLAR_CHECKOUT_URL=
ARG LICENSE_SERVER_URL=
ENV POLAR_VALIDATE_INTERVAL_SECONDS=$POLAR_VALIDATE_INTERVAL_SECONDS
ENV NEXT_PUBLIC_POLAR_CHECKOUT_URL=$NEXT_PUBLIC_POLAR_CHECKOUT_URL
ENV LICENSE_SERVER_URL=$LICENSE_SERVER_URL
COPY --from=builder /app/.next ./.next
# COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "run", "start"]
