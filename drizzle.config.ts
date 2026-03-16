import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  require("dotenv/config");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
});
