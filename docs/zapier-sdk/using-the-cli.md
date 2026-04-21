> ## Documentation Index
> Fetch the complete documentation index at: https://docs.zapier.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Using the CLI

The Zapier SDK CLI lets you explore and run actions across 8,000+ apps directly from your terminal, authenticated, with no OAuth setup required. It's the fastest way to understand what an app can do and what inputs an action needs before writing any code.

> **CLI and SDK, complementary by design**
>
> <p>
>   The CLI is built on the SDK and is the fastest way to explore — discover
>   what an app can do, inspect input fields, and run actions interactively. You
>   or an agent can go back and forth with it freely: try an action, check what
>   fields it needs, adjust inputs, repeat. For some agent use cases, the CLI
>   alone may be enough.
> </p>
>
> <p>
>   When you need something repeatable, embedded, or production-grade — a
>   scheduled workflow, a backend integration, a tool in an AI agent — reach for
>   the TypeScript SDK. Everything you learned with the CLI transfers directly:
>   same app keys, same action keys, same input shapes.
> </p>

***

## Before You Start

Install the CLI and authenticate:

```bash theme={null}
npm install @zapier/zapier-sdk
npm install -D @zapier/zapier-sdk-cli

npx zapier-sdk login
```

`login` opens your browser and stores a token locally. The CLI handles everything else automatically.

<AccordionGroup>
  <Accordion title="Alternative: manage credentials programmatically with client credentials">
    Instead of `login`, you can create long-lived client credentials, useful for CI pipelines or environments where a browser flow isn't possible.

    ```bash theme={null}
    npx zapier-sdk create-client-credentials "my-script"
    ```

    ```json Response theme={null}
    {
      "client_id": "Abcdefghijklmnopqrstuvwxyz1234567890",
      "name": "my-script",
      "client_secret": "37893783ajshj3hy387893hjjk3jk3839083"
    }
    ```

    Save the `client_secret`; it's only shown once. Use the returned `client_id` and `client_secret` wherever the CLI needs authentication instead of the interactive login token.

    To remove a credential pair when you no longer need it, use the `delete-client-credentials` command and pass the `client_id`:

    ```bash theme={null}
    npx zapier-sdk delete-client-credentials Abcdefghijklmnopqrstuvwxyz1234567890
    ```
  </Accordion>
</AccordionGroup>

***

## Key Concepts

CLI commands work with three concepts: **apps**, **connections**, and **actions**.

An **app** is an integration — Google Sheets, Slack, GitHub. Each app has an **app key**, a short identifier you use in every command (`google-sheets`, `slack`, `github`).

A **connection** is an authenticated account for an app — your personal Google account, a Slack bot account, a CI GitHub account. Each connection has a **connection ID** that you pass with every action call to tell the CLI which account to use.

