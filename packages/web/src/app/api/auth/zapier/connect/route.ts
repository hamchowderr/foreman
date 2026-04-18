import { requireSession } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

const ZAPIER_AUTHORIZE_URL = "https://zapier.com/oauth/authorize/";

export async function POST(request: Request) {
  try {
    await requireSession(request);
  } catch (res) {
    if (res instanceof Response) return res;
    throw res;
  }

  const env = getEnv();
  if (!env.ZAPIER_CLIENT_ID) {
    return Response.json(
      { error: "Zapier OAuth is not configured" },
      { status: 503 }
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/zapier/callback`;
  const state = randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.ZAPIER_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
  });

  const url = `${ZAPIER_AUTHORIZE_URL}?${params.toString()}`;

  return Response.json({ url, state });
}
