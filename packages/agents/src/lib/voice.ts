/**
 * Voice I/O service — STT via OpenAI Whisper.
 */

import { Readable } from "node:stream";
import { OpenAIVoice } from "@mastra/voice-openai";

let _openai: OpenAIVoice | undefined;
function getOpenAIVoice(): OpenAIVoice {
  if (_openai) return _openai;
  _openai = new OpenAIVoice({
    listeningModel: { name: "whisper-1" },
  });
  return _openai;
}

function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  return Readable.from(buffer);
}

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

export async function speechToText(
  audioBuffer: Buffer,
  mimeType = "audio/webm"
): Promise<string> {
  const openai = getOpenAIVoice();
  const stream = bufferToStream(audioBuffer);
  return openai.listen(stream, { filetype: mimeToFiletype(mimeType) });
}