An **action** is something the app can do — create a spreadsheet, add a row, send a message. Each action has **input fields**: the specific values it needs to run. Some input fields are static; others are dynamic and only appear once you provide context (like which spreadsheet you're targeting as each may have different columns).

## Apps and Connections

**App keys come in two forms.** Commands take an `app` as a positional argument, which can be a short slug like `google-sheets` or a longer key like `GoogleSheetsV2CLIAPI`.

Slugs are easier to type and remember, so use those when you can. When in doubt, search:

```bash theme={null}
npx zapier-sdk list-apps --search "google sheets" --json
```

```json Response theme={null}
[
  {
    "slug": "google-sheets",
    "key": "GoogleSheetsV2CLIAPI",
    "title": "Google Sheets",
    "description": "Create, edit, and share spreadsheets wherever you are with Google Sheets, and get automated insights from your data.",
    ...
  }
]
```

Use the `slug` as the `app` in all subsequent action commands for that specific app.

**Every action needs a connection ID.** A connection ID ties a command to a specific authenticated account, like your Google Sheets connection, Slack account, or GitHub org.

List all connections you already have for an app:

```bash theme={null}
npx zapier-sdk list-connections google-sheets --json
```

```json Response theme={null}
[
  {
    "id": "12345678",
    "title": "foo@example.com",
    "app_key": "GoogleSheetsV2CLIAPI",
    ...
  },
  ...
]
```

Find the first matching connection for your account:

```bash theme={null}
npx zapier-sdk find-first-connection google-sheets --json
```

```json Response theme={null}
{
  "id": "12345678",
  "title": "foo@example.com",
  "app_key": "GoogleSheetsV2CLIAPI",
  ...
}
```

Hold onto that `id`. You'll use it in every action call.

<AccordionGroup>
  <Accordion title="Other ways to find a connection">
    **`find-unique-connection`** has the same syntax as `find-first-connection`, but throws an error if more than one connection matches.
    Use this when you need to be certain you got the right account, not just the first one.

    ```bash theme={null}
    npx zapier-sdk find-unique-connection google-sheets --owner me --json
    ```

    ```text Response theme={null}
    {
      "id": "789101112",
      "date": "2026-02-20T20:40:40Z",
      "account_id": "2000001",
      "is_invite_only": false,
      "is_private": false,
      "shared_with_all": false,
      "lastchanged": "2026-02-20T20:41:10Z",
      "destination_selected_api": null,
      "is_stale": "false",
      "is_shared": "false",
      "marked_stale_at": null,
      "label": "baz@example.com",
      "identifier": null,
      "title": "Google sheets - baz@example.com",
      "url": "http://zapier.com/api/authentications/v1/authentications/789101112",
      "groups": [],
      "members": "",
      "permissions": {
        "delete": true,
        "edit": true,
        "reconnect": true,
        "share": true,
        "test": true,
        "transfer": true,
        "use": true
      },
      "implementation_id": "GoogleSheetsV2CLIAPI@2.10.1",
      "profile_id": "7777777",
      "is_expired": "false",
      "expired_at": null,
      "app_key": "GoogleSheetsV2CLIAPI",
      "app_version": "2.10.1"
    }
    ```

    **`list-connections`** returns all matching connections as a paginated list.
    Useful when you have multiple Google accounts connected and need to pick the right one.

    ```bash theme={null}
    npx zapier-sdk list-connections google-sheets --json
    ```

    **`find-first-connection` with `--owner me`** filters to only connections you own, useful in shared Zapier accounts:

    ```bash theme={null}
    npx zapier-sdk find-first-connection google-sheets --owner me --json
    ```

    **Filter to expired connections** to audit which connections need to be re-authenticated:

    ```bash theme={null}
    npx zapier-sdk list-connections google-sheets --is-expired --json
    ```
  </Accordion>
</AccordionGroup>

***

## Walkthrough: Create a Spreadsheet, Then Add Rows

This walkthrough shows the full pattern: connect to an app, discover what it can do, figure out what inputs an action needs, and run it.

We'll create a new Google Sheet with a header row and then add rows to it.

### Explore available actions

```bash theme={null}
npx zapier-sdk list-actions google-sheets --json
```

```json Response theme={null}
[
  {
    "key": "get_many_rows",
    "title": "Get Many Spreadsheet Rows (Advanced)",
    "action_type": "search",
    "description": "Return up to 1,500 rows as a single JSON value or as line items.",
    ...
  },
  ...,
  {
    "key": "lookup_row",
    "title": "Lookup Spreadsheet Row",
    "action_type": "search",
    "description": "Find a specific spreadsheet row based on a column and value. If found, it returns the entire row.",
    ...
  },
  ...,
  {
    "key": "lookup_row",
    "title": "Find or Create Row",
    "action_type": "search_or_write",
    "description": "Finds or creates a specific lookup row.",
    ...
  },
  ...,
  {
    "key": "add_row",
    "title": "Create Spreadsheet Row",
    "action_type": "write",
    "description": "Create a new row in a specific spreadsheet.",
    ...
  },
  ...,
  {
    "key": "create_spreadsheet",
    "title": "Create Spreadsheet",
    "action_type": "write",
    "description": "Creates a new spreadsheet. Choose from a blank spreadsheet, a copy of an existing one, or one with headers.",
    ...
  },
  {
    "key": "create_worksheet",
    "title": "Create Worksheet",
    "action_type": "write",
    "description": "Creates a new worksheet in a Google Sheet.",
    ...
  },
  ...
]
```

Filter by action type to narrow things down:

```bash theme={null}
npx zapier-sdk list-actions google-sheets --action-type write --json
```

```json Response theme={null}
[
  {
    "key": "add_row",
    "title": "Create Spreadsheet Row",
    "action_type": "write",
    "description": "Create a new row in a specific spreadsheet.",
    ...
  },
  ...,
  {
    "key": "create_spreadsheet",
    "title": "Create Spreadsheet",
    "action_type": "write",
    "description": "Creates a new spreadsheet. Choose from a blank spreadsheet, a copy of an existing one, or one with headers.",
    ...
  },
  {
    "key": "create_worksheet",
    "title": "Create Worksheet",
    "action_type": "write",
    "description": "Creates a new worksheet in a Google Sheet.",
    ...
  },
  ...
]
```

<AccordionGroup>
  <Accordion title="Other ways to explore actions">
    **`get-action`** is for when you already know the action key and want its full detail instead of scanning a list:

    ```bash theme={null}
    npx zapier-sdk get-action google-sheets write create_spreadsheet --json
    ```

    ```json Response theme={null}
    {
      "key": "create_spreadsheet",
      "title": "Create Spreadsheet",
      "action_type": "write",
      "description": "Creates a new spreadsheet. Choose from a blank spreadsheet, a copy of an existing one, or one with headers.",
      ...
    }
    ```

    **`--page-size`** is useful when apps like Salesforce or HubSpot have many actions and you want to page through the results

    ```bash theme={null}
    npx zapier-sdk list-actions hubspot --action-type write --page-size 20
    ```
  </Accordion>
</AccordionGroup>

***

### Inspect spreadsheet creation inputs

Before running an action, use `list-input-fields` to see exactly what it expects:

```bash theme={null}
npx zapier-sdk list-input-fields google-sheets write create_spreadsheet \
  --connection-id 789101112 --json
```

```json Response theme={null}
[
  {
    "key": "drive",
    "title": "Drive",
    "is_required": false,
    "description": "Select the Google Drive location for your spreadsheet. Choose between My Drive or a Shared Drive; the former is the default.",
    ...
  },
  {
    "key": "title",
    "title": "Title",
    "is_required": true,
    "description": "Enter the name of the new spreadsheet.",
    ...
  },
  {
    "key": "spreadsheet_to_copy",
    "title": "Spreadsheet to Copy",
    "is_required": false,
    "description": "Select a spreadsheet to duplicate.",
    ...
  },
  {
    "key": "headers",
    "title": "Headers",
    "is_required": false,
    "description": "Enter column headers for your new spreadsheet. These will be ignored if \"Spreadsheet to Copy\" is selected.",
    ...
  }
]
```

<AccordionGroup>
  <Accordion title="Other ways to inspect input fields">
    **`get-input-fields-schema`** returns the same information as a JSON Schema object instead of a list. Useful when you're building an agent tool definition or need machine-readable validation rules:

    ```bash theme={null}
    npx zapier-sdk get-input-fields-schema google-sheets write create_spreadsheet \
      --connection-id 789101112 --json
    ```

    ```json Response theme={null}
    {
      "$schema": "http://json-schema.org/draft-06/schema#",
      "type": "object",
      "properties": {
        "drive": {
          "type": "string",
          "zapier:dynamicEnum": true,
          "title": "Drive",
          "description": "Select the Google Drive location for your spreadsheet. Choose between My Drive or a Shared Drive; the former is the default."
        },
        "title": {
          "type": "string",
          "title": "Title",
          "description": "Enter the name of the new spreadsheet."
        },
        "spreadsheet_to_copy": {
          "type": "string",
          "zapier:dynamicEnum": true,
          "title": "Spreadsheet to Copy",
          "description": "Select a spreadsheet to duplicate."
        },
        "headers": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "title": "Headers",
          "description": "Enter column headers for your new spreadsheet. These will be ignored if \"Spreadsheet to Copy\" is selected."
        }
      },
      "additionalProperties": false,
      "required": ["title"]
    }
    ```
  </Accordion>
</AccordionGroup>

***

### Create a spreadsheet

```bash theme={null}
npx zapier-sdk run-action google-sheets write create_spreadsheet \
  --connection-id 789101112 \
  --inputs '{"title": "Zapier SDK CLI Demo", "headers": ["Name", "Email", "Role"]}' \
  --json
```

```json Response theme={null}
[
  {
    "id": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
    "worksheet_id": 0,
    "url": "https://docs.google.com/spreadsheets/d/3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237/edit?ouid=112649538831883565437"
  }
]
```

The `headers` field populates the first row of the default sheet (`Sheet1`) in one step — no separate worksheet creation needed.

Note the spreadsheet `id` — that's your `spreadsheetId`.

The response also includes a `worksheetId` field (the numeric sheet ID, `0` for the default sheet); you'll pass both to `add_row`.

***

### Inspect row creation inputs

Without context, `list-input-fields` returns only the structural fields — spreadsheet and worksheet selectors, but no column fields:

```bash theme={null}
npx zapier-sdk list-input-fields google-sheets write add_row \
  --connection-id 789101112 --json
```

```json Response theme={null}
[
  {
    "key": "spreadsheet",
    "title": "Spreadsheet",
    "is_required": true,
    ...
  },
  {
    "key": "worksheet",
    "title": "Worksheet",
    "is_required": true,
    "description": "Worksheets must have column headers. Learn more about [spreadsheet formatting](https://help.zapier.com/hc/en-us/articles/8496276985101-Work-with-Google-Sheets-in-Zaps).",
    ...
  },
  ...
]
```

The column fields are dynamic — they don't exist until the action knows which spreadsheet and worksheet you're targeting. Pass those IDs to get the full field list, including the per-column keys:

```bash theme={null}
npx zapier-sdk list-input-fields google-sheets write add_row \
  --connection-id 789101112 \
  --inputs '{"spreadsheet": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237", "worksheet": "0"}' \
  --json
```

```json Response theme={null}
[
  {
    "key": "spreadsheet",
    "title": "Spreadsheet",
    "is_required": true,
    ...
  },
  {
    "key": "worksheet",
    "title": "Worksheet",
    "is_required": true,
    "description": "Worksheets must have column headers. Learn more about [spreadsheet formatting](https://help.zapier.com/hc/en-us/articles/8496276985101-Work-with-Google-Sheets-in-Zaps).",
    ...
  },
  ...,
  {
    "key": "COL$A",
    "title": "Name",
    "is_required": false,
    ...
  },
  {
    "key": "COL$B",
    "title": "Email",
    "is_required": false,
    ...
  },
  {
    "key": "COL$C",
    "title": "Role",
    "is_required": false,
    ...
  }
]
```

`COL$A` maps to "Name", `COL$B` to "Email", and `COL$C` to "Role" — the headers you defined when creating the spreadsheet. These are the keys you'll use in `--inputs` below.

***

### Add rows

```bash theme={null}
npx zapier-sdk run-action google-sheets write add_row \
  --connection-id 789101112 \
  --inputs '{
    "spreadsheet": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
    "worksheet": "0",
    "COL$A": "Alice",
    "COL$B": "alice@example.com",
    "COL$C": "Engineer"
  }' \
  --json
```

```json Response theme={null}
[
  {
    "COL$A": "Alice",
    "COL$B": "alice@example.com",
    "COL$C": "Engineer",
    "id": 2,
    "row": 2
  }
]
```

```bash theme={null}
npx zapier-sdk run-action google-sheets write add_row \
  --connection-id 789101112 \
  --inputs '{
    "spreadsheet": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
    "worksheet": "0",
    "COL$A": "Bob",
    "COL$B": "bob@example.com",
    "COL$C": "Designer"
  }' \
  --json
```

```json Response theme={null}
[
  {
    "COL$A": "Bob",
    "COL$B": "bob@example.com",
    "COL$C": "Designer",
    "id": 3,
    "row": 3
  }
]
```

```bash theme={null}
npx zapier-sdk run-action google-sheets write add_row \
  --connection-id 789101112 \
  --inputs '{
    "spreadsheet": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
    "worksheet": "0",
    "COL$A": "Carol",
    "COL$B": "carol@example.com",
    "COL$C": "Manager"
  }' \
  --json
```

```json Response theme={null}
[
  {
    "COL$A": "Carol",
    "COL$B": "carol@example.com",
    "COL$C": "Manager",
    "id": 4,
    "row": 4
  }
]
```

Check your spreadsheet; all three rows should be there.

***

## Zero Auth Setup

Here's what you just did without writing a single line of auth code:

```
WITHOUT the SDK CLI                        WITH Zapier SDK CLI
─────────────────────────   ─────────────────────
1. Create a Google Cloud project           1. npx zapier-sdk login
2. Enable the Sheets API                   2. npx zapier-sdk run-action …
3. Create a service account
4. Generate and download a JSON key file
5. Generate a Bearer token from the key
6. curl with Authorization header
```

If a user has a Google account connected to Zapier, `find-first-connection` gives you authenticated access immediately. This is true for all 8,000+ apps on Zapier.

***

## Beyond built-in actions

Zapier's 8,000+ apps cover the most common operations, but every API has endpoints that go beyond what's been modeled as actions.

For those cases, use `curl` — it makes authenticated requests to any endpoint directly, with credentials injected automatically from the same connection you've been using.

### GET: Read row data

The Google Sheets API's `values` endpoint returns the raw cell data for a named range, useful as a ground-truth read outside of the SDK action layer:

```bash theme={null}
npx zapier-sdk curl \
  "https://sheets.googleapis.com/v4/spreadsheets/3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237/values/Sheet1" \
  --connection-id 789101112
```

```json Response theme={null}
{
  "range": "Sheet1!A1:Z1004",
  "majorDimension": "ROWS",
  "values": [
    ["Name", "Email", "Role"],
    ["Alice", "alice@example.com", "Engineer"],
    ["Bob", "bob@example.com", "Designer"],
    ["Carol", "carol@example.com", "Manager"]
  ]
}
```

### GET: Spreadsheet metadata

The `spreadsheets.get` endpoint returns full spreadsheet metadata (sheet names, tab structure, locale, timezone) that isn't exposed as a built-in Zapier action:

```bash theme={null}
npx zapier-sdk curl \
  "https://sheets.googleapis.com/v4/spreadsheets/3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237" \
  --connection-id 789101112
```

```json Response theme={null}
{
  "spreadsheetId": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
  "properties": {
    "title": "Zapier SDK CLI Demo",
    "locale": "en_US",
    "timeZone": "Etc/GMT",
    ...
  },
  "sheets": [
    {
      "properties": {
        "sheetId": 0,
        "title": "Sheet1",
        "sheetType": "GRID",
        ...
      }
    }
  ]
}
```

No token. No `Authorization` header. No OAuth setup. Zapier injects the user's stored credentials automatically.

### POST: Add a row directly via the API

```bash theme={null}
npx zapier-sdk curl \
  "https://sheets.googleapis.com/v4/spreadsheets/3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237/values/Sheet1:append?valueInputOption=USER_ENTERED" \
  --connection-id 789101112 \
  -X POST \
  --json '{"values": [["Dave", "dave@example.com", "Analyst"]]}'
```

```json Response theme={null}
{
  "spreadsheetId": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
  "tableRange": "Sheet1!A1:C4",
  "updates": {
    "spreadsheetId": "3780-dhjhj34784jjh4kkl48_48934uk-49834jkA237",
    "updatedRange": "Sheet1!A5:C5",
    "updatedRows": 1,
    "updatedColumns": 3,
    "updatedCells": 3
  }
}
```

***

## Scripting and chaining commands

Every command supports `--json` for raw output, making it easy to pipe into `jq` or chain into shell scripts. A common pattern: grab a connection ID and use it immediately:

```bash theme={null}
CONNECTION_ID=$(npx zapier-sdk find-first-connection google-sheets --json | jq -r '.data.id')

npx zapier-sdk run-action google-sheets write create_spreadsheet \
  --connection-id $CONNECTION_ID \
  --inputs '{"title": "Generated Sheet"}' \
  --json
```

Extract just the action keys for an app:

```bash theme={null}
npx zapier-sdk list-actions google-sheets --json | jq '[.[].key]'
```

***

## Next Steps

* [CLI Reference](/sdk/cli-reference): full flag reference for every command
* [API Reference](/sdk/reference): TypeScript SDK methods that mirror everything shown here
