import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string | null;
};

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedKey: string | null = null;

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseSecure(value: string | undefined, port: number) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return port === 465;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = parsePort(process.env.SMTP_PORT, 587);
  const secure = parseSecure(process.env.SMTP_SECURE, port);
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS?.trim() ?? "";
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || null;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail
  };
}

function getConfigCacheKey(config: SmtpConfig) {
  return `${config.host}:${config.port}:${config.secure}:${config.user}`;
}

export function getSmtpTransport() {
  const config = getSmtpConfig();
  if (!config) {
    return {
      success: false as const,
      error:
        "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
    };
  }

  const key = getConfigCacheKey(config);
  if (!cachedTransporter || key !== cachedKey) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
    cachedKey = key;
  }

  return {
    success: true as const,
    data: {
      config,
      transporter: cachedTransporter
    }
  };
}
