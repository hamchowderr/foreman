/**
 * Voice I/O service — STT via OpenAI Whisper, TTS via ElevenLabs (primary) or OpenAI (fallback).
 */

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const ELEVENLABS_DEFAULT_VOICE = "Rachel";
const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  Rachel: "21m00Tcm4TlvDq8ikWAM",
};

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

/**
 * Transcribe audio to text using OpenAI Whisper.
 */
export async function speechToText(
  audioBuffer: Buffer,
  mimeType = "audio/webm"
): Promise<string> {
  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp3") || mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("mp4")
        ? "mp4"
        : "webm";

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", blob, `audio.${ext}`);
  formData.append("model", "whisper-1");

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}` },
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Whisper API error (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}

/**
 * Synthesize text to speech.
 * Tries ElevenLabs first (if API key is set), falls back to OpenAI TTS.
 */
export async function textToSpeech(
  text: string
): Promise<{ audio: Buffer; mimeType: string }> {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (elevenLabsKey) {
    try {
      return await elevenLabsTTS(text, elevenLabsKey);
    } catch {
      // Fall through to OpenAI TTS
    }
  }

  return await openaiTTS(text);
}

async function elevenLabsTTS(
  text: string,
  apiKey: string
): Promise<{ audio: Buffer; mimeType: string }> {
  const voiceName = process.env.ELEVENLABS_VOICE_ID ?? ELEVENLABS_DEFAULT_VOICE;
  // If it looks like a raw voice ID (long alphanumeric), use directly; otherwise map from name
  const voiceId =
    voiceName.length > 10 ? voiceName : (ELEVENLABS_VOICE_MAP[voiceName] ?? voiceName);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs API error (${res.status}): ${detail}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
}

async function openaiTTS(
  text: string
): Promise<{ audio: Buffer; mimeType: string }> {
  const res = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: "alloy",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI TTS error (${res.status}): ${detail}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
}
