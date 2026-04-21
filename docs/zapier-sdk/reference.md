> ## Documentation Index
> Fetch the complete documentation index at: https://docs.zapier.com/llms.txt
> Use this file to discover all available pages before exploring further.

# API Reference

> Complete reference for all Zapier SDK methods

This page documents all available methods in the Zapier SDK.

## Installation

```bash theme={null}
npm install @zapier/zapier-sdk
npm install -D @zapier/zapier-sdk-cli @types/node typescript
```

## Initialization

**Option 1: Browser-based auth**

Running `npx zapier-sdk login` authenticates through your browser and stores a token on your local machine. As long as you have the CLI package installed as a development dependency, the SDK will automatically use it.

```typescript theme={null}
import { createZapierSdk } from "@zapier/zapier-sdk";

const zapier = createZapierSdk();
```

**Option 2: Client credentials**

Provide a client ID and client secret. You can get these by running `npx zapier-sdk create-client-credentials`. This allows you to run the SDK in a server/serverless environment.

```typescript theme={null}
import { createZapierSdk } from "@zapier/zapier-sdk";

const zapier = createZapierSdk({
  credentials: {
    clientId: "your_client_id",
    clientSecret: "your_client_secret",
  },
});
```

**Option 3: Direct token**

Provide a valid Zapier token. This is for partner OAuth or internal Zapier use.

```typescript theme={null}
import { createZapierSdk } from "@zapier/zapier-sdk";

const zapier = createZapierSdk({
  credentials: "your_zapier_token_here",
});
```

***

## Accounts

### `getProfile`

Get current user's profile information

**Parameters:**

| Name      | Type     | Required | Description |
| --------- | -------- | -------- | ----------- |
| `options` | `object` | No       |             |

**Returns:** `Promise<ProfileItem>`

**Example:**

```typescript theme={null}
const { data: profile } = await zapier.getProfile();
```

***

## Actions

### `getAction`

Get detailed information about a specific action

**Parameters:**

| Name           | Type     | Required | Description                                                                                                   |
| -------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `options`      | `object` | Yes      |                                                                                                               |
| ↳ `app`        | `string` | Yes      | App slug (e.g., 'github'), implementation name (e.g., 'SlackCLIAPI'), or versioned ID (e.g., 'github\@1.2.3') |
| ↳ `actionType` | `string` | Yes      | Action type that matches the action's defined type                                                            |
| ↳ `action`     | `string` | Yes      | Action key (e.g., 'send\_message' or 'find\_row')                                                             |

**Returns:** `Promise<ActionItem>`

**Example:**

```typescript theme={null}
const { data: action } = await zapier.getAction({
  app: "example-value",
  actionType: "read",
  action: "example-value",
});
```

### `getInputFieldsSchema`

Get the JSON Schema representation of input fields for an action. Returns a JSON Schema object describing the structure, types, and validation rules for the action's input parameters.

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                                                        |
| -------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`      | `object`         | Yes      |                                                                                                                                                                    |
| ↳ `app`        | `string`         | Yes      | App key (e.g., 'SlackCLIAPI' or slug like 'github') to get the input schema for                                                                                    |
| ↳ `actionType` | `string`         | Yes      | Action type that matches the action's defined type                                                                                                                 |
| ↳ `action`     | `string`         | Yes      | Action key to get the input schema for                                                                                                                             |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. Mutually exclusive with connectionId. |
| ↳ `inputs`     | `object`         | No       | Current input values that may affect the schema (e.g., when fields depend on other field values)                                                                   |

**Returns:** `Promise<InputSchemaItem>`

**Example:**

```typescript theme={null}
const { data: inputSchema } = await zapier.getInputFieldsSchema({
  app: "example-value",
  actionType: "read",
  action: "example-value",
});
```

### `listActions`

List all actions for a specific app

**Parameters:**

| Name           | Type     | Required | Description                                                            |
| -------------- | -------- | -------- | ---------------------------------------------------------------------- |
| `options`      | `object` | Yes      |                                                                        |
| ↳ `app`        | `string` | Yes      | App key of actions to list (e.g., 'SlackCLIAPI' or slug like 'github') |
| ↳ `actionType` | `string` | No       | Filter actions by type                                                 |
| ↳ `pageSize`   | `number` | No       | Number of actions per page                                             |
| ↳ `maxItems`   | `number` | No       | Maximum total items to return across all pages                         |
| ↳ `cursor`     | `string` | No       | Cursor to start from                                                   |

**Returns:** `Promise<PaginatedResult<ActionItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: actions, nextCursor } = await zapier.listActions({
  app: "example-value",
});

