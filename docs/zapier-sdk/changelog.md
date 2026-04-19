> ## Documentation Index
> Fetch the complete documentation index at: https://docs.zapier.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Changelog

> Release history for the Zapier TypeScript SDK and the Zapier SDK CLI

For usage details, see the [API Reference](/sdk/reference) and [CLI Reference](/sdk/cli-reference).

## TypeScript SDK (`@zapier/zapier-sdk`)

<a id="typescript-sdk-0-40-1" />

### 0.40.1

Several **top-level method options** were renamed so flexible resource references use **suffix-less** names (`app` instead of `appKey`, `connection` instead of `connectionId`, and so on). The values you pass are the same as before—slugs, implementation keys, versioned IDs, connection aliases, numeric IDs, and other supported forms. The goal is one obvious parameter per resource and less ambiguity between `*Key` and `*Id` now that parameters like `connection` already accept multiple identifier styles.

**Note:** This is **not a breaking change**. The old parameter names still work; they are **deprecated**.

| Old name        | New name      |
| --------------- | ------------- |
| `appKey`        | `app`         |
| `appKeys`       | `apps`        |
| `actionKey`     | `action`      |
| `inputFieldKey` | `inputField`  |
| `connectionId`  | `connection`  |
| `connectionIds` | `connections` |
| `tableId`       | `table`       |
| `tableIds`      | `tables`      |
| `recordId`      | `record`      |
| `recordIds`     | `records`     |
| `fieldKeys`     | `fields`      |
| `accountId`     | `account`     |

## CLI (`@zapier/zapier-sdk-cli`)

### 0.39.1

CLI **flags and options** were renamed to match **[TypeScript SDK 0.40.1](#typescript-sdk-0-40-1)**—the same suffix-less resource naming, accepted values, and deprecation approach as in that release.

**Note:** This is **not a breaking change**. The old flag names still work; they are **deprecated**.

| Old flag / option   | New flag / option |
| ------------------- | ----------------- |
| `--app-key`         | `--app`           |
| `--app-keys`        | `--apps`          |
| `--action-key`      | `--action`        |
| `--input-field-key` | `--input-field`   |
| `--connection-id`   | `--connection`    |
| `--connection-ids`  | `--connections`   |
| `--table-id`        | `--table`         |
| `--table-ids`       | `--tables`        |
| `--record-id`       | `--record`        |
| `--record-ids`      | `--records`       |
| `--field-keys`      | `--fields`        |
| `--account-id`      | `--account`       |
