# @zapier/zapier-sdk-cli

## 0.39.9

### Patch Changes

- a50b594: Fix ZodObject param handling in CLI

## 0.39.8

### Patch Changes

- Updated dependencies [912e960]
  - @zapier/zapier-sdk@0.41.0
  - @zapier/zapier-sdk-mcp@0.10.11

## 0.39.7

### Patch Changes

- Updated dependencies [e3f5a81]
  - @zapier/zapier-sdk@0.40.4
  - @zapier/zapier-sdk-mcp@0.10.10

## 0.39.6

### Patch Changes

- 381f3a6: Hide the bundle-code command from CLI help and generated docs

## 0.39.5

### Patch Changes

- 9df023c: Fix empty input handling for optional params with placeholder

## 0.39.4

### Patch Changes

- 5aff110: Fix bug previously including envelope for curl with json input

## 0.39.3

### Patch Changes

- b250545: Connections - Replace isExpired with expired
- Updated dependencies [b250545]
  - @zapier/zapier-sdk@0.40.3
  - @zapier/zapier-sdk-mcp@0.10.9

## 0.39.2

### Patch Changes

- 362bc56: Make sure CLI only shows non-deprecated positional parameters.
- Updated dependencies [362bc56]
  - @zapier/zapier-sdk@0.40.2
  - @zapier/zapier-sdk-mcp@0.10.8

## 0.39.1

### Patch Changes

- 5391c65: Fix ordering problem with tables CLI commands.
- Updated dependencies [5391c65]
  - @zapier/zapier-sdk@0.40.1
  - @zapier/zapier-sdk-mcp@0.10.7

## 0.39.0

### Minor Changes

- 39e296a: Removing Id or Key suffixes from parameter names to make them flexible to be ID, key, name, alias, etc.

### Patch Changes

- Updated dependencies [39e296a]
  - @zapier/zapier-sdk@0.40.0
  - @zapier/zapier-sdk-mcp@0.10.6

## 0.38.2

### Patch Changes

- Updated dependencies [b4c0560]
  - @zapier/zapier-sdk@0.39.1
  - @zapier/zapier-sdk-mcp@0.10.5

## 0.38.1

### Patch Changes

- Updated dependencies [a20d36a]
  - @zapier/zapier-sdk@0.39.0
  - @zapier/zapier-sdk-mcp@0.10.4

## 0.38.0

### Minor Changes

- 0ec936e: Move @zapier/zapier-durable into the zapier-sdk monorepo and wire up CLI integration (durable-run, durable-callback, durable-status commands).

## 0.37.0

### Minor Changes

- 2906101: Default `listConnections` and `listTables` to only return your own items. Gate shared access and table deletion behind boolean flags: `canIncludeSharedConnections`, `canIncludeSharedTables`, `canDeleteTables`. Set via SDK options, `.zapierrc`, CLI flags (`--can-delete-tables`), or env vars (`ZAPIER_CAN_DELETE_TABLES=true`).

### Patch Changes

- Updated dependencies [2906101]
  - @zapier/zapier-sdk@0.38.0
  - @zapier/zapier-sdk-mcp@0.10.3

## 0.36.3

### Patch Changes

- Updated dependencies [307aa98]
  - @zapier/zapier-sdk@0.37.0
  - @zapier/zapier-sdk-mcp@0.10.2

## 0.36.2

### Patch Changes

- 9d08988: Fix short alias for fail to match curl

## 0.36.1

### Patch Changes

- Updated dependencies [3a447d3]
  - @zapier/zapier-sdk@0.36.0
  - @zapier/zapier-sdk-mcp@0.10.1

## 0.36.0

### Minor Changes

- d4534f3: Add support for Tables.

### Patch Changes

- Updated dependencies [d4534f3]
  - @zapier/zapier-sdk-cli-login@0.9.0
  - @zapier/zapier-sdk-mcp@0.10.0
  - @zapier/zapier-sdk@0.35.0

## 0.35.1

### Patch Changes

- 6c5bba9: Fix fetch type for app proxy without generated types.
- Updated dependencies [6c5bba9]
  - @zapier/zapier-sdk-cli-login@0.8.3
  - @zapier/zapier-sdk-mcp@0.9.23
  - @zapier/zapier-sdk@0.34.1

## 0.35.0

### Minor Changes

- 3700f6a: Fix --json output

### Patch Changes

- Updated dependencies [3700f6a]
  - @zapier/zapier-sdk@0.34.0
  - @zapier/zapier-sdk-mcp@0.9.22

