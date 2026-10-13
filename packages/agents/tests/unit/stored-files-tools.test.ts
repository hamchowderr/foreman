/**
 * Unit tests for the stored-files (Zapier VFS) agent tools. The experimental
 * per-user SDK is mocked; these cover argument mapping onto the SDK's exact
 * parameter names, read truncation, error mapping, approval gating, and the
 * background opt-in for the read tools.
 */
import { RequestContext } from "@mastra/core/request-context";
import { ZapierResourceNotFoundError } from "@zapier/zapier-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeSdk = {
  listVfsDirectory: vi.fn(),
  readVfsFile: vi.fn(),
  statVfsPath: vi.fn(),
  writeVfsFile: vi.fn(),
  appendVfsFile: vi.fn(),
  copyVfsFile: vi.fn(),
  createVfsDirectory: vi.fn(),
  moveVfsPath: vi.fn(),
  deleteVfsPath: vi.fn(),
};
const mockGetExperimentalSdkForUser = vi.fn();
vi.mock("@/lib/zapier/sdk", () => ({
  getExperimentalSdkForUser: (...args: unknown[]) => mockGetExperimentalSdkForUser(...args),
}));

import { backgroundToolsConfig } from "@/lib/background";
import { ZapierNotConnected } from "@/lib/zapier/errors";
import {
  appendStoredFileTool,
  copyStoredFileTool,
  createStoredFolderTool,
  DEFAULT_READ_MAX_BYTES,
  deleteStoredFileTool,
  listStoredFilesTool,
  moveStoredFileTool,
  readStoredFileTool,
  STORED_FILES_READ_TOOL_IDS,
  statStoredFileTool,
  storedFilesTools,
  writeStoredFileTool,
} from "@/mastra/tools/stored-files";

function ctx(userId: string | null = "u1") {
  const entries: [string, string][] = userId ? [["userId", userId]] : [];
  return { requestContext: new RequestContext(entries) } as any;
}

const run = (tool: any, input: unknown, c = ctx()) => tool.execute(input, c);

const writeResult = { data: { path: "/Mine/a.md", version: 2, action: "updated" } };

beforeEach(() => {
  vi.resetAllMocks();
  mockGetExperimentalSdkForUser.mockResolvedValue(fakeSdk);
});

describe("stored-files tools: registration + approval", () => {
  it("exposes nine tools keyed by id", () => {
    expect(Object.keys(storedFilesTools).sort()).toEqual(
      [
        "append_stored_file",
        "copy_stored_file",
        "create_stored_folder",
        "delete_stored_file",
        "list_stored_files",
        "move_stored_file",
        "read_stored_file",
        "stat_stored_file",
        "write_stored_file",
      ].sort(),
    );
    for (const [id, tool] of Object.entries(storedFilesTools)) expect(tool.id).toBe(id);
  });

  it("gates every write behind approval and leaves reads open", () => {
    const reads = new Set<string>(STORED_FILES_READ_TOOL_IDS);
    for (const [id, tool] of Object.entries(storedFilesTools)) {
      if (reads.has(id)) expect(tool.requireApproval, id).toBeFalsy();
      else expect(tool.requireApproval, id).toBe(true);
    }
  });

  it("opts the read tools (and only those) into background execution", () => {
    const cfg = backgroundToolsConfig();
    for (const id of STORED_FILES_READ_TOOL_IDS) expect(cfg.tools[id]).toEqual({ enabled: true });
    for (const id of Object.keys(storedFilesTools)) {
      if (!(STORED_FILES_READ_TOOL_IDS as readonly string[]).includes(id)) {
        expect(cfg.tools[id], id).toBeUndefined();
      }
    }
  });
});

