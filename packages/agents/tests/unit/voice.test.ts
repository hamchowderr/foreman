import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockListen = vi.fn().mockResolvedValue("transcribed text");

vi.mock("@mastra/voice-openai", () => {
  return {
    OpenAIVoice: class {
      listen = mockListen;
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
});
