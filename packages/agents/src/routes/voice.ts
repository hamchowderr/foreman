import { Hono } from "hono";
import { authMiddleware } from "./middleware";
import type { AppEnv } from "./types";
import { checkCapability } from "@/lib/capabilities";
import { speechToText, textToSpeech } from "@/lib/voice";

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

  const { text } = await c.req.json<{ text: string }>();
  if (!text || typeof text !== "string") {
    return c.json({ error: "text (string) is required" }, 400);
  }

  const { audio, mimeType } = await textToSpeech(text);

  return new Response(audio, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(audio.length),
    },
  });
});

export default voice;
