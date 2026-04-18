import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Mastra voice adapters
const mockListen = vi.fn().mockResolvedValue("transcribed text");
const mockOpenAISpeak = vi.fn().mockResolvedValue(
  (async function* () {
    yield Buffer.from("openai-audio-data");
  })()
);

const mockElevenLabsSpeak = vi.fn().mockResolvedValue(
  (async function* () {
    yield Buffer.from("elevenlabs-audio-data");
  })()
);

vi.mock("@mastra/voice-openai", () => {
  return {
    OpenAIVoice: class {
      listen = mockListen;
      speak = mockOpenAISpeak;
    },
  };
});

vi.mock("@mastra/voice-elevenlabs", () => {
  return {
    ElevenLabsVoice: class {
      speak = mockElevenLabsSpeak;
    },
  };
});

describe("voice", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("speechToText", () => {
    it("exists and accepts a Buffer", async () => {
      const { speechToText } = await import("@/lib/voice");
      expect(typeof speechToText).toBe("function");

      const result = await speechToText(Buffer.from("fake-audio"));
      expect(result).toBe("transcribed text");
      expect(mockListen).toHaveBeenCalledTimes(1);
    });

    it("passes filetype based on mimeType", async () => {
      const { speechToText } = await import("@/lib/voice");
      await speechToText(Buffer.from("fake-audio"), "audio/wav");
      expect(mockListen).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ filetype: "wav" })
      );
    });
  });

  describe("textToSpeech", () => {
    it("exists and accepts a string", async () => {
      // No ElevenLabs key → uses OpenAI fallback
      delete process.env.ELEVENLABS_API_KEY;
      const { textToSpeech } = await import("@/lib/voice");
      expect(typeof textToSpeech).toBe("function");

      const result = await textToSpeech("Hello world");
      expect(result).toHaveProperty("audio");
      expect(result).toHaveProperty("mimeType", "audio/mpeg");
    });

    it("uses ElevenLabs when ELEVENLABS_API_KEY is set", async () => {
      process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
      const { textToSpeech } = await import("@/lib/voice");

      await textToSpeech("Hello from ElevenLabs");
      expect(mockElevenLabsSpeak).toHaveBeenCalledWith("Hello from ElevenLabs");
    });

    it("uses OpenAI fallback when ELEVENLABS_API_KEY is not set", async () => {
      delete process.env.ELEVENLABS_API_KEY;
      const { textToSpeech } = await import("@/lib/voice");

      await textToSpeech("Hello from OpenAI");
      expect(mockOpenAISpeak).toHaveBeenCalledWith("Hello from OpenAI");
    });

    it("falls back to OpenAI when ElevenLabs throws", async () => {
      process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
      mockElevenLabsSpeak.mockRejectedValueOnce(new Error("ElevenLabs API error"));

      const { textToSpeech } = await import("@/lib/voice");
      const result = await textToSpeech("Fallback test");

      expect(mockOpenAISpeak).toHaveBeenCalledWith("Fallback test");
      expect(result).toHaveProperty("mimeType", "audio/mpeg");
    });
  });
});