// Or iterate over all pages
for await (const page of zapier.listActions({
  app: "example-value",
})) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const action of zapier
  .listActions({
    app: "example-value",
  })
  .items()) {
  // Do something with each action
}
```

### `listInputFieldChoices`

Get the available choices for a dynamic dropdown input field

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                                                        |
| -------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`      | `object`         | Yes      |                                                                                                                                                                    |
| ↳ `app`        | `string`         | Yes      | App slug (e.g., 'github'), implementation name (e.g., 'SlackCLIAPI'), or versioned ID (e.g., 'github\@1.2.3')                                                      |
| ↳ `actionType` | `string`         | Yes      | Action type that matches the action's defined type                                                                                                                 |
| ↳ `action`     | `string`         | Yes      | Action key (e.g., 'send\_message' or 'find\_row')                                                                                                                  |
| ↳ `inputField` | `string`         | Yes      | Input field key to get choices for                                                                                                                                 |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. Mutually exclusive with connectionId. |
| ↳ `inputs`     | `object`         | No       | Current input values that may affect available choices                                                                                                             |
| ↳ `page`       | `number`         | No       | Page number for paginated results                                                                                                                                  |
| ↳ `pageSize`   | `number`         | No       | Number of choices per page                                                                                                                                         |
| ↳ `maxItems`   | `number`         | No       | Maximum total items to return across all pages                                                                                                                     |
| ↳ `cursor`     | `string`         | No       | Cursor to start from                                                                                                                                               |

**Returns:** `Promise<PaginatedResult<InputFieldChoiceItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: inputFieldChoices, nextCursor } =
  await zapier.listInputFieldChoices({
    app: "example-value",
    actionType: "read",
    action: "example-value",
    inputField: "example-value",
  });

// Or iterate over all pages
for await (const page of zapier.listInputFieldChoices({
  app: "example-value",
  actionType: "read",
  action: "example-value",
  inputField: "example-value",
})) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const inputFieldChoice of zapier
  .listInputFieldChoices({
    app: "example-value",
    actionType: "read",
    action: "example-value",
    inputField: "example-value",
  })
  .items()) {
  // Do something with each inputFieldChoice
}
```

### `listInputFields`

Get the input fields required for a specific action

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                                                        |
| -------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`      | `object`         | Yes      |                                                                                                                                                                    |
| ↳ `app`        | `string`         | Yes      | App slug (e.g., 'github'), implementation name (e.g., 'SlackCLIAPI'), or versioned ID (e.g., 'github\@1.2.3')                                                      |
| ↳ `actionType` | `string`         | Yes      | Action type that matches the action's defined type                                                                                                                 |
| ↳ `action`     | `string`         | Yes      | Action key (e.g., 'send\_message' or 'find\_row')                                                                                                                  |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. Mutually exclusive with connectionId. |
| ↳ `inputs`     | `object`         | No       | Current input values that may affect available fields                                                                                                              |
| ↳ `pageSize`   | `number`         | No       | Number of input fields per page                                                                                                                                    |
| ↳ `maxItems`   | `number`         | No       | Maximum total items to return across all pages                                                                                                                     |
| ↳ `cursor`     | `string`         | No       | Cursor to start from                                                                                                                                               |

**Returns:** `Promise<PaginatedResult<RootFieldItemItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: rootFieldItems, nextCursor } = await zapier.listInputFields({
  app: "example-value",
  actionType: "read",
  action: "example-value",
});