describe("stored-files tools: argument mapping", () => {
  it("list_stored_files passes path/cursor/pageSize and returns one page + cursor", async () => {
    fakeSdk.listVfsDirectory.mockResolvedValue({
      data: [{ type: "file", name: "a.md", path: "/Mine/a.md" }],
      nextCursor: "c2",
    });
    const out = await run(listStoredFilesTool, { path: "/Mine", cursor: "c1", pageSize: 10 });
    expect(mockGetExperimentalSdkForUser).toHaveBeenCalledWith("u1");
    expect(fakeSdk.listVfsDirectory).toHaveBeenCalledWith({
      path: "/Mine",
      cursor: "c1",
      pageSize: 10,
    });
    expect(out).toEqual({
      path: "/Mine",
      entries: [{ type: "file", name: "a.md", path: "/Mine/a.md" }],
      nextCursor: "c2",
      hasMore: true,
    });
  });

  it("list_stored_files omits unset pagination args and reports the last page", async () => {
    fakeSdk.listVfsDirectory.mockResolvedValue({ data: [] });
    const out = await run(listStoredFilesTool, { path: "/" });
    expect(fakeSdk.listVfsDirectory).toHaveBeenCalledWith({ path: "/" });
    expect(out).toMatchObject({ nextCursor: null, hasMore: false });
  });

  it("stat_stored_file returns the stat data", async () => {
    fakeSdk.statVfsPath.mockResolvedValue({
      data: { type: "directory", name: "Mine", path: "/Mine" },
    });
    const out = await run(statStoredFileTool, { path: "/Mine" });
    expect(fakeSdk.statVfsPath).toHaveBeenCalledWith({ path: "/Mine" });
    expect(out).toEqual({ type: "directory", name: "Mine", path: "/Mine" });
  });

  it("write_stored_file forwards expectedVersion (including 0)", async () => {
    fakeSdk.writeVfsFile.mockResolvedValue(writeResult);
    const out = await run(writeStoredFileTool, {
      path: "/Mine/a.md",
      content: "hi",
      expectedVersion: 0,
    });
    expect(fakeSdk.writeVfsFile).toHaveBeenCalledWith({
      path: "/Mine/a.md",
      content: "hi",
      expectedVersion: 0,
    });
    expect(out).toEqual(writeResult.data);
  });

  it("write_stored_file omits expectedVersion when not given", async () => {
    fakeSdk.writeVfsFile.mockResolvedValue(writeResult);
    await run(writeStoredFileTool, { path: "/Mine/a.md", content: "hi" });
    expect(fakeSdk.writeVfsFile).toHaveBeenCalledWith({ path: "/Mine/a.md", content: "hi" });
  });

  it("append / copy / mkdir / move / delete map onto the SDK parameter names", async () => {
    fakeSdk.appendVfsFile.mockResolvedValue(writeResult);
    fakeSdk.copyVfsFile.mockResolvedValue(writeResult);
    fakeSdk.createVfsDirectory.mockResolvedValue({ data: { path: "/Mine/n", action: "created" } });
    fakeSdk.moveVfsPath.mockResolvedValue({ data: { from: "/Mine/a.md", to: "/Mine/b.md" } });
    fakeSdk.deleteVfsPath.mockResolvedValue({ data: { path: "/Mine/b.md" } });

    await run(appendStoredFileTool, { path: "/Mine/log.md", content: "line\n" });
    expect(fakeSdk.appendVfsFile).toHaveBeenCalledWith({ path: "/Mine/log.md", content: "line\n" });

    await run(copyStoredFileTool, {
      from: "/Mine/a.md",
      to: "/Mine/c.md",
      overwrite: true,
      expectedVersion: 3,
    });
    expect(fakeSdk.copyVfsFile).toHaveBeenCalledWith({
      from: "/Mine/a.md",
      to: "/Mine/c.md",
      overwrite: true,
      expectedVersion: 3,
    });

    expect(await run(createStoredFolderTool, { path: "/Mine/n" })).toEqual({
      path: "/Mine/n",
      action: "created",
    });
    expect(fakeSdk.createVfsDirectory).toHaveBeenCalledWith({ path: "/Mine/n" });

    expect(await run(moveStoredFileTool, { from: "/Mine/a.md", to: "/Mine/b.md" })).toEqual({
      from: "/Mine/a.md",
      to: "/Mine/b.md",
    });
    expect(fakeSdk.moveVfsPath).toHaveBeenCalledWith({ from: "/Mine/a.md", to: "/Mine/b.md" });

    await run(deleteStoredFileTool, { path: "/Mine/b.md" });
    expect(fakeSdk.deleteVfsPath).toHaveBeenCalledWith({ path: "/Mine/b.md" });
  });

  it("rejects relative paths at the schema level", async () => {
    const out: any = await run(readStoredFileTool, { path: "Mine/a.md" });
    expect(fakeSdk.readVfsFile).not.toHaveBeenCalled();
    expect(out?.error).toBeTruthy();
  });
});

describe("read_stored_file truncation", () => {
  const file = (content: string, size: number) => ({
    data: {
      type: "file",
      path: "/Mine/big.md",
      name: "big.md",
      content,
      size,
      version: 4,
      updated_at: "2026-01-01T00:00:00Z",
    },
  });

  it("applies the default cap and flags truncation", async () => {
    fakeSdk.readVfsFile.mockResolvedValue(file("x".repeat(10), 200_000));
    const out: any = await run(readStoredFileTool, { path: "/Mine/big.md" });
    expect(fakeSdk.readVfsFile).toHaveBeenCalledWith({
      path: "/Mine/big.md",
      maxBytes: DEFAULT_READ_MAX_BYTES,
    });
    expect(out.truncated).toBe(true);
    expect(out.size).toBe(200_000);
    expect(out.version).toBe(4);
    expect(out.note).toMatch(/truncated/i);
  });

  it("honours an explicit maxBytes and reports a complete read", async () => {
    fakeSdk.readVfsFile.mockResolvedValue(file("héllo", Buffer.byteLength("héllo")));
    const out: any = await run(readStoredFileTool, { path: "/Mine/big.md", maxBytes: 1000 });
    expect(fakeSdk.readVfsFile).toHaveBeenCalledWith({ path: "/Mine/big.md", maxBytes: 1000 });
    expect(out.truncated).toBe(false);
    expect(out.note).toBeUndefined();
    expect(out.content).toBe("héllo");
  });
});

describe("stored-files tools: errors", () => {
  it("returns NO_USER without touching the SDK when no user is in context", async () => {
    const out: any = await run(statStoredFileTool, { path: "/Mine" }, ctx(null));
    expect(out.code).toBe("NO_USER");
    expect(mockGetExperimentalSdkForUser).not.toHaveBeenCalled();
  });

  it("maps a missing path to NOT_FOUND with the path", async () => {
    fakeSdk.statVfsPath.mockRejectedValue(new ZapierResourceNotFoundError("missing"));
    const out: any = await run(statStoredFileTool, { path: "/Mine/nope" });
    expect(out.code).toBe("NOT_FOUND");
    expect(out.path).toBe("/Mine/nope");
    expect(out.error).toContain("/Mine/nope");
  });

  it("surfaces a missing Zapier connection with a reconnect hint", async () => {
    mockGetExperimentalSdkForUser.mockRejectedValue(new ZapierNotConnected("u1"));
    const out: any = await run(listStoredFilesTool, { path: "/" });
    expect(out.code).toBe("ZAPIER_NOT_CONNECTED");
    expect(out.error).toMatch(/connect_zapier/);
  });
});
