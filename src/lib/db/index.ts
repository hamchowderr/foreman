import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (_db) return _db;

  const client = createClient({
    url: process.env.DATABASE_URL!,
  });

  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