// Or iterate over all pages
for await (const page of zapier.listInputFields({
  app: "example-value",
  actionType: "read",
  action: "example-value",
})) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const rootFieldItem of zapier
  .listInputFields({
    app: "example-value",
    actionType: "read",
    action: "example-value",
  })
  .items()) {
  // Do something with each rootFieldItem
}
```

### `runAction`

Execute an action with the given inputs

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                                                        |
| -------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`      | `object`         | Yes      |                                                                                                                                                                    |
| ↳ `app`        | `string`         | Yes      | App slug (e.g., 'github'), implementation name (e.g., 'SlackCLIAPI'), or versioned ID (e.g., 'github\@1.2.3')                                                      |
| ↳ `actionType` | `string`         | Yes      | Action type that matches the action's defined type                                                                                                                 |
| ↳ `action`     | `string`         | Yes      | Action key (e.g., 'send\_message' or 'find\_row')                                                                                                                  |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. Mutually exclusive with connectionId. |
| ↳ `inputs`     | `object`         | No       | Input parameters for the action                                                                                                                                    |
| ↳ `timeoutMs`  | `number`         | No       | Maximum time to wait for action completion in milliseconds (default: 180000)                                                                                       |
| ↳ `pageSize`   | `number`         | No       | Number of results per page                                                                                                                                         |
| ↳ `maxItems`   | `number`         | No       | Maximum total items to return across all pages                                                                                                                     |
| ↳ `cursor`     | `string`         | No       | Cursor to start from                                                                                                                                               |

**Returns:** `Promise<PaginatedResult<ActionResultItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: actionResults, nextCursor } = await zapier.runAction({
  app: "example-value",
  actionType: "read",
  action: "example-value",
});

// Or iterate over all pages
for await (const page of zapier.runAction({
  app: "example-value",
  actionType: "read",
  action: "example-value",
})) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const actionResult of zapier
  .runAction({
    app: "example-value",
    actionType: "read",
    action: "example-value",
  })
  .items()) {
  // Do something with each actionResult
}
```

***

## Apps

### `apps.{appKey}`

Bind a connection alias or numeric connectionId to an app

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                  |
| -------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `options`      | `object`         | Yes      |                                                                                                                              |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. |

**Returns:** `Promise<AppProxy>`

**Example:**

```typescript theme={null}
const result = await zapier.apps.appKey();
```

### `apps.{appKey}.{actionType}.{actionKey}`

Execute an action with the given inputs for the bound app, as an alternative to runAction

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                  |
| -------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `options`      | `object`         | Yes      |                                                                                                                              |
| ↳ `inputs`     | `object`         | No       |                                                                                                                              |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. |
| ↳ `timeoutMs`  | `number`         | No       | Maximum time to wait for action completion in milliseconds (default: 180000)                                                 |

**Returns:** `Promise<PaginatedResult<ActionResultItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: actionResults, nextCursor } =
  await zapier.apps.appKey.actionType.actionKey();

// Or iterate over all pages
for await (const page of zapier.apps.appKey.actionType.actionKey()) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const actionResult of zapier.apps.appKey.actionType
  .actionKey()
  .items()) {
  // Do something with each actionResult
}
```

### `getApp`

Get detailed information about a specific app

**Parameters:**

| Name      | Type     | Required | Description                                                                                                   |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `options` | `object` | Yes      |                                                                                                               |
| ↳ `app`   | `string` | Yes      | App slug (e.g., 'github'), implementation name (e.g., 'SlackCLIAPI'), or versioned ID (e.g., 'github\@1.2.3') |

**Returns:** `Promise<AppItem>`

**Example:**

```typescript theme={null}
const { data: app } = await zapier.getApp({
  app: "example-value",
});
```

### `listApps`

List all available apps with optional filtering

**Parameters:**

| Name         | Type     | Required | Description                                                         |
| ------------ | -------- | -------- | ------------------------------------------------------------------- |
| `options`    | `object` | Yes      |                                                                     |
| ↳ `search`   | `string` | No       | Search term to filter apps by name                                  |
| ↳ `pageSize` | `number` | No       | Number of apps per page                                             |
| ↳ `apps`     | `array`  | No       | Filter apps by app keys (e.g., 'SlackCLIAPI' or slug like 'github') |
| ↳ `maxItems` | `number` | No       | Maximum total items to return across all pages                      |
| ↳ `cursor`   | `string` | No       | Cursor to start from                                                |