## 0.34.12

### Patch Changes

- d9e0f1d: Fix user properties being overwritten by context merge in telemetry events
- Updated dependencies [d9e0f1d]
  - @zapier/zapier-sdk@0.33.4
  - @zapier/zapier-sdk-mcp@0.9.21

## 0.34.11

### Patch Changes

- f676852: Suppress resolver method calls from emitting telemetry events
- Updated dependencies [f676852]
  - @zapier/zapier-sdk@0.33.3
  - @zapier/zapier-sdk-mcp@0.9.20

## 0.34.10

### Patch Changes

- 623dc25: Add deprecation warning for fetch CLI command
- Updated dependencies [623dc25]
  - @zapier/zapier-sdk@0.33.2
  - @zapier/zapier-sdk-mcp@0.9.19

## 0.34.9

### Patch Changes

- 42edf6e: Remove test files from published packages
- Updated dependencies [42edf6e]
  - @zapier/zapier-sdk@0.33.1
  - @zapier/zapier-sdk-cli-login@0.8.2
  - @zapier/zapier-sdk-mcp@0.9.18

## 0.34.8

### Patch Changes

- Updated dependencies [f442359]
  - @zapier/zapier-sdk@0.33.0
  - @zapier/zapier-sdk-mcp@0.9.17

## 0.34.7

### Patch Changes

- Updated dependencies [0feaeb1]
  - @zapier/zapier-sdk@0.32.5
  - @zapier/zapier-sdk-mcp@0.9.16

## 0.34.6

### Patch Changes

- 1334eac: Emit login_success lifecycle event on CLI login
- Updated dependencies [1334eac]
  - @zapier/zapier-sdk@0.32.4
  - @zapier/zapier-sdk-mcp@0.9.15

## 0.34.5

### Patch Changes

- Updated dependencies [3663fc3]
  - @zapier/zapier-sdk-cli-login@0.8.1
  - @zapier/zapier-sdk@0.32.3

## 0.34.4

### Patch Changes

- 04000f6: Skip connection selection for apps that do not require auth
- Updated dependencies [04000f6]
  - @zapier/zapier-sdk@0.32.3
  - @zapier/zapier-sdk-mcp@0.9.14

## 0.34.3

### Patch Changes

- Updated dependencies [a6dec83]
  - @zapier/zapier-sdk@0.32.2
  - @zapier/zapier-sdk-mcp@0.9.13

## 0.34.2

### Patch Changes

- 2860435: Emit telemetry events for all CLI commands

## 0.34.1

### Patch Changes

- c7be13e: Fix bug where `add` command hangs after completing successfully
- Updated dependencies [c7be13e]
  - @zapier/zapier-sdk@0.32.1
  - @zapier/zapier-sdk-mcp@0.9.12

## 0.34.0

### Minor Changes

- 250cb7d: Store CLI login credentials in system keychain.

### Patch Changes

- Updated dependencies [250cb7d]
  - @zapier/zapier-sdk-cli-login@0.8.0
  - @zapier/zapier-sdk@0.32.0
  - @zapier/zapier-sdk-mcp@0.9.11

## 0.33.0

### Minor Changes

- 77a1a7b: Introduce init command to bootstrap a new project with SDK

## 0.32.4

### Patch Changes

- Updated dependencies [026ae46]
  - @zapier/zapier-sdk@0.31.4
  - @zapier/zapier-sdk-mcp@0.9.10

## 0.32.3

### Patch Changes

- c98008a: Add callContext option to EventEmissionConfig to track where SDK method calls originate. MethodCalledEvent telemetry events now populate call_context with "sdk", "cli", or "mcp" instead of null.
- Updated dependencies [c98008a]
  - @zapier/zapier-sdk-mcp@0.9.9
  - @zapier/zapier-sdk@0.31.3

## 0.32.2

### Patch Changes

- 1ae0349: Improve error message when credentials can't be found. Also improve module resolution for login module.
- Updated dependencies [1ae0349]
  - @zapier/zapier-sdk@0.31.2
  - @zapier/zapier-sdk-mcp@0.9.8

## 0.32.1

### Patch Changes

- Updated dependencies [b0f273f]
  - @zapier/zapier-sdk@0.31.1
  - @zapier/zapier-sdk-mcp@0.9.7

## 0.32.0

### Minor Changes

- 4a874c6: Add Zod schema for base SDK options, autodoc generation for SDK factory options and CLI base command options

### Patch Changes

