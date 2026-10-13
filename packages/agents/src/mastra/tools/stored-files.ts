import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveRequestUserId } from "../../lib/request-user-context";
import { ZapierError } from "../../lib/zapier/errors";
import { type ExperimentalZapierSdk, getExperimentalSdkForUser } from "../../lib/zapier/sdk";
import { handleSdkError } from "../../lib/zapier-sdk-tools";

/**
 * Stored files — the user's Zapier Virtual File System (VFS), the file store
 * behind their Zapier context repository. Experimental-only in the SDK
 * (`@zapier/zapier-sdk/experimental`, added 0.108), so these go through the
 * per-user experimental client rather than the generated registry tools.
 *
 * Path convention (SDK CHANGELOG): every path is ABSOLUTE and starts with `/`
 * (e.g. `/Mine/notes.md`). A missing path throws ZapierResourceNotFoundError; a
 * policy denial throws ZapierAuthenticationError. Errors are returned as the
 * same structured `{ error, code, retryable }` shape the generated Zapier tools
 * use (handleSdkError), so the agent can explain them instead of the run dying.
 *
 * Reads run without approval (and are opted into background execution in
 * lib/background.ts); every write/move/delete requires human approval.
 *
 * No `strict: true` — Anthropic's grammar-constrained tool mode breaks custom tools.
 */

/** Default read cap so a large file doesn't flood the context window. */
export const DEFAULT_READ_MAX_BYTES = 50_000;
/** The SDK's hard per-file cap (10 MB). */
const VFS_MAX_CONTENT_BYTES = 10 * 1024 * 1024;

/** Read-only stored-file tool ids — opted into agent-level background execution. */
export const STORED_FILES_READ_TOOL_IDS = [
  "list_stored_files",
  "read_stored_file",
  "stat_stored_file",
] as const;

const absolutePath = (what: string) =>
  z
    .string()
    .startsWith("/", { message: `${what} must start with '/' — stored-file paths are absolute.` })
    .describe(`${what} — absolute, starts with '/', e.g. '/Mine/notes.md'.`);

type ToolContext = { requestContext?: { get(key: string): unknown } | null } | undefined;
type ToolError = ReturnType<typeof handleSdkError> & { path?: string };

/**
 * Resolve the acting user's experimental SDK and run `fn` against it, mapping
 * any failure to a structured tool error.
 */
async function withVfs<T>(
  context: ToolContext,
  methodName: string,
  path: string,
  fn: (sdk: ExperimentalZapierSdk) => Promise<T>,
): Promise<T | ToolError> {
  const userId = resolveRequestUserId(context?.requestContext);
  if (!userId) {
    return {
      error:
        "Stored files need a signed-in Foreman user with a Zapier connection, and none is in context.",
      code: "NO_USER",
      retryable: false,
    };
  }
  try {
    const sdk = await getExperimentalSdkForUser(userId);
    return await fn(sdk);
  } catch (err) {
    // Foreman's own connection errors (not connected / reauth) aren't SDK
    // errors — surface them with a reconnect hint.
    if (err instanceof ZapierError) {
      return {
        error: `${err.message}. Use connect_zapier to (re)connect the user's Zapier account.`,
        code: err.code,
        retryable: false,
      };
    }
    const mapped: ToolError = handleSdkError(err, methodName);
    if (mapped.code === "NOT_FOUND") {
      mapped.error = `No stored file or folder at ${path}. Use list_stored_files on the parent folder to see what exists.`;
    }
    return { ...mapped, path };
  }
}

// ─── Read tools (no approval) ────────────────────────────────────────────────

