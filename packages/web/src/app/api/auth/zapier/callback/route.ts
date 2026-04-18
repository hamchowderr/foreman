import { getSessionFromRequest } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { encryptToken } from "@/lib/crypto";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const ZAPIER_TOKEN_URL = "https://zapier.com/oauth/token/";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.redirect(`${origin}/?error=zapier_auth_failed`);
  }

  const env = getEnv();
  if (!env.ZAPIER_CLIENT_ID || !env.ZAPIER_CLIENT_SECRET) {
    return Response.redirect(`${origin}/?error=zapier_auth_failed`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${origin}/?error=zapier_auth_failed`);
  }

  const redirectUri = `${origin}/api/auth/zapier/callback`;

  // Exchange authorization code for tokens
  let tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  try {
    const tokenRes = await fetch(ZAPIER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: env.ZAPIER_CLIENT_ID,
        client_secret: env.ZAPIER_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      return Response.redirect(`${origin}/?error=zapier_auth_failed`);
    }

    tokenData = await tokenRes.json();
  } catch {
    return Response.redirect(`${origin}/?error=zapier_auth_failed`);
  }

  // Encrypt and store tokens
  const now = new Date();
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;
  const scopes = tokenData.scope ? tokenData.scope.split(" ") : [];

  const db = getDb();
  const userId = session.user.id;

  const existing = await db
    .select({ id: schema.zapierIdentity.id })
    .from(schema.zapierIdentity)
    .where(eq(schema.zapierIdentity.userId, userId))
    .limit(1);

  const row = {
    userId,
    accessToken: encryptToken(tokenData.access_token),
    refreshToken: encryptToken(tokenData.refresh_token ?? ""),
    expiresAt,
    scopes: JSON.stringify(scopes),
    updatedAt: now,
  };

  if (existing[0]) {
    await db
      .update(schema.zapierIdentity)
      .set(row)
      .where(eq(schema.zapierIdentity.id, existing[0].id));
  } else {
    await db.insert(schema.zapierIdentity).values({
      id: randomUUID(),
      ...row,
      createdAt: now,
    });
  }

  return Response.redirect(`${origin}/`);
}