**Returns:** `Promise<PaginatedResult<AppItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: apps, nextCursor } = await zapier.listApps();

// Or iterate over all pages
for await (const page of zapier.listApps()) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const app of zapier.listApps().items()) {
  // Do something with each app
}
```

***

## Client Credentials

### `createClientCredentials`

Create new client credentials for the authenticated user

**Parameters:**

| Name              | Type     | Required | Description                                    |
| ----------------- | -------- | -------- | ---------------------------------------------- |
| `options`         | `object` | Yes      |                                                |
| ↳ `name`          | `string` | Yes      | Human-readable name for the client credentials |
| ↳ `allowedScopes` | `array`  | No       | Scopes to allow for these credentials          |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.createClientCredentials({
  name: "example-value",
});
```

### `deleteClientCredentials`

Delete client credentials by client ID

**Parameters:**

| Name         | Type     | Required | Description                                       |
| ------------ | -------- | -------- | ------------------------------------------------- |
| `options`    | `object` | Yes      |                                                   |
| ↳ `clientId` | `string` | Yes      | The client ID of the client credentials to delete |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.deleteClientCredentials({
  clientId: "example-id",
});
```

### `listClientCredentials`

List client credentials for the authenticated user

**Parameters:**

| Name         | Type     | Required | Description                                    |
| ------------ | -------- | -------- | ---------------------------------------------- |
| `options`    | `object` | Yes      |                                                |
| ↳ `pageSize` | `number` | No       | Number of credentials per page                 |
| ↳ `maxItems` | `number` | No       | Maximum total items to return across all pages |
| ↳ `cursor`   | `string` | No       | Cursor to start from                           |

**Returns:** `Promise<PaginatedResult<ClientCredentialsItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: clientCredentials, nextCursor } =
  await zapier.listClientCredentials();

// Or iterate over all pages
for await (const page of zapier.listClientCredentials()) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const clientCredentials of zapier.listClientCredentials().items()) {
  // Do something with each clientCredentials
}
```

***

## Connections

### `findFirstConnection`

Find the first connection matching the criteria

**Parameters:**

| Name              | Type      | Required | Description                                                                                                                                         |
| ----------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`         | `object`  | Yes      |                                                                                                                                                     |
| ↳ `search`        | `string`  | No       | Search term to filter connections by title                                                                                                          |
| ↳ `title`         | `string`  | No       | Filter connections by exact title match (searches first, then filters locally)                                                                      |
| ↳ `owner`         | `string`  | No       | Filter by owner, 'me' for your own connections or a specific user ID                                                                                |
| ↳ `app`           | `string`  | No       | App key of connections to list (e.g., 'SlackCLIAPI' or slug like 'github')                                                                          |
| ↳ `account`       | `string`  | No       | Account to filter by                                                                                                                                |
| ↳ `includeShared` | `boolean` | No       | Include connections shared with you. By default, only your own connections are returned (owner=me). Set to true to also include shared connections. |
| ↳ `expired`       | `boolean` | No       | Show only expired connections (default: only non-expired connections are returned)                                                                  |

**Returns:** `Promise<ConnectionItem>`

**Example:**

```typescript theme={null}
const { data: connection } = await zapier.findFirstConnection();
```

### `findUniqueConnection`

Find a unique connection matching the criteria

**Parameters:**

| Name              | Type      | Required | Description                                                                                                                                         |
| ----------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`         | `object`  | Yes      |                                                                                                                                                     |
| ↳ `search`        | `string`  | No       | Search term to filter connections by title                                                                                                          |
| ↳ `title`         | `string`  | No       | Filter connections by exact title match (searches first, then filters locally)                                                                      |
| ↳ `owner`         | `string`  | No       | Filter by owner, 'me' for your own connections or a specific user ID                                                                                |
| ↳ `app`           | `string`  | No       | App key of connections to list (e.g., 'SlackCLIAPI' or slug like 'github')                                                                          |
| ↳ `account`       | `string`  | No       | Account to filter by                                                                                                                                |
| ↳ `includeShared` | `boolean` | No       | Include connections shared with you. By default, only your own connections are returned (owner=me). Set to true to also include shared connections. |
| ↳ `expired`       | `boolean` | No       | Show only expired connections (default: only non-expired connections are returned)                                                                  |

