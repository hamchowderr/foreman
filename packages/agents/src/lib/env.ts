import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  ZAPIER_CREDENTIALS: z.string().optional(),
  ZAPIER_CLIENT_ID: z.string().optional(),
  ZAPIER_CLIENT_SECRET: z.string().optional(),
  ZAPIER_REDIRECT_URI: z.string().optional(),
  AGENT_SERVER_URL: z.string().optional(),
  DEV_ZAPIER_OVERRIDE: z.string().optional(),
  FOREMAN_MODE: z.enum(["dev", "self_hosted"]).optional().default("dev"),
  DEPLOY_TARGET: z.enum(["vps", "vercel", "cloudflare"]).optional().default("vps"),
  PORT: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  OTEL_ENABLED: z.string().optional(),
  OTEL_EXPORTER_ENDPOINT: z.string().optional(),
  ZAPIER_WEBHOOK_SECRET: z.string().optional(),
  // Microsoft Teams
  TEAMS_APP_ID: z.string().optional(),
  TEAMS_APP_PASSWORD: z.string().optional(),
  TEAMS_APP_TENANT_ID: z.string().optional(),
  // Google Chat
  GOOGLE_CHAT_CREDENTIALS: z.string().optional(),
  GOOGLE_CHAT_USE_ADC: z.string().optional(),
  // WhatsApp
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  // GitHub
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_INSTALLATION_ID: z.string().optional(),
  GITHUB_BOT_USER_ID: z.string().optional(),
  // Linear
  LINEAR_CLIENT_ID: z.string().optional(),
  LINEAR_CLIENT_SECRET: z.string().optional(),
  LINEAR_ACCESS_TOKEN: z.string().optional(),
  // Voice I/O
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  // iMessage
  IMESSAGE_LOCAL: z.string().optional(),
  IMESSAGE_SERVER_URL: z.string().optional(),
  IMESSAGE_API_KEY: z.string().optional(),
  // Model provider overrides (see src/lib/providers/). Any unset value falls
  // back to the tier default, then to the hardcoded Anthropic default.
  // Per-agent values accept a comma-separated fallback chain, e.g.
  //   EXECUTION_MODEL=anthropic/claude-sonnet-4-6,openai/gpt-4o
  MODEL_DEFAULT: z.string().optional(),
  MODEL_FAST: z.string().optional(),
  MODEL_HEAVY: z.string().optional(),
  FOREMAN_MODEL: z.string().optional(),
  DISCOVERY_MODEL: z.string().optional(),
  EXECUTION_MODEL: z.string().optional(),
  SUPERVISOR_MODEL: z.string().optional(),
  HISTORY_MODEL: z.string().optional(),
  // Per-agent generation parameters (see src/lib/providers/params.ts). All
  // optional; unset values fall through to Mastra's and the provider's defaults.
  // Name suffix matches AI SDK's CallSettings shape (maxOutputTokens, topP).
  FOREMAN_TEMPERATURE: z.string().optional(),
  FOREMAN_MAX_OUTPUT_TOKENS: z.string().optional(),
  FOREMAN_TOP_P: z.string().optional(),
  DISCOVERY_TEMPERATURE: z.string().optional(),
  DISCOVERY_MAX_OUTPUT_TOKENS: z.string().optional(),
  DISCOVERY_TOP_P: z.string().optional(),
  EXECUTION_TEMPERATURE: z.string().optional(),
  EXECUTION_MAX_OUTPUT_TOKENS: z.string().optional(),
  EXECUTION_TOP_P: z.string().optional(),
  SUPERVISOR_TEMPERATURE: z.string().optional(),
  SUPERVISOR_MAX_OUTPUT_TOKENS: z.string().optional(),
  SUPERVISOR_TOP_P: z.string().optional(),
  HISTORY_TEMPERATURE: z.string().optional(),
  HISTORY_MAX_OUTPUT_TOKENS: z.string().optional(),
  HISTORY_TOP_P: z.string().optional(),
  // Per-agent Anthropic prompt-caching opt-in (see src/lib/providers/caching.ts).
  // Boolean strings: "true" / "1" / "yes" enable. Fails startup validation
  // if enabled on an agent whose configured model doesn't support caching.
  FOREMAN_PROMPT_CACHING: z.string().optional(),
  DISCOVERY_PROMPT_CACHING: z.string().optional(),
  EXECUTION_PROMPT_CACHING: z.string().optional(),
  SUPERVISOR_PROMPT_CACHING: z.string().optional(),
  HISTORY_PROMPT_CACHING: z.string().optional(),
  // Per-agent Anthropic tool-schema caching opt-in. Independent of the
  // system-prompt switch above; both gate on the `prompt-caching` capability.
  // Attaches providerOptions.anthropic.cacheControl to the last tool in each
  // agent's tool map, creating a single breakpoint that caches every earlier
  // tool definition as one block (max 4 breakpoints per Anthropic request).
  FOREMAN_TOOL_CACHING: z.string().optional(),
  DISCOVERY_TOOL_CACHING: z.string().optional(),
  EXECUTION_TOOL_CACHING: z.string().optional(),
  SUPERVISOR_TOOL_CACHING: z.string().optional(),
  HISTORY_TOOL_CACHING: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}
