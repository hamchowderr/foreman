/**
 * Entrypoint for local Telegram bot development via long-polling.
 * Run with: npm run dev:telegram
 *
 * Requires TELEGRAM_BOT_TOKEN in environment (or .env file).
 * No public URL or webhook needed — uses Telegram's getUpdates API.
 */
import { startTelegramPolling } from "./bot";

startTelegramPolling().catch((err) => {
  console.error("Failed to start Telegram polling:", err);
  process.exit(1);
});
