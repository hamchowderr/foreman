/**
 * Voice I/O service — STT via OpenAI Whisper, TTS via ElevenLabs (primary) or OpenAI (fallback).
 * Uses Mastra voice adapters.
 */

import { Readable } from "node:stream";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

/** OpenAI voice adapter — used for STT (Whisper) and as TTS fallback. */
let _openai: OpenAIVoice | undefined;
function getOpenAIVoice(): OpenAIVoice {
  if (_openai) return _openai;
  _openai = new OpenAIVoice({
    listeningModel: { name: "whisper-1" },
    speechModel: { name: "tts-1" },
    speaker: "alloy",
  });
  return _openai;
}

/** ElevenLabs voice adapter — used for TTS when API key is available. */
let _elevenlabs: ElevenLabsVoice | undefined;
function getElevenLabsVoice(): ElevenLabsVoice | undefined {
  if (_elevenlabs) return _elevenlabs;
  if (!process.env.ELEVENLABS_API_KEY) return undefined;
  _elevenlabs = new ElevenLabsVoice({
    speechModel: { name: "eleven_multilingual_v2", apiKey: process.env.ELEVENLABS_API_KEY },
    speaker: process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM", // Rachel
  });
  return _elevenlabs;
}

/** Convert a Buffer into a Node.js ReadableStream for Mastra adapters. */
function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  return Readable.from(buffer);
}

/** Collect a ReadableStream into a Buffer. */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Map MIME type to file extension for Whisper. */
function mimeToFiletype(
  mimeType: string
): "mp3" | "mp4" | "mpeg" | "mpga" | "m4a" | "wav" | "webm" {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("mpeg")) return "mpeg";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("m4a")) return "m4a";
  return "webm";
}

/**
 * Transcribe audio to text using OpenAI Whisper via Mastra adapter.
 */
export async function speechToText(
  audioBuffer: Buffer,
  mimeType = "audio/webm"
): Promise<string> {
  const openai = getOpenAIVoice();
  const stream = bufferToStream(audioBuffer);
  return openai.listen(stream, { filetype: mimeToFiletype(mimeType) });
}

/**
 * Synthesize text to speech.
 * Tries ElevenLabs first (if API key is set), falls back to OpenAI TTS.
 */
export async function textToSpeech(
  text: string
): Promise<{ audio: Buffer; mimeType: string }> {
  const elevenlabs = getElevenLabsVoice();

  if (elevenlabs) {
    try {
      const stream = await elevenlabs.speak(text);
      const audio = await streamToBuffer(stream);
      return { audio, mimeType: "audio/mpeg" };
    } catch {
      // Fall through to OpenAI TTS
    }
  }

  const openai = getOpenAIVoice();
  const stream = await openai.speak(text);
  const audio = await streamToBuffer(stream);
  return { audio, mimeType: "audio/mpeg" };
}
