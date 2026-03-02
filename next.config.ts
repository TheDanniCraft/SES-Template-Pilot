import type { NextConfig } from "next";

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
