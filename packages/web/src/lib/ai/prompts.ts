/**
 * Prompts are handled by the agent server.
 * This file only exports types/constants needed by the frontend.
 */

export type RequestHints = {
  latitude?: string | null;
  longitude?: string | null;
  city?: string | null;
  country?: string | null;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.
Output ONLY the title text. No prefixes, no formatting.`;
