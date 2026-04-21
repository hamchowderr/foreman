> ## Documentation Index
> Fetch the complete documentation index at: https://docs.zapier.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Get up and running with the Zapier SDK in 5 minutes

<Tip>
  Want to know what SDK is and isn't? Check the [overview page](/sdk).
</Tip>

This guide walks you through installing the SDK, authenticating, and running your first action.

## One-Command Setup

**Not using Cursor?** Copy and paste this prompt into an IDE agent (VS Code with Copilot, Claude Code, Windsurf, etc.).

```text expandable theme={null}
Set up the Zapier SDK for me. Work through these steps one at a time, running each command in the terminal and telling me what happened before moving on:

1. Check what folder I'm in and whether a package.json already exists.
   - If there's already a package.json, use this project as-is.
   - If there's no package.json, create one, run: npm init -y

2. Check Node.js is installed and is version 20 or higher: node -v
   - If Node is not found: tell me to install it from https://nodejs.org or run brew install node, then stop.
   - If Node is older than 20: tell me to upgrade it, then stop.

3. Install the SDK: npm install @zapier/zapier-sdk
   - An EPERM error on ~/.npm/_cacache usually means the command sandbox is blocking npm's cache writes, not a file permissions issue.

4. Install dev dependencies: npm install -D @zapier/zapier-sdk-cli @types/node typescript

5. Log in to Zapier: npx zapier-sdk login
   - This opens a browser window. A permissions or sandbox error here typically means the command sandbox is preventing credentials from being written to disk.
   - If login fails for another reason, try again.

6. List my connected apps: npx zapier-sdk list-connections --owner me --json 2>/dev/null | head -n 1000
   - Read the output and show only the first 10 results as a markdown table with columns: ID, App Key, Expired. Do not show Title. Always tell me how many total connections there are, and if there are more than 10, note that you are only showing the first 10.
   - The page size is 100. If the output contains exactly 100 connections, there may be additional connections beyond this first page. Just note that and move on — do not fetch additional pages.
   - If the list is empty: tell me to connect at least one app at https://zapier.com/app/assets/connections and come back.

Once all steps are done, tell me I am ready and explain:

Zapier has pre-built connectors for 8,000+ apps — Slack, Google Sheets, Salesforce, GitHub, and thousands more. The Zapier SDK and CLI expose that same integration layer to code. Instead of building OAuth flows, handling token refresh, and reverse-engineering each app's API yourself, you get a single consistent interface that already knows how to talk to all of them. Your users' existing Zapier connections are authenticated and ready to use.

- **CLI — explore, run one-offs, or let an agent act:** the CLI is for exploration and ad-hoc action. Use it to see what an app can do, inspect the exact inputs an action expects, and run actions interactively — whether that's you in a terminal or an agent executing a task on demand. See the CLI reference: https://docs.zapier.com/sdk/cli-reference
- **TypeScript SDK — build production integrations and agent tools:** the SDK is for shipping. Use it when you need something repeatable, embedded, or in production — a scheduled workflow, a backend service, a tool inside an AI agent. It's type-safe, handles token refresh and retries automatically, and uses the same app keys, action keys, and input shapes you already discovered via the CLI. See the SDK reference: https://docs.zapier.com/sdk/reference

**Want to run a quick test?**

If I have a Slack connection, offer to send a DM to yourself on Slack. Describe the steps that will happen and end with: "Want to run this quick test?" Then STOP. Do not output anything else. Do not continue to the next section. Wait for my reply before proceeding.

When I reply to the quick test, only proceed if my response is a clear, unambiguous affirmative (e.g. "yes", "go ahead"). If ambiguous or unclear, skip the test and continue.

If I don't have a Slack connection, skip the test and continue.

---

When I reply yes to the quick test, run these exact commands in order:

1. Look up my Slack username:
   npx zapier-sdk run-action slack search user_by_email --connection-id ID --inputs '{"email":"ZAPIER_EMAIL"}'

2. Send a direct message to yourself using the username from step 1:
   npx zapier-sdk run-action slack write direct_message --connection-id ID --inputs '{"channel":"USERNAME","text":"Hello via Zapier SDK 👋"}'

Replace ID with my Slack connection ID from the table above. Replace ZAPIER_EMAIL with my Zapier login email. Replace USERNAME with the username returned from step 1.

If user_by_email fails, ask me for my Slack email and try again.

---

After the test completes (or if I skip it, or if there's no Slack connection):

Pick 1–3 apps from the connections table and show me the commands I could use to explore what actions they support. Do not run these commands — just display them so I can try on my own. For example:
   npx zapier-sdk list-actions APP_KEY

**All set! Now, a few ideas to start exploring what the Zapier SDK can do:**

Suggest 3 ideas worth exploring — good starting points based on my connected apps. Each idea reads from one app, optionally processes it, and writes to another. Do not suggest anything event-driven. Keep each idea to one sentence. Examples: "get all your Jira issues still In Progress and DM yourself a tidy table on Slack"; "pull every HubSpot deal that closed this week and drop it into a Google Sheet". Make the ideas specific to my connected apps — not generic.
```