- Updated dependencies [4a874c6]
  - @zapier/zapier-sdk@0.31.0
  - @zapier/zapier-sdk-mcp@0.9.6

## 0.31.2

### Patch Changes

- Updated dependencies [0055854]
  - @zapier/zapier-sdk@0.30.0
  - @zapier/zapier-sdk-mcp@0.9.5

## 0.31.1

### Patch Changes

- a49a7af: Fix bug in array option handling in the CLI causing create-client-credentials to fail.

## 0.31.0

### Minor Changes

- ad5ee3b: Adds a new curl plugin.
  Switch -v flag to -V for version information.
  Fix CLI to properly handle string and object types.
  Add redirect passthrough to fetch plugin (to support curl plugin).

### Patch Changes

- Updated dependencies [ad5ee3b]
  - @zapier/zapier-sdk@0.29.0
  - @zapier/zapier-sdk-mcp@0.9.4

## 0.30.0

### Minor Changes

- b2e5675: Retry on 429s with appropriate backoff. Add maxNetworkRetries and maxNetworkRetryDelayMs options (also configurable via ZAPIER_MAX_NETWORK_RETRIES and ZAPIER_MAX_NETWORK_RETRY_DELAY_MS environment variables).

### Patch Changes

- Updated dependencies [b2e5675]
  - @zapier/zapier-sdk@0.28.0
  - @zapier/zapier-sdk-mcp@0.9.3

## 0.29.4

### Patch Changes

- c0ea9c8: Fix slack action in CLAUDE.md to channel_message

## 0.29.3

### Patch Changes

- Updated dependencies [ffcd15a]
  - @zapier/zapier-sdk-mcp@0.9.2

## 0.29.2

### Patch Changes

- d3e34ab: Fix update command for npm.

## 0.29.1

### Patch Changes

- 4ad0f34: Removed the `overall` option from the feedback command, since that will be inferred now. Also made it ask for feedback if you don't provide a value for it.
- Updated dependencies [4ad0f34]
  - @zapier/zapier-sdk@0.27.1
  - @zapier/zapier-sdk-mcp@0.9.1

## 0.29.0

### Minor Changes

- 9fb0b48: Switch from "authentication" to "connection" everywhere.

### Patch Changes

- Updated dependencies [9fb0b48]
  - @zapier/zapier-sdk-mcp@0.9.0
  - @zapier/zapier-sdk@0.27.0

## 0.28.0

### Minor Changes

- bfdd383: Remove authenticationTemplate option from fetch.

### Patch Changes

- Updated dependencies [bfdd383]
  - @zapier/zapier-sdk@0.26.0
  - @zapier/zapier-sdk-mcp@0.8.5

## 0.27.0

### Minor Changes

- 7ab8539: Adding feedback command for submitting SDK feedback

### Patch Changes

- Updated dependencies [7ab8539]
  - @zapier/zapier-sdk@0.25.3
  - @zapier/zapier-sdk-mcp@0.8.4

## 0.26.2

### Patch Changes

- 642713b: Update README with more detail and more attention on fetch.
- Updated dependencies [642713b]
  - @zapier/zapier-sdk@0.25.2
  - @zapier/zapier-sdk-mcp@0.8.3

## 0.26.1

### Patch Changes

- aacaf22: Improved `fetch` to automatically set the correct `Content-Type` header based on the request body type. `FormData`, `Blob`, and other binary bodies are now handled correctly instead of being misidentified as JSON.
- Updated dependencies [aacaf22]
  - @zapier/zapier-sdk@0.25.1
  - @zapier/zapier-sdk-mcp@0.8.2

## 0.26.0

### Minor Changes

- b0b7eb3: Add timeoutMs for setting the timeout for polling action results.

### Patch Changes

- Updated dependencies [b0b7eb3]
  - @zapier/zapier-sdk@0.25.0
  - @zapier/zapier-sdk-mcp@0.8.1

## 0.25.0

### Minor Changes

- d72cda1: Deprecates request() in favor of self-contained fetch(). The fetch plugin now handles URL-to-relay transformation, header normalization,
  and body content-type inference directly instead of delegating to request. The request plugin is preserved as a backward-compatible
  shim that forwards to fetch. CLI and MCP now expose a fetch command via a new inputParameters registry concept for
  multi-positional-argument functions.

### Patch Changes

- Updated dependencies [d72cda1]
  - @zapier/zapier-sdk-mcp@0.8.0
  - @zapier/zapier-sdk@0.24.0

