import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";

export function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
    },
  });
}

// Lazy singleton
let _auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!_auth) _auth = createAuth();
  return _auth;
}