export const listStoredFilesTool = createTool({
  id: "list_stored_files",
  description:
    "List one page of a folder in the user's Zapier stored files (their Zapier Virtual File System). " +
    "Paths are absolute — start at '/' to see the top-level folders (e.g. '/Mine'). Returns entries " +
    "(type file/directory/shortcut/stream, name, path, size, version, updated_at) plus `nextCursor`; " +
    "pass it back as `cursor` to fetch the next page. Read-only.",
  inputSchema: z.object({
    path: absolutePath("Folder path"),
    cursor: z
      .string()
      .optional()
      .describe("Cursor from a previous call's `nextCursor`, to fetch the next page."),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("Entries per page (default 50, max 500)."),
  }),
  execute: async ({ path, cursor, pageSize }, context) =>
    withVfs(context, "listVfsDirectory", path, async (sdk) => {
      // Awaiting a paginated result yields its first page only — exactly one
      // page per call, with the cursor for the next.
      const page = await sdk.listVfsDirectory({
        path,
        ...(cursor !== undefined ? { cursor } : {}),
        ...(pageSize !== undefined ? { pageSize } : {}),
      });
      return {
        path,
        entries: page.data,
        nextCursor: page.nextCursor ?? null,
        hasMore: Boolean(page.nextCursor),
      };
    }),
});

export const readStoredFileTool = createTool({
  id: "read_stored_file",
  description:
    "Read a text file from the user's Zapier stored files. The path is absolute (e.g. '/Mine/notes.md'). " +
    `Returns at most \`maxBytes\` bytes of content (default ${DEFAULT_READ_MAX_BYTES}); when the file is ` +
    "larger, `truncated` is true and `size` is the full size — raise maxBytes only if you really need more. " +
    "Also returns `version`, which you can pass as `expectedVersion` to write_stored_file. Read-only.",
  inputSchema: z.object({
    path: absolutePath("File path"),
    maxBytes: z
      .number()
      .int()
      .min(1)
      .max(VFS_MAX_CONTENT_BYTES)
      .optional()
      .describe(
        `Maximum bytes of content to return (default ${DEFAULT_READ_MAX_BYTES}, max 10 MB). Larger files are truncated.`,
      ),
  }),
  execute: async ({ path, maxBytes }, context) =>
    withVfs(context, "readVfsFile", path, async (sdk) => {
      const cap = maxBytes ?? DEFAULT_READ_MAX_BYTES;
      const { data } = await sdk.readVfsFile({ path, maxBytes: cap });
      // The server truncates to maxBytes; `size` is always the full file size.
      const returnedBytes = Buffer.byteLength(data.content, "utf8");
      const truncated = data.size > returnedBytes;
      return {
        path: data.path,
        name: data.name,
        content: data.content,
        size: data.size,
        version: data.version,
        updated_at: data.updated_at,
        ...(data.canonical_path ? { canonical_path: data.canonical_path } : {}),
        truncated,
        ...(truncated
          ? {
              note: `Content truncated to the first ${returnedBytes} of ${data.size} bytes. Call again with a larger maxBytes to read more.`,
            }
          : {}),
      };
    }),
});

export const statStoredFileTool = createTool({
  id: "stat_stored_file",
  description:
    "Get metadata for any path in the user's Zapier stored files (file, directory, shortcut, or stream) " +
    "without reading its content: type, size, version, updated_at, and shortcut target. The path is " +
    "absolute (e.g. '/Mine/notes.md'). Use it to check whether something exists or to get its current " +
    "version. Read-only.",
  inputSchema: z.object({ path: absolutePath("Path") }),
  execute: async ({ path }, context) =>
    withVfs(context, "statVfsPath", path, async (sdk) => (await sdk.statVfsPath({ path })).data),
});

// ─── Write tools (require approval) ──────────────────────────────────────────

export const writeStoredFileTool = createTool({
  id: "write_stored_file",
  requireApproval: true,
  description:
    "Create or overwrite a text file in the user's Zapier stored files. The path is absolute " +
    "(e.g. '/Mine/notes.md'); missing parent folders are created automatically. Content is capped at " +
    "10 MB. For safe edits pass `expectedVersion` (from read_stored_file / stat_stored_file): the write " +
    "fails if the file changed since — pass 0 to require that the file does not exist yet. To add to " +
    "the end of a file, prefer append_stored_file.",
  inputSchema: z.object({
    path: absolutePath("File path"),
    content: z.string().max(VFS_MAX_CONTENT_BYTES).describe("The full new file contents."),
    expectedVersion: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Optimistic-concurrency guard: the file's current version, or 0 to assert it doesn't exist yet.",
      ),
  }),
  execute: async ({ path, content, expectedVersion }, context) =>
    withVfs(
      context,
      "writeVfsFile",
      path,
      async (sdk) =>
        (
          await sdk.writeVfsFile({
            path,
            content,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
          })
        ).data,
    ),
});

