import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/schema";

type AppDb = PostgresJsDatabase<typeof schema>;

const connectionString = process.env.DATABASE_URL?.trim() ?? "";

const globalForDb = globalThis as unknown as {
  sql: ReturnType<typeof postgres> | undefined;
};

function createMissingDbProxy(): AppDb {
  return new Proxy({} as AppDb, {
    get() {
      throw new Error("DATABASE_URL is not set");
    }
  });
}

let sql: ReturnType<typeof postgres> | null = null;
if (connectionString) {
  sql =
    globalForDb.sql ??
    postgres(connectionString, {
      prepare: false
    });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.sql = sql;
  }
}

export const db: AppDb = sql ? drizzle(sql, { schema }) : createMissingDbProxy();
