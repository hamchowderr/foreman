# iMessage

> **Coming Soon** — the adapter is wired up but requires macOS with the Messages app.

Foreman's iMessage integration uses `chat-adapter-imessage` (community adapter) via the Chat SDK. It is DM-only — no group mentions or threading.

## How It Works

- **DMs only** — users message the Apple ID or phone number associated with the Mac running the server
- No group chat support — iMessage group mentions are not handled
- Plain text responses only — no cards, markdown rendering, or file attachments

## How the Adapter Works

The `chat-adapter-imessage` package interacts with the macOS Messages app via AppleScript. It reads incoming messages by polling the Messages SQLite database (`~/Library/Messages/chat.db`) and sends replies by scripting the Messages app directly.

This means:

- The server **must run on macOS** with the Messages app open and signed in
- The Mac must stay awake and online
- Full Disk Access must be granted to Node.js (for `chat.db` reads)

## Prerequisites

- macOS 12+ with the Messages app signed into an Apple ID or phone number
- Node.js 20+ (must have Full Disk Access in System Settings → Privacy & Security)
- The webhook server running on the same Mac

## Setup

### 1. Grant Full Disk Access to Node.js

**System Settings** → **Privacy & Security** → **Full Disk Access** → add your Node.js binary (e.g., `/usr/local/bin/node` or the path from `which node`).

Without this, the adapter cannot read `chat.db` and will not receive messages.

### 2. Sign into Messages

Open the Messages app → sign in with your Apple ID. Confirm you can send and receive iMessages.

### 3. Set Environment Variables

```bash
IMESSAGE_LOCAL=true     # Set to "true" for local/polling mode (default behavior)
```

When `IMESSAGE_LOCAL` is `true`, the adapter polls the Messages database directly. When `false`, it expects a webhook — but webhook mode is not yet fully supported by this community adapter.

## Local Development

Start the webhook server on your Mac:

```bash
cd packages/agents && npm run start:webhooks
```

Send an iMessage to the Apple ID signed into Messages. The bot reads it from `chat.db` and replies via AppleScript.

## Files

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `src/imessage/bot.ts` | Bot singleton, event handlers, agent wiring |
| `src/routes/index.ts` | Mounts webhook at `POST /imessage/webhook`  |

## Known Limitations

- **macOS only** — cannot run in Docker or on Linux/Windows servers
- **Type mismatch** — `chat-adapter-imessage` is missing `channelIdFromThreadId` in its type definitions; the adapter is cast with `as any` in `bot.ts` to work around this
- **No group support** — `onNewMention` is not wired; DMs only
- **AppleScript fragility** — macOS updates can break the AppleScript interface; test after OS upgrades

## Troubleshooting

**Bot not receiving messages:**

- Confirm Full Disk Access is granted to Node.js
- Check that `~/Library/Messages/chat.db` is readable: `sqlite3 ~/Library/Messages/chat.db ".tables"`
- Messages app must be open and signed in

**Bot not sending replies:**

- AppleScript must be allowed: **System Settings** → **Privacy & Security** → **Automation** → enable Messages for your terminal / Node.js process
- Test manually: `osascript -e 'tell application "Messages" to send "test" to buddy "user@example.com"'`
