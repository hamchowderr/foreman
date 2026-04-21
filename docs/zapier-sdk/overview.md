> ## Documentation Index
> Fetch the complete documentation index at: https://docs.zapier.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Zapier SDK

> Let your agent connect to anything. Zapier handles the keys.

<Info>
  **The Zapier SDK is now in open beta.** Access is free — try it, break it, and
  tell us what to fix. [Give feedback →](https://npsup.zapier.app/contact-us?product=Zapier%20SDK)
</Info>

The SDK gives coding agents and builders programmatic access to Zapier's full app ecosystem. Any API call, on behalf of a user, with no OAuth setup required. Where MCP gives agents a curated menu of pre-built actions, the SDK lets agents go further: write loops, handle edge cases, chain complex logic across apps.

Zapier handles auth, token refresh, retries, and API quirks across 9,000+ integrations. Your agent handles the logic.

<Columns cols={2}>
  <Card title="For coding agents">
    Agents can write code in seconds. What they can't do is manage OAuth at
    scale, handle webhook subscriptions, or enforce enterprise permissions. The
    SDK is the interface agents reach for when they need to connect to an app,
    take an action, or respond to an event without setting up the auth
    infrastructure every time.
  </Card>

  <Card title="For builders of AI products">
    Every builder working with agents is either solving the auth problem
    themselves — OAuth for each app, token refresh, retries — or going without
    it entirely (ungoverned, unaudited). The SDK replaces that with one
    integration, backed by the same infrastructure running Zapier's full app
    catalog.
  </Card>
</Columns>

## SDK or MCP — Which One Do You Need?

|              | MCP                                                 | SDK                                                                                         |
| :----------- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| Best for     | Chat agents                                         | Coding agents                                                                               |
| Access model | Curated menu of pre-built actions                   | Any API call, in code, authenticated by Zapier                                              |
| Use when     | You want a fast, governed set of tools for an agent | You need loops, conditionals, error handling, or calls that go beyond the pre-built catalog |

Most teams end up using both. MCP for conversational agent interfaces; SDK when those agents need to execute code reliably in production.

## What's Available in Open Beta

### In now

* **Full action catalog** — invoke any of 9,000+ pre-built actions across Zapier's full app catalog through one programmable interface
* **API call** — raw authenticated HTTP calls to ~3,600 app APIs via Zapier's infrastructure; go beyond pre-built actions to call any supported endpoint directly (more coming soon!)
* **App and action governance** — if your org has restricted specific apps or actions inside Zapier, those policies apply automatically to SDK traffic that uses pre-built actions
* **Free during early access** — no billing changes during the open beta window

### Coming soon

* **Triggers API** — subscribe to real-time events across connected apps in code; no polling, no custom webhook infrastructure (targeting May 2026)
* **Agent approval flow** — users review and approve what an agent can do before it acts on their behalf
* **Self-serve enterprise opt-in/out** — workspace admins toggle SDK access directly, no ticket required
* **Direct API governance** — today, governance applies to pre-built actions only; direct API calls are not yet governable at the policy level. Direct API governance is in progress.

### Not in scope for open beta

* Full raw API call coverage across *all* 9,000 apps

<Warning>
  **Enterprise and Team plans:** These accounts are off by default. [Contact
  us](https://npsup.zapier.app/contact-us?product=Zapier%20SDK) for manual opt-in.
</Warning>

## A Note on Governance

App and action restrictions your org has set up in Zapier apply automatically to SDK pre-built actions — no extra configuration. However, the SDK also provides direct API access via `.fetch()`, which currently falls outside those policy controls.

<Warning>
  **Important:** If your agent calls a pre-built action, that action is
  governed. If it calls the underlying API endpoint directly via `.fetch()`, it
  is not yet governed. Direct API governance is on the roadmap.
</Warning>

## Key Features

* **9,000+ App Integrations**: Access Zapier's entire ecosystem of pre-built connectors
* **Type-Safe**: Full TypeScript support with generated types for every app and action
* **Simple Authentication**: Browser-based login, client credentials, or direct token for seamless auth
* **Paginated Results**: Simple pagination and iteration over lists of resources
* **Built-in Actions**: Easily call our built-in actions with a simple `apps.slack.write.channel_message()` syntax.
* **Custom API Requests**: Use our `fetch` method and make authenticated requests to any API through Zapier's infrastructure to go beyond our built-in actions

## Get Started

Or [follow the manual quickstart guide](/sdk/quickstart) to set up step by step.

### What Can You Build?

### Example Use Case: Reschedule a meeting and notify attendees

Your user says: *"Move my 2pm meeting to Thursday and let the attendees know."*

Your agent finds the meeting in Google Calendar, reschedules it, and messages each attendee in Slack - all via the SDK:

```typescript
import { createZapierSdk } from "@zapier/zapier-sdk";

const zapier = createZapierSdk();

// Bind the user's connected accounts
const { data: calConnection } = await zapier.findFirstConnection({
  appKey: "google-calendar",
  owner: "me",
  isExpired: false,
});
const { data: slackConnection } = await zapier.findFirstConnection({
  appKey: "slack",
  owner: "me",
  isExpired: false,
});

const calendar = zapier.apps.google_calendar({
  connectionId: calConnection.id,
});
const slack = zapier.apps.slack({ connectionId: slackConnection.id });

// Find a specific meeting
const { data: events } = await calendar.search.event_v2({
  inputs: {
    calendarid: "Calendar ID",
    search_term: "Meeting Title",
  },
});
const meeting = events[0] as {
  id: string;
  summary: string;
  attendees: { email: string }[];
};

// Move it to Thursday
await calendar.write.update_event({
  inputs: {
    calendarid: "Calendar ID",
    eventid: meeting.id,
    start__dateTime: "2026-02-19T12:00:00-00:00",
    end__dateTime: "2026-02-19T12:30:00-00:00",
  },
});

// Look up Slack user IDs for all attendees
const slackUsers = await Promise.all(
  meeting.attendees.map((attendee) =>
    slack.search.user_by_email({ inputs: { email: attendee.email } }),
  ),
);

// Notify each attendee via Slack DM
for (const { data } of slackUsers) {
  const user = data[0] as { id: string };
  await slack.write.direct_message({
    inputs: {
      channel: user.id,
      text: `Our "${meeting.summary}" meeting has been moved to Thursday at 12pm.`,
    },
  });
}
```

## **What's happening under the hood:**

* **`findFirstConnection`** retrieves the user's connected Google Calendar and Slack accounts — no OAuth flows to build
* **`apps.google_calendar(...)`** binds your connect once, so every subsequent call uses those credentials
* **`search`**, **`write`**, and **`read`** map to the type of action: find data, create/update data, or list data
* The SDK handles token refresh, retries, and API differences across apps — your agent just calls actions

## Feedback

<Tip>
  **Going beyond local development?** You'll need to create Client Credentials
  and treat them like any other sensitive API key. See the [API
  Reference](/sdk/reference#client-credentials) for setup.
</Tip>

<Note>
  **We want your feedback.** The SDK is still taking shape and your input drives
  what we build next. Hit a bug? Missing a feature? Have an idea? [Tell us about
  it](https://npsup.zapier.app/contact-us?product=Zapier%20SDK)
</Note>