**Returns:** `Promise<ConnectionItem>`

**Example:**

```typescript theme={null}
const { data: connection } = await zapier.findUniqueConnection();
```

### `getConnection`

Execute getConnection

**Parameters:**

| Name           | Type             | Required | Description                                                                                                                  |
| -------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `options`      | `object`         | Yes      |                                                                                                                              |
| ↳ `connection` | `string, number` | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. |

**Returns:** `Promise<ConnectionItem>`

**Example:**

```typescript theme={null}
const { data: connection } = await zapier.getConnection();
```

### `listConnections`

List available connections with optional filtering

**Parameters:**

| Name              | Type      | Required | Description                                                                                                                                         |
| ----------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`         | `object`  | Yes      |                                                                                                                                                     |
| ↳ `search`        | `string`  | No       | Search term to filter connections by title                                                                                                          |
| ↳ `title`         | `string`  | No       | Filter connections by exact title match (searches first, then filters locally)                                                                      |
| ↳ `owner`         | `string`  | No       | Filter by owner, 'me' for your own connections or a specific user ID                                                                                |
| ↳ `app`           | `string`  | No       | App key of connections to list (e.g., 'SlackCLIAPI' or slug like 'github')                                                                          |
| ↳ `connections`   | `array`   | No       | List of connection IDs to filter by                                                                                                                 |
| ↳ `account`       | `string`  | No       | Account to filter by                                                                                                                                |
| ↳ `includeShared` | `boolean` | No       | Include connections shared with you. By default, only your own connections are returned (owner=me). Set to true to also include shared connections. |
| ↳ `expired`       | `boolean` | No       | Show only expired connections (default: only non-expired connections are returned)                                                                  |
| ↳ `pageSize`      | `number`  | No       | Number of connections per page                                                                                                                      |
| ↳ `maxItems`      | `number`  | No       | Maximum total items to return across all pages                                                                                                      |
| ↳ `cursor`        | `string`  | No       | Cursor to start from                                                                                                                                |

**Returns:** `Promise<PaginatedResult<ConnectionItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: connections, nextCursor } = await zapier.listConnections();

// Or iterate over all pages
for await (const page of zapier.listConnections()) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const connection of zapier.listConnections().items()) {
  // Do something with each connection
}
```

***

## HTTP Requests

### `fetch`

Make authenticated HTTP requests to any API through Zapier. Pass a connectionId to automatically inject the user's stored credentials (OAuth tokens, API keys, etc.) into the outgoing request. Mirrors the native fetch(url, init?) signature with additional Zapier-specific options.

**Parameters:**

| Name            | Type                     | Required | Description                                                                                                                  |
| --------------- | ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `url`           | `string, custom`         | Yes      | The full URL of the API endpoint to call (proxied through Zapier's Relay service)                                            |
| `init`          | `object`                 | No       | Request options including method, headers, body, and authentication                                                          |
| ↳ `method`      | `string`                 | No       | HTTP method for the request (defaults to GET)                                                                                |
| ↳ `headers`     | `object`                 | No       | HTTP headers to include in the request                                                                                       |
| ↳ `body`        | `string, custom, record` | No       | Request body — plain objects and JSON strings are auto-detected and Content-Type is set accordingly                          |
| ↳ `connection`  | `string, number`         | No       | Connection alias (string) or numeric connectionId. Strings are resolved from the connections map; numbers are used directly. |
| ↳ `callbackUrl` | `string`                 | No       | URL to send async response to (makes request async)                                                                          |

**Returns:** `Promise<Response>`

**Example:**

```typescript theme={null}
const result = await zapier.fetch("example-value", { key: "value" });
```

***

## Tables

### `createTable`

Create a new table

**Parameters:**

| Name            | Type     | Required | Description                          |
| --------------- | -------- | -------- | ------------------------------------ |
| `options`       | `object` | Yes      |                                      |
| ↳ `name`        | `string` | Yes      | The name for the new table           |
| ↳ `description` | `string` | No       | An optional description of the table |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.createTable({
  name: "example-value",
});
```