## 0.24.4

### Patch Changes

- Updated dependencies [9664bd0]
  - @zapier/zapier-sdk@0.23.2
  - @zapier/zapier-sdk-mcp@0.7.6

## 0.24.3

### Patch Changes

- Updated dependencies [c95e1d4]
  - @zapier/zapier-sdk@0.23.1
  - @zapier/zapier-sdk-mcp@0.7.5

## 0.24.2

### Patch Changes

- Updated dependencies [7cf2b12]
  - @zapier/zapier-sdk-cli-login@0.7.0
  - @zapier/zapier-sdk@0.23.0
  - @zapier/zapier-sdk-mcp@0.7.4

## 0.24.1

### Patch Changes

- Updated dependencies [8ebde4b]
  - @zapier/zapier-sdk@0.22.1
  - @zapier/zapier-sdk-mcp@0.7.3

## 0.24.0

### Minor Changes

- f54f895: Fix allowed_scopes parameter to be allowedScopes.

### Patch Changes

- Updated dependencies [f54f895]
  - @zapier/zapier-sdk@0.22.0
  - @zapier/zapier-sdk-mcp@0.7.2

## 0.23.2

### Patch Changes

- dd54c22: `request` and `fetch` now require auth and provide a more helpful error message
- Updated dependencies [dd54c22]
  - @zapier/zapier-sdk-mcp@0.7.1
  - @zapier/zapier-sdk@0.21.1

## 0.23.1

### Patch Changes

- Updated dependencies [7ad92fe]
  - @zapier/zapier-sdk-mcp@0.7.0

## 0.23.0

### Minor Changes

- 33e2a8f: Added methods/commands for creating/listing/deleting client credentials.

### Patch Changes

- Updated dependencies [33e2a8f]
  - @zapier/zapier-sdk-cli-login@0.6.0
  - @zapier/zapier-sdk-mcp@0.6.0
  - @zapier/zapier-sdk@0.21.0

## 0.22.1

### Patch Changes

- Updated dependencies [7bd3c5c]
  - @zapier/zapier-sdk@0.20.1
  - @zapier/zapier-sdk-mcp@0.5.1

## 0.22.0

- Fix 0.21.0 saying to update to 0.21.0.

## 0.21.0

- Update dependency to @zapier/zapier-sdk@0.20.0 after accidentally publishing a major version update.

## 0.19.0

### Minor Changes

- 4dd27eb: Add isExpired parameter to listAuthentications for filtering authentications by expiration status.

### Patch Changes

- Updated dependencies [4dd27eb]
  - @zapier/zapier-sdk@1.1.0
  - @zapier/zapier-sdk-mcp@0.4.15

## 0.18.3

### Patch Changes

- e393401: Adds CLAUDE.md documentation files to the zapier-sdk and zapier-sdk-cli packages to help users get up to speed faster when using AI assistants like Claude, Cursor, etc.
- Updated dependencies [e393401]
  - @zapier/zapier-sdk@1.0.3
  - @zapier/zapier-sdk-mcp@0.4.14

## 0.18.2

### Patch Changes

- Updated dependencies [00ef417]
  - @zapier/zapier-sdk@1.0.2
  - @zapier/zapier-sdk-mcp@0.4.13

## 0.18.1

### Patch Changes

- Updated dependencies [aba842a]
  - @zapier/zapier-sdk@1.0.1
  - @zapier/zapier-sdk-mcp@0.4.12

## 0.18.0

### Minor Changes

- 97ff6c0: Add support for client credentials.

### Patch Changes

- Updated dependencies [97ff6c0]
  - @zapier/zapier-sdk-cli-login@0.4.0
  - @zapier/zapier-sdk@1.0.0
  - @zapier/zapier-sdk-mcp@0.4.11

## 0.17.4

### Patch Changes

- 3bc3cad: - Migrated `listApps` to call sdkapi endpoints directly, removing the temporary handler infrastructure. - Schemas now imported from `@zapier/zapier-sdk-core` for shared type definitions
- Updated dependencies [3bc3cad]
  - @zapier/zapier-sdk@0.18.4
  - @zapier/zapier-sdk-mcp@0.4.10

## 0.17.3

### Patch Changes

- 7c59b01: - `listAuthentications` now routes through the proxy. It also imports and overrides a shared schema from `zapier-sdk-core`
- Updated dependencies [7c59b01]
  - @zapier/zapier-sdk@0.18.3
  - @zapier/zapier-sdk-mcp@0.4.9