export const appendStoredFileTool = createTool({
  id: "append_stored_file",
  requireApproval: true,
  description:
    "Append text to the end of a file in the user's Zapier stored files, creating it (and any missing " +
    "parent folders) if needed. The path is absolute (e.g. '/Mine/log.md'). Safer than read + rewrite " +
    "for logs and running notes. The resulting file must stay under 10 MB.",
  inputSchema: z.object({
    path: absolutePath("File path"),
    content: z.string().max(VFS_MAX_CONTENT_BYTES).describe("Text to append."),
  }),
  execute: async ({ path, content }, context) =>
    withVfs(
      context,
      "appendVfsFile",
      path,
      async (sdk) => (await sdk.appendVfsFile({ path, content })).data,
    ),
});

export const copyStoredFileTool = createTool({
  id: "copy_stored_file",
  requireApproval: true,
  description:
    "Copy a file to a new path in the user's Zapier stored files. Both `from` and `to` are absolute FILE " +
    "paths (not folders). Fails if `to` exists unless `overwrite` is true; with overwrite, " +
    "`expectedVersion` pins the destination's current version.",
  inputSchema: z.object({
    from: absolutePath("Source file path"),
    to: absolutePath("Destination file path"),
    overwrite: z
      .boolean()
      .optional()
      .describe("Replace an existing file at `to` (default false: fail if it exists)."),
    expectedVersion: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        "With overwrite:true, only replace the destination if its current version matches.",
      ),
  }),
  execute: async ({ from, to, overwrite, expectedVersion }, context) =>
    withVfs(
      context,
      "copyVfsFile",
      from,
      async (sdk) =>
        (
          await sdk.copyVfsFile({
            from,
            to,
            ...(overwrite !== undefined ? { overwrite } : {}),
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
          })
        ).data,
    ),
});

export const createStoredFolderTool = createTool({
  id: "create_stored_folder",
  requireApproval: true,
  description:
    "Create a folder in the user's Zapier stored files. The path is absolute (e.g. '/Mine/notes'). " +
    "Idempotent — safe on a folder that already exists.",
  inputSchema: z.object({ path: absolutePath("Folder path") }),
  execute: async ({ path }, context) =>
    withVfs(
      context,
      "createVfsDirectory",
      path,
      async (sdk) => (await sdk.createVfsDirectory({ path })).data,
    ),
});

export const moveStoredFileTool = createTool({
  id: "move_stored_file",
  requireApproval: true,
  description:
    "Move or rename a file or folder in the user's Zapier stored files. Both `from` and `to` are " +
    "absolute paths (e.g. '/Mine/draft.md' → '/Mine/final.md').",
  inputSchema: z.object({
    from: absolutePath("Current path"),
    to: absolutePath("New path"),
  }),
  execute: async ({ from, to }, context) =>
    withVfs(
      context,
      "moveVfsPath",
      from,
      async (sdk) => (await sdk.moveVfsPath({ from, to })).data,
    ),
});

export const deleteStoredFileTool = createTool({
  id: "delete_stored_file",
  requireApproval: true,
  description:
    "Delete a file or folder in the user's Zapier stored files. The path is absolute " +
    "(e.g. '/Mine/old-notes.md'). Deleted entries can only be restored by Zapier support.",
  inputSchema: z.object({ path: absolutePath("Path to delete") }),
  execute: async ({ path }, context) =>
    withVfs(
      context,
      "deleteVfsPath",
      path,
      async (sdk) => (await sdk.deleteVfsPath({ path })).data,
    ),
});

/** Every stored-files tool, keyed by id — spread into the Foreman tool set. */
export const storedFilesTools = {
  list_stored_files: listStoredFilesTool,
  read_stored_file: readStoredFileTool,
  stat_stored_file: statStoredFileTool,
  write_stored_file: writeStoredFileTool,
  append_stored_file: appendStoredFileTool,
  copy_stored_file: copyStoredFileTool,
  create_stored_folder: createStoredFolderTool,
  move_stored_file: moveStoredFileTool,
  delete_stored_file: deleteStoredFileTool,
};
