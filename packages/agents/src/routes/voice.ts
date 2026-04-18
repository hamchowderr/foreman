import { Hono } from "hono";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";
import { checkCapability } from "@/lib/capabilities";
import { speechToText, textToSpeech } from "@/lib/voice";
import { textSchema } from "@/lib/validation";

const voice = new Hono<AppEnv>();

// All routes require auth
voice.use("/*", authMiddleware);

// POST /transcribe — upload audio, get text back
voice.post("/transcribe", async (c) => {
  const userId = c.get("userId");

  const allowed = await checkCapability(userId, "voice");
  if (!allowed) {
    return c.json({ error: "Voice capability is not enabled" }, 403);
  }

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!(file instanceof File)) {
    return c.json({ error: "file field is required (multipart)" }, 400);
  }

  // Whisper API limit: 25MB
  if (file.size > 25 * 1024 * 1024) {
    return c.json({ error: "File too large (max 25MB)" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await speechToText(buffer, file.type || undefined);

  return c.json({ text });
});

// POST /synthesize — send text, get audio back
voice.post("/synthesize", async (c) => {
  const userId = c.get("userId");

  const allowed = await checkCapability(userId, "voice");
  if (!allowed) {
    return c.json({ error: "Voice capability is not enabled" }, 403);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const textResult = textSchema.safeParse(body.text);
  if (!textResult.success) {
    return c.json({ error: "text is required (string, max 10000 chars)" }, 400);
  }
  const text = textResult.data;

  const { audio, mimeType } = await textToSpeech(text);

  return new Response(audio, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(audio.length),
    },
  });
});

export default voice;