## 0.17.2

### Patch Changes

- 76fb606: - `getAuthentication` plugin now routes through proxy instead of direct Zapier API's
- Updated dependencies [76fb606]
  - @zapier/zapier-sdk@0.18.2
  - @zapier/zapier-sdk-mcp@0.4.8

## 0.17.1

### Patch Changes

- Updated dependencies [ee5beb6]
  - @zapier/zapier-sdk@0.18.1
  - @zapier/zapier-sdk-mcp@0.4.7

## 0.17.0

### Minor Changes

- c2eab85: Switch numeric IDs to strings.

### Patch Changes

- Updated dependencies [c2eab85]
  - @zapier/zapier-sdk@0.18.0
  - @zapier/zapier-sdk-mcp@0.4.6

## 0.16.9

### Patch Changes

- Updated dependencies [79b47f7]
  - @zapier/zapier-sdk@0.17.0
  - @zapier/zapier-sdk-mcp@0.4.5

## 0.16.8

### Patch Changes

- 870f2aa: Fix CLI process hanging after login and on signal handling
  - Clear login timeout timer after successful authentication to allow process exit
  - Use timer.unref() on telemetry timeouts so they don't block process exit
  - Add explicit process.exit() in signal handlers with correct exit codes

- Updated dependencies [870f2aa]
  - @zapier/zapier-sdk@0.16.3
  - @zapier/zapier-sdk-mcp@0.4.4

## 0.16.7

### Patch Changes

- 759d2d5: Fix update notification writing to stdout instead of stderr, which broke piping JSON output to jq

## 0.16.6

### Patch Changes

- Updated dependencies [f083442]
  - @zapier/zapier-sdk-mcp@0.4.3

## 0.16.5

### Patch Changes

- Updated dependencies [3466380]
  - @zapier/zapier-sdk-cli-login@0.3.7
  - @zapier/zapier-sdk@0.16.2

## 0.16.4

### Patch Changes

- Updated dependencies [93cbb3c]
  - @zapier/zapier-sdk@0.16.2
  - @zapier/zapier-sdk-mcp@0.4.2

## 0.16.3

### Patch Changes

- 142c1ce: Fix CLI UX issues: stdout truncation when piped, nullable schema detection for Zod 4, error body display, and auto Content-Type for JSON bodies
- Updated dependencies [142c1ce]
  - @zapier/zapier-sdk@0.16.1
  - @zapier/zapier-sdk-mcp@0.4.1

## 0.16.2

### Patch Changes

- 0434971: Make zapier-sdk-cli and zapier-sdk-cli-login packages public
- Updated dependencies [0434971]
  - @zapier/zapier-sdk-cli-login@0.3.6
  - @zapier/zapier-sdk@0.16.0

## 0.16.1

### Patch Changes

- e80d094: Fix CLI to extract JSON body from Response objects instead of showing raw Response representation. Adds error handling for invalid JSON responses with helpful error messages.

## 0.16.0

### Minor Changes

- 24ae4f0: Upgrade to Zod 4
  - Update all packages to use Zod 4
  - Migrate internal API access from `_def` to `_zod.def`
  - Update `z.record()` calls to include explicit key types
  - Fix schema introspection for documentation generation and CLI
  - Update MCP schema converter for Zod 4 structure

### Patch Changes

- Updated dependencies [24ae4f0]
  - @zapier/zapier-sdk-mcp@0.4.0
  - @zapier/zapier-sdk@0.16.0

## 0.15.14

### Patch Changes

- d08fa90: Add proper license
- Updated dependencies [d08fa90]
  - @zapier/zapier-sdk-cli-login@0.3.5
  - @zapier/zapier-sdk-mcp@0.3.39
  - @zapier/zapier-sdk@0.15.13

## 0.15.13

### Patch Changes

- Updated dependencies [9989512]
  - @zapier/zapier-sdk@0.15.12
  - @zapier/zapier-sdk-mcp@0.3.38

## 0.15.12

### Patch Changes

- Updated dependencies [b90e240]
  - @zapier/zapier-sdk-mcp@0.3.37

## 0.15.11

### Patch Changes

- Updated dependencies [64de0b0]
  - @zapier/zapier-sdk@0.15.11
  - @zapier/zapier-sdk-mcp@0.3.36

## 0.15.10

### Patch Changes

- ca83e51: Fix MCP server exiting immediately
- Updated dependencies [ca83e51]
  - @zapier/zapier-sdk-mcp@0.3.35

## 0.15.9