### `createTableFields`

Create one or more fields in a table

**Parameters:**

| Name       | Type     | Required | Description                          |
| ---------- | -------- | -------- | ------------------------------------ |
| `options`  | `object` | Yes      |                                      |
| ↳ `table`  | `string` | Yes      | The unique identifier of the table   |
| ↳ `fields` | `array`  | Yes      | Array of field definitions to create |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.createTableFields({
  table: "example-value",
  fields: ["example-item"],
});
```

### `createTableRecords`

Create one or more records in a table

**Parameters:**

| Name        | Type     | Required | Description                                                                                                                       |
| ----------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `options`   | `object` | Yes      |                                                                                                                                   |
| ↳ `table`   | `string` | Yes      | The unique identifier of the table                                                                                                |
| ↳ `records` | `array`  | Yes      | Array of records to create (max 100)                                                                                              |
| ↳ `keyMode` | `string` | No       | How to interpret field keys in record data. "names" (default) uses human-readable field names, "ids" uses raw field IDs (f1, f2). |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.createTableRecords({
  table: "example-value",
  records: ["example-item"],
});
```

### `deleteTable`

Delete a table by its ID

**Parameters:**

| Name      | Type     | Required | Description                        |
| --------- | -------- | -------- | ---------------------------------- |
| `options` | `object` | Yes      |                                    |
| ↳ `table` | `string` | Yes      | The unique identifier of the table |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.deleteTable({
  table: "example-value",
});
```

### `deleteTableFields`

Delete one or more fields from a table

**Parameters:**

| Name       | Type     | Required | Description                        |
| ---------- | -------- | -------- | ---------------------------------- |
| `options`  | `object` | Yes      |                                    |
| ↳ `table`  | `string` | Yes      | The unique identifier of the table |
| ↳ `fields` | `array`  | Yes      |                                    |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.deleteTableFields({
  table: "example-value",
  fields: ["example-item"],
});
```

### `deleteTableRecords`

Delete one or more records from a table

**Parameters:**

| Name        | Type     | Required | Description                        |
| ----------- | -------- | -------- | ---------------------------------- |
| `options`   | `object` | Yes      |                                    |
| ↳ `table`   | `string` | Yes      | The unique identifier of the table |
| ↳ `records` | `array`  | Yes      | Record IDs to operate on           |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.deleteTableRecords({
  table: "example-value",
  records: ["example-item"],
});
```

### `getTable`

Get detailed information about a specific table

**Parameters:**

| Name      | Type     | Required | Description                        |
| --------- | -------- | -------- | ---------------------------------- |
| `options` | `object` | Yes      |                                    |
| ↳ `table` | `string` | Yes      | The unique identifier of the table |

**Returns:** `Promise<TableItem>`

**Example:**

```typescript theme={null}
const { data: table } = await zapier.getTable({
  table: "example-value",
});
```

### `getTableRecord`

Get a single record from a table by ID

**Parameters:**

| Name        | Type     | Required | Description                                                                                                                       |
| ----------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `options`   | `object` | Yes      |                                                                                                                                   |
| ↳ `table`   | `string` | Yes      | The unique identifier of the table                                                                                                |
| ↳ `record`  | `string` | Yes      | The unique identifier of the record                                                                                               |
| ↳ `keyMode` | `string` | No       | How to interpret field keys in record data. "names" (default) uses human-readable field names, "ids" uses raw field IDs (f1, f2). |

**Returns:** `Promise<RecordItem>`

**Example:**

```typescript theme={null}
const { data: record } = await zapier.getTableRecord({
  table: "example-value",
  record: "example-value",
});
```

### `listTableFields`

List fields for a table

**Parameters:**

| Name       | Type     | Required | Description                                                                               |
| ---------- | -------- | -------- | ----------------------------------------------------------------------------------------- |
| `options`  | `object` | Yes      |                                                                                           |
| ↳ `table`  | `string` | Yes      | The unique identifier of the table                                                        |
| ↳ `fields` | `array`  | No       | Fields to operate on. Accepts field names (e.g., "Email") or IDs (e.g., "f6", "6", or 6). |

**Returns:** `Promise<PaginatedResult<FieldItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: fields, nextCursor } = await zapier.listTableFields({
  table: "example-value",
});