***

## Prerequisites

* Node.js 20+ installed
* A [Zapier account](https://zapier.com/sign-up) (free tier works)
* At least one app connected to your Zapier account

## Step 1: Install the SDK

Create a new project (or use an existing one) and install the required packages:

```bash theme={null}
# Create a new project (optional)
mkdir my-zapier-project && cd my-zapier-project
npm init -y && npm pkg set type=module

# Install the SDK and CLI
npm install @zapier/zapier-sdk
npm install -D @zapier/zapier-sdk-cli @types/node typescript

# Initialize TypeScript (if starting fresh)
npx tsc --init
```

<Tip>
  The examples in this guide assume you have `"type": "module"` in your
  `package.json` so that you're using ES modules with support for top-level
  `await`. We do that above with `npm pkg set type=module`.
</Tip>

## Step 2: Authenticate

The SDK CLI provides a simple browser-based authentication flow:

```bash theme={null}
npx zapier-sdk login
```

This opens your browser to authenticate with Zapier. Your token is stored locally, and as long as you have the CLI package installed as a development dependency, the SDK will automatically use it.

<Warning>
  **Building for production or deploying to a server?** Browser-based login only
  works in your local development environment. For any server-side deployment,
  use Client Credentials instead — treat them like API keys and store them in
  environment variables. See the [Initialization section of the API
  Reference](/sdk/reference#client-credentials).
</Warning>

<AccordionGroup>
  <Accordion title="Alternative: Client Credentials">
    For server-side applications, you can use client credentials instead. See the
    [API Reference](/sdk/reference#client-credentials) for the full SDK API and
    [CLI Reference](/sdk/cli-reference#create-client-credentials) for creating
    credentials via the CLI.

    ```typescript theme={null}
    const zapier = createZapierSdk({
      credentials: {
        clientId: process.env.ZAPIER_CREDENTIALS_CLIENT_ID,
        clientSecret: process.env.ZAPIER_CREDENTIALS_CLIENT_SECRET,
      },
    });
    ```
  </Accordion>

  <Accordion title="Alternative: Direct Token">
    You can also provide a token directly:

    ```typescript theme={null}
    const zapier = createZapierSdk({
      credentials: process.env.ZAPIER_CREDENTIALS,
    });
    ```
  </Accordion>
</AccordionGroup>

## Step 3: Generate Types for Your Apps

The SDK can generate TypeScript types for any app, giving you full autocomplete and type safety:

```bash theme={null}
# Add types for the apps you want to use
npx zapier-sdk add slack google-sheets

# Don't know the app key? Search for it
npx zapier-sdk list-apps --search "google sheets"
```

Types are generated in your `src` or `lib` folder by default. You can customize the output location:

```bash theme={null}
npx zapier-sdk add slack --types-output ./types
```

## Step 4: Initialize the SDK

Create a new file (e.g., `index.ts`) and initialize the SDK:

```typescript theme={null}
import { createZapierSdk } from "@zapier/zapier-sdk";

// Initialize with browser-based auth (from `zapier-sdk login`)
const zapier = createZapierSdk();
```

## Step 5: List Your Connected Apps

Let's verify everything works by listing available apps:

```typescript theme={null}

// List the first page of apps
const { data: apps } = await zapier.listApps();

console.log(
  "Available apps:",
  apps.map((app) => app.title)
);
```

<Tip>
  This returns the first page of results. For large datasets, use `.items()` to
  iterate over all results or `maxItems` to limit the total. See the [API
  Reference](/sdk/reference) for pagination patterns.
</Tip>

Run your script:

```bash theme={null}
npx tsx index.ts
```

## Step 6: Run Your First Action

Now let's execute an action. First, you'll need a connection for the app you want to use:

```typescript theme={null}

// Get Slack connection

// Option 1: Use listConnections when you need to filter or 
// work with multiple connections.
const { data: allSlackConnections } = await zapier.listConnections({
  appKey: "slack",
  owner: "me",
  isExpired: false,
});

const acmeSlackConnection = allSlackConnections.find(c => c?.title?.toLowerCase().includes("acme"))
if (!acmeSlackConnection) {
  console.log(
    "Slack connection matching filter not found. Connect Slack at https://zapier.com/app/assets/connections"
  );
}

// Option 2: Use findFirstConnection when you just need the first 
// available connection and let any errors bubble up
const { data: firstSlackConnection } = await zapier.findFirstConnection({
  appKey: "slack",
  owner: "me",
});

// List Slack channels using your connection
const { data: channels } = await zapier.runAction({
  appKey: "slack",
  actionType: "read",
  actionKey: "channels",
  connectionId: firstSlackConnection.id,
});

console.log("Your Slack channels:", channels);
```

## Step 7: Use the Proxy Pattern (Optional)

For a cleaner syntax, use the app proxy pattern:

```typescript theme={null}

const { data: firstSlackConnection } = await zapier.findFirstConnection({
  appKey: "slack",
  owner: "me",
  isExpired: false,
});

// Create a bound Slack instance
const mySlack = zapier.apps.slack({
  connectionId: firstSlackConnection.id,
});

// Now use it with a clean syntax
const { data: channels } = await mySlack.read.channels({});

console.log("Channels:", channels);

// Or pass auth inline without binding
const { data: users } = await zapier.apps.slack.search.user_by_email({
  inputs: { email: "colleague@company.com" },
  connectionId: firstSlackConnection.id,
});
```

## Step 8: Make Custom API Calls with `fetch` (Optional)

<Info>
  **Note on governance:** The `.fetch()` method makes authenticated API calls
  directly, giving you access to any supported endpoint. Unlike pre-built
  actions, these direct API calls are not currently subject to your org's app or
  action restriction policies. If your org has governance requirements, use
  pre-built actions where possible. Direct API governance is on the roadmap.
</Info>

When you need to call an API that doesn't have a built-in action, use `fetch` to make authenticated requests through the Zapier SDK:

```typescript theme={null}

// Get your Slack connection
const { data: slackConnection } = await zapier.findFirstConnection({
  appKey: "slack",
  owner: "me",
  isExpired: false,
});

if (!slackConnection) {
  console.log(
    "No Slack connection found. Connect Slack at https://zapier.com/app/assets/connections"
  );
  process.exit(1);
}

// Make a custom API call—Zapier injects the user's credentials
const response = await zapier.fetch("https://slack.com/api/users.list", {
  method: "GET",
  connectionId: slackConnection.id,
});

const users = await response.json();
```

## Complete Example

Here's a full example that sends a Slack message:

```typescript theme={null}
import { createZapierSdk } from "@zapier/zapier-sdk";

async function main() {
  const zapier = createZapierSdk();

  // Get Slack connection
  const { data: firstSlackConnection } = await zapier.findFirstConnection({
    appKey: "slack",
    owner: "me",
    isExpired: false,
  });

  // Create bound Slack instance
  const slack = zapier.apps.slack({
    connectionId: firstSlackConnection.id,
  });

  // Get available channels
  const { data: channels } = (await slack.read.channels({})) as {
    data: Array<{ id: string; name: string }>;
  };
  const testChannel = channels.find((c) => c.name === "testing");

  if (!testChannel) {
    throw new Error("Could not find #testing channel");
  }

  // Send a message
  const { data: result } = await slack.write.channel_message({
    inputs: {
      channel: testChannel.id,
      text: "Hello from the Zapier SDK!",
    },
  });

  console.log("Message sent!", result);
}

main().catch(console.error);
```

## Next Steps

* [API Reference](/sdk/reference) — full documentation of all SDK methods and patterns
* [CLI Reference](/sdk/cli-reference) — command-line tools including list-apps, add, and view-policy
* [Browse integrations](https://zapier.com/apps) — 9,000+ apps you can connect
* [Try the demo use case](/sdk) — the meeting reschedule example on the overview page is a confirmed working end-to-end scenario, good for testing your setup
* [Hit a problem?](https://npsup.zapier.app/contact-us?product=Zapier%20SDK) — tell us what broke via the feedback form