### Patch Changes

- 2f1fc5c: Remove inaccurate `peak_memory_usage_bytes` values from telemetry events
- Updated dependencies [2f1fc5c]
  - @zapier/zapier-sdk@0.15.10
  - @zapier/zapier-sdk-mcp@0.3.34

## 0.15.8

### Patch Changes

- Updated dependencies [450b009]
  - @zapier/zapier-sdk@0.15.9
  - @zapier/zapier-sdk-mcp@0.3.33

## 0.15.7

### Patch Changes

- Updated dependencies [371315e]
  - @zapier/zapier-sdk@0.15.8
  - @zapier/zapier-sdk-mcp@0.3.32

## 0.15.6

### Patch Changes

- Updated dependencies [9f3695b]
  - @zapier/zapier-sdk@0.15.7
  - @zapier/zapier-sdk-mcp@0.3.31

## 0.15.5

### Patch Changes

- Updated dependencies [6a0e0db]
  - @zapier/zapier-sdk@0.15.6
  - @zapier/zapier-sdk-mcp@0.3.30

## 0.15.4

### Patch Changes

- Updated dependencies [712c02b]
  - @zapier/zapier-sdk@0.15.5
  - @zapier/zapier-sdk-mcp@0.3.29

## 0.15.3

### Patch Changes

- f7e552e: Add synchronous customuser_id and account_id retrieval to event emission plugin
- Updated dependencies [f7e552e]
  - @zapier/zapier-sdk@0.15.4
  - @zapier/zapier-sdk-mcp@0.3.28

## 0.15.2

### Patch Changes

- a4aee2e: Enhanced param resolver to fully resolve dynamic input fields and dynamic choices.

## 0.15.1

### Patch Changes

- 6657f05: Defined shape and support for configured actions in the .zapierrc manifest file
- Updated dependencies [6657f05]
  - @zapier/zapier-sdk@0.15.3
  - @zapier/zapier-sdk-mcp@0.3.27

## 0.15.0

### Minor Changes

- bb96995: Use semver to check for update against cache. Otherwise, we might tell you to update to an older version.

## 0.14.1

### Patch Changes

- 064740d: Add `@latest` to update message.

## 0.14.0

### Minor Changes

- 5d82a5a: Add update/deprecation message.

## 0.13.16

### Patch Changes

- Updated dependencies [e4a3457]
  - @zapier/zapier-sdk@0.15.2
  - @zapier/zapier-sdk-mcp@0.3.26

## 0.13.15

### Patch Changes

- 4c78fb0: Added `getInputFieldsSchema` plugin to retrieve JSON Schema for action inputs
- Updated dependencies [4c78fb0]
  - @zapier/zapier-sdk-mcp@0.3.25
  - @zapier/zapier-sdk@0.15.1

## 0.13.14

### Patch Changes

- Updated dependencies [f92bc07]
  - @zapier/zapier-sdk@0.15.0
  - @zapier/zapier-sdk-mcp@0.3.24

## 0.13.13

### Patch Changes

- Updated dependencies [3f2f104]
  - @zapier/zapier-sdk@0.14.0
  - @zapier/zapier-sdk-mcp@0.3.23

## 0.13.12

### Patch Changes

- 492e2f9: - Add new `batch` utility method to handle concurency limits, retries, timeouts and exponential backoffs.
  - Refactor `generateAppTypes` in CLI to use the new `batch` utility
- Updated dependencies [492e2f9]
  - @zapier/zapier-sdk@0.13.9
  - @zapier/zapier-sdk-mcp@0.3.22

## 0.13.11

### Patch Changes

- 6de89a9: Allow overriding ZAPIER_BASE_URL with env vars, and also add new ZAPIER_TRACKING_BASE_URL, ZAPIER_AUTH_BASE_URL, and ZAPIER_AUTH_CLIENT_ID env vars and parameters.
- Updated dependencies [6de89a9]
  - @zapier/zapier-sdk-cli-login@0.3.4
  - @zapier/zapier-sdk@0.13.8
  - @zapier/zapier-sdk-mcp@0.3.21

## 0.13.10

### Patch Changes

- f56c6a0: Refactor buildManifest and generateAppTypes to throw proper errors, instead of returning an error property

## 0.13.9

### Patch Changes

- d7eb0ea: Pass all available options through createZapierSdkCliSdk into the base createZapierSdkWithoutRegistry

## 0.13.8

### Patch Changes

