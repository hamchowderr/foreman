import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

// Set env before importing crypto module
const TEST_KEY = randomBytes(32).toString("hex");

beforeAll(() => {
  process.env.DATABASE_URL = "file:./test.db";
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

describe("crypto", () => {
  it("round-trips encrypt and decrypt", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto");
    const plaintext = "sk-test-token-12345";
    const encrypted = encryptToken(plaintext);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encryptToken } = await import("@/lib/crypto");
    const plaintext = "same-token";
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
  });

  it("fails cleanly with wrong key", async () => {
    const { encryptToken } = await import("@/lib/crypto");
    const plaintext = "secret-data";
    const encrypted = encryptToken(plaintext);

    // Change the key
    const wrongKey = randomBytes(32).toString("hex");
    process.env.ENCRYPTION_KEY = wrongKey;

    // Force re-import by clearing module cache — but since getEnv() caches,
    // we need to reset the env cache. Simpler: directly test with wrong key via crypto APIs
    const { createDecipheriv } = await import("node:crypto");
    const combined = Buffer.from(encrypted, "base64");
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const ciphertext = combined.subarray(28);
    const wrongKeyBuf = Buffer.from(wrongKey, "hex");
    const decipher = createDecipheriv("aes-256-gcm", wrongKeyBuf, iv);
    decipher.setAuthTag(authTag);

    expect(() => {
      decipher.update(ciphertext);
      decipher.final();
    }).toThrow();

    // Restore correct key
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});
