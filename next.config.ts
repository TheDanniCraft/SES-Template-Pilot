import type { NextConfig } from "next";

function isValidBase64Aes256Key(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return false;
  }

  try {
    const decoded = Buffer.from(normalized, "base64");
    return decoded.length === 32;
  } catch {
    return false;
  }
}

function validateStartupEnv() {
  const cookieSecret = process.env.COOKIE_SECRET?.trim() ?? "";
  const dbSecretKey = process.env.DB_SECRET_KEY?.trim() ?? "";

  if (dbSecretKey && !isValidBase64Aes256Key(dbSecretKey)) {
    throw new Error(
      "Invalid DB_SECRET_KEY: must be base64 for exactly 32 bytes (AES-256 key)."
    );
  }

  if (
    cookieSecret &&
    (cookieSecret.length < 24 || cookieSecret === "change-me-to-a-long-random-value")
  ) {
    throw new Error(
      "Invalid COOKIE_SECRET: set a strong random secret (at least 24 chars, not the default placeholder)."
    );
  }
}

validateStartupEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: ["sespilot.app", "*.sespilot.app", "localhost:3000"]
    }
  },
  async redirects() {
    return [
      { source: "/templates", destination: "/app/templates", permanent: false },
      {
        source: "/templates/:path*",
        destination: "/app/templates/:path*",
        permanent: false
      },
      {
        source: "/contact-books",
        destination: "/app/contact-books",
        permanent: false
      },
      { source: "/send", destination: "/app/send", permanent: false },
      { source: "/logs", destination: "/app/logs", permanent: false },
      { source: "/brand-kits", destination: "/app/brand-kits", permanent: false },
      { source: "/settings", destination: "/app/settings", permanent: false }
    ];
  }
};

export default nextConfig;
