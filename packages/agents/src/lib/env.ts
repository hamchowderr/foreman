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
  FOREMAN_MODE: z.enum(["dev", "production"]).optional().default("dev"),
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
  // iMessage
  IMESSAGE_LOCAL: z.string().optional(),
  IMESSAGE_SERVER_URL: z.string().optional(),
  IMESSAGE_API_KEY: z.string().optional(),
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