- Updated dependencies [c1d3c9c]
- Updated dependencies [16b4930]
  - @zapier/zapier-sdk@0.13.7
  - @zapier/zapier-sdk-mcp@0.3.20

## 0.13.7

### Patch Changes

- 9b7a954: Change OAuth client ID.
- a563cda: Extend ZapierCliSdkOptions with the base ZapierSdkOptions so we can see the token and other properties when initializing with createZapierSdkCli
- Updated dependencies [9b7a954]
- Updated dependencies [a563cda]
  - @zapier/zapier-sdk-cli-login@0.3.3
  - @zapier/zapier-sdk@0.13.6
  - @zapier/zapier-sdk-mcp@0.3.19

## 0.13.6

### Patch Changes

- 05ce6f7: 1. Extracted manifest creation and type generation into flexible base plugins that can be used by other consumers. 2. Updated updateManifestEntry function from base SDK to allow manipulating manifest as file or as JSON
- Updated dependencies [05ce6f7]
  - @zapier/zapier-sdk@0.13.5
  - @zapier/zapier-sdk-mcp@0.3.18

## 0.13.5

### Patch Changes

- 7184f27: Move typescript package from devDependencies to dependencies since it is needed at runtime for the CLI's add command.

## 0.13.4

### Patch Changes

- 80732ea: Add basic event-driven telemetry for key lifecycle events and CLI logins
- Updated dependencies [80732ea]
  - @zapier/zapier-sdk@0.13.4
  - @zapier/zapier-sdk-mcp@0.3.17

## 0.13.3

### Patch Changes

- 53fa85e: Show id and key properties when listing actions. Allow getAction to use an id or key. Make runAction pass action_id to API to ensure it always works.
- Updated dependencies [53fa85e]
  - @zapier/zapier-sdk@0.13.3
  - @zapier/zapier-sdk-mcp@0.3.16

## 0.13.2

### Patch Changes

- 325d5c2: Fix bug where adding apps with dashed slugs would create types with syntax errors. All valid keys are now valid properties on the apps interface.
- Updated dependencies [325d5c2]
  - @zapier/zapier-sdk@0.13.2
  - @zapier/zapier-sdk-mcp@0.3.15

## 0.13.1

### Patch Changes

- Updated dependencies [a607e3a]
  - @zapier/zapier-sdk@0.13.1
  - @zapier/zapier-sdk-mcp@0.3.14

## 0.13.0

### Minor Changes

- 53ad336: Tweak list-apps output. Hint at slug for appKey parameters. Fix type gen for new field format. Fix action normalization.

### Patch Changes

- Updated dependencies [53ad336]
  - @zapier/zapier-sdk@0.13.0
  - @zapier/zapier-sdk-mcp@0.3.13

## 0.12.1

### Patch Changes

- Updated dependencies [c2f88bc]
  - @zapier/zapier-sdk@0.12.1
  - @zapier/zapier-sdk-mcp@0.3.12

## 0.12.0

### Minor Changes

- 21d8487: Improved get started README and added more documentation to the add plugin

### Patch Changes

- Updated dependencies [21d8487]
  - @zapier/zapier-sdk@0.12.0
  - @zapier/zapier-sdk-mcp@0.3.11

## 0.11.2

### Patch Changes

- 407245e: Add packages to meta so we can document `fetch` for SDK but not CLI/MCP.
- Updated dependencies [407245e]
  - @zapier/zapier-sdk-mcp@0.3.10
  - @zapier/zapier-sdk@0.11.2

## 0.11.1

### Patch Changes

- 0002fe9: Updated doc generation
- Updated dependencies [0002fe9]
  - @zapier/zapier-sdk-mcp@0.3.9
  - @zapier/zapier-sdk@0.11.1

## 0.11.0

### Minor Changes

- 12c6d3d: Return nested fields with fieldsets instead of flat fields. Also have CLI properly create line items from fieldsets for run-action.

### Patch Changes

- Updated dependencies [12c6d3d]
  - @zapier/zapier-sdk@0.11.0
  - @zapier/zapier-sdk-mcp@0.3.8

## 0.10.0

### Minor Changes

- 3184903: No more global resolver registry, each plugin function has its own resolvers. Plugin function meta also stores output schema and some function type info to avoid some special case code for handling lists, documenting functions, etc. findFirstAuthentication throws an error to make all item functions consistent. Various other schema and output cleanup.

### Patch Changes

- Updated dependencies [3184903]
  - @zapier/zapier-sdk@0.10.0
  - @zapier/zapier-sdk-mcp@0.3.7

