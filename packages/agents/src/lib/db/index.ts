import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL!;
  // Supabase/Postgres connection. Prefer pooled (port 6543) for serverless;
  // direct (5432) for long-running processes. URL is whatever the caller sets.
  const client = postgres(url, {
    prepare: false, // required for pgbouncer transaction mode
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  });

  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
