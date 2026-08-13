import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config/env";
import * as schema from "./schema";

const globalDatabase = globalThis as typeof globalThis & {
  postgresClient?: ReturnType<typeof postgres>;
  database?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getDatabase() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!globalDatabase.postgresClient) {
    globalDatabase.postgresClient = postgres(env.DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 10 : 3,
      prepare: false,
    });
    globalDatabase.database = drizzle(globalDatabase.postgresClient, { schema });
  }
  return globalDatabase.database!;
}