// Or iterate over all pages
for await (const page of zapier.listTableFields({
  table: "example-value",
})) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const field of zapier
  .listTableFields({
    table: "example-value",
  })
  .items()) {
  // Do something with each field
}
```

### `listTableRecords`

List records in a table with optional filtering and sorting

**Parameters:**

| Name             | Type     | Required | Description                                                                                                                       |
| ---------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `options`        | `object` | Yes      |                                                                                                                                   |
| ↳ `table`        | `string` | Yes      | The unique identifier of the table                                                                                                |
| ↳ `filters`      | `array`  | No       | Filter conditions for the query                                                                                                   |
| ↳ `sort`         | `object` | No       | Sort records by a field                                                                                                           |
|    ↳ `fieldKey`  | `string` | Yes      | The field key to sort by                                                                                                          |
|    ↳ `direction` | `string` | No       | Sort direction                                                                                                                    |
| ↳ `pageSize`     | `number` | No       | Number of records per page (max 1000)                                                                                             |
| ↳ `maxItems`     | `number` | No       | Maximum total items to return across all pages                                                                                    |
| ↳ `cursor`       | `string` | No       | Cursor to start from                                                                                                              |
| ↳ `keyMode`      | `string` | No       | How to interpret field keys in record data. "names" (default) uses human-readable field names, "ids" uses raw field IDs (f1, f2). |

**Returns:** `Promise<PaginatedResult<RecordItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: records, nextCursor } = await zapier.listTableRecords({
  table: "example-value",
});

// Or iterate over all pages
for await (const page of zapier.listTableRecords({
  table: "example-value",
})) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const record of zapier
  .listTableRecords({
    table: "example-value",
  })
  .items()) {
  // Do something with each record
}
```

### `listTables`

List tables available to the authenticated user

**Parameters:**

| Name              | Type      | Required | Description                                                                                                    |
| ----------------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `options`         | `object`  | Yes      |                                                                                                                |
| ↳ `tables`        | `array`   | No       | Filter by specific table IDs                                                                                   |
| ↳ `kind`          | `string`  | No       | Filter by table type                                                                                           |
| ↳ `search`        | `string`  | No       | Search term to filter tables by name                                                                           |
| ↳ `owner`         | `string`  | No       | Filter by table owner. Use "me" for the current user, or a numeric user ID. Requires includeShared to be true. |
| ↳ `includeShared` | `boolean` | No       | Include tables shared with you. Without this, only your own tables are returned.                               |
| ↳ `pageSize`      | `number`  | No       | Number of tables per page                                                                                      |
| ↳ `maxItems`      | `number`  | No       | Maximum total items to return across all pages                                                                 |
| ↳ `cursor`        | `string`  | No       | Cursor to start from                                                                                           |

**Returns:** `Promise<PaginatedResult<TableItem>>`

**Example:**

```typescript theme={null}
// Get first page and a cursor for the second page
const { data: tables, nextCursor } = await zapier.listTables();

// Or iterate over all pages
for await (const page of zapier.listTables()) {
  // Do something with each page
}

// Or iterate over individual items across all pages
for await (const table of zapier.listTables().items()) {
  // Do something with each table
}
```

### `updateTableRecords`

Update one or more records in a table

**Parameters:**

| Name        | Type     | Required | Description                                                                                                                       |
| ----------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `options`   | `object` | Yes      |                                                                                                                                   |
| ↳ `table`   | `string` | Yes      | The unique identifier of the table                                                                                                |
| ↳ `records` | `array`  | Yes      | Array of records to update (max 100)                                                                                              |
| ↳ `keyMode` | `string` | No       | How to interpret field keys in record data. "names" (default) uses human-readable field names, "ids" uses raw field IDs (f1, f2). |

**Returns:** `Promise<any>`

**Example:**

```typescript theme={null}
const result = await zapier.updateTableRecords({
  table: "example-value",
  records: ["example-item"],
});
```