## 0.9.1

### Patch Changes

- Updated dependencies [3cfed98]
  - @zapier/zapier-sdk@0.9.1
  - @zapier/zapier-sdk-mcp@0.3.6

## 0.9.0

### Minor Changes

- 5ccaec6: AST-based type gen instead of string-based. Added `add` function for locking app versions and generating types. Removed `lockVersion` and `generateTypes functions. Manifest matching on slug or implementation name.

### Patch Changes

- Updated dependencies [5ccaec6]
  - @zapier/zapier-sdk@0.9.0
  - @zapier/zapier-sdk-mcp@0.3.5

## 0.8.4

### Patch Changes

- Updated dependencies [ed235b6]
  - @zapier/zapier-sdk@0.8.3
  - @zapier/zapier-sdk-mcp@0.3.4

## 0.8.3

### Patch Changes

- 2cf22f7: Fix broken table of contents in CLI and MCP READMEs
- Updated dependencies [2cf22f7]
  - @zapier/zapier-sdk-mcp@0.3.3

## 0.8.2

### Patch Changes

- Updated dependencies [bef5467]
  - @zapier/zapier-sdk@0.8.2
  - @zapier/zapier-sdk-mcp@0.3.2

## 0.8.1

### Patch Changes

- Updated dependencies [319a05f]
  - @zapier/zapier-sdk@0.8.1
  - @zapier/zapier-sdk-mcp@0.3.1

## 0.8.0

### Minor Changes

- 3a39eee: Add listInputFieldChoices method

### Patch Changes

- Updated dependencies [3a39eee]
  - @zapier/zapier-sdk-mcp@0.3.0
  - @zapier/zapier-sdk@0.8.0

## 0.7.0

### Minor Changes

- 096d674: Changed incorrect account_id parameter to accountId. Also made sure all CLI parameters are documented as kebab-case.

### Patch Changes

- Updated dependencies [096d674]
  - @zapier/zapier-sdk@0.7.0
  - @zapier/zapier-sdk-mcp@0.2.5

## 0.6.5

### Patch Changes

- 8b2b6b6: Fix pagination numbering regression and async iteration

## 0.6.4

### Patch Changes

- 4315531: All CLI commands are now just local plugins used to build a CLI specific SDK, and that CLI specific SDK is used to generate the CLI docs.
- Updated dependencies [4315531]
  - @zapier/zapier-sdk-mcp@0.2.4
  - @zapier/zapier-sdk@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [5b74010]
  - @zapier/zapier-sdk@0.6.3
  - @zapier/zapier-sdk-mcp@0.2.3

## 0.6.2

### Patch Changes

- Updated dependencies [ac0624d]
  - @zapier/zapier-sdk@0.6.2
  - @zapier/zapier-sdk-mcp@0.2.2

## 0.6.1

### Patch Changes

- Updated dependencies [38fe5c4]
  - @zapier/zapier-sdk@0.6.1
  - @zapier/zapier-sdk-mcp@0.2.1

## 0.6.0

### Minor Changes

- c402bcd: Remove \_\_registry in favor of getRegistry that also provides categories for functions.

### Patch Changes

- e08365e: Add support for lock file in generate-types command
- 8ef28ba: reducing any usage with minimal changes to runtime
- Updated dependencies [c472d6f]
- Updated dependencies [e08365e]
- Updated dependencies [8ef28ba]
- Updated dependencies [c402bcd]
  - @zapier/zapier-sdk@0.6.0
  - @zapier/zapier-sdk-mcp@0.2.0

## 0.5.0

### Minor Changes

- 218a3ca: reducing 'any' usage with minimal changes to runtime

### Patch Changes

- Updated dependencies [218a3ca]
  - @zapier/zapier-sdk-cli-login@0.3.2
  - @zapier/zapier-sdk-mcp@0.1.4
  - @zapier/zapier-sdk@0.5.2

## 0.4.4

### Patch Changes

- c662f79: Add proper README with dynamically-listed methods
- Updated dependencies [c662f79]
  - @zapier/zapier-sdk-mcp@0.1.3
  - @zapier/zapier-sdk@0.5.1

## 0.4.3

### Patch Changes

- Updated dependencies [741c385]
  - @zapier/zapier-sdk@0.5.0
  - @zapier/zapier-sdk-mcp@0.1.2

## 0.4.2

### Patch Changes

- Updated dependencies [36a2825]
  - @zapier/zapier-sdk-mcp@0.1.1
