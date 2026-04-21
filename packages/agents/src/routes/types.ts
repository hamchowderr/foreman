import type { Env } from "hono";

export interface AppEnv extends Env {
  Variables: {
    userId: string;
    orgId?: string;
    session: {
      id: string;
      userId: string;
      token: string;
      expiresAt: Date;
    };
  };
}
