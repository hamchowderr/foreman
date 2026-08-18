/**
 * The size sentence shown above a pending approval (foreman-nz8b).
 *
 * The bug these guard against is not a crash — it is a sentence that says the
 * wrong number, or says nothing, on the exact call that needed it. Both fail
 * silently in a browser, which is why they are asserted here.
 */
import { describe, expect, it } from "vitest";
import { describeActionScope } from "@/lib/action-scope";

const records = (n: number) => Array.from({ length: n }, (_, i) => ({ data: { row: i } }));

describe("describeActionScope", () => {
  it("states the count and the table for a bulk record write", () => {
    const scope = describeActionScope("create-table-records", {
      table: "Leads",
      records: records(500),
    });
    expect(scope).toEqual({
      count: 500,
      sentence: "This will create 500 records in the Leads table.",
    });
  });

  it("groups thousands so the number is readable at a glance", () => {
    // 12000 vs 1200 is one keystroke and two orders of magnitude — the whole
    // point of the sentence is that the difference is impossible to miss.
    const scope = describeActionScope("create-table-records", {
      table: "Leads",
      records: records(12_000),
    });
    expect(scope?.sentence).toContain("12,000 records");
  });

  it("says overwrite for updates and permanently delete for deletes", () => {
    expect(
      describeActionScope("update-table-records", { table: "Leads", records: records(9) })
        ?.sentence,
    ).toBe("This will overwrite 9 records in the Leads table.");
    expect(
      describeActionScope("delete-table-records", { table: "Leads", records: records(9) })
        ?.sentence,
    ).toBe("This will permanently delete 9 records from the Leads table.");
  });

  it("stays silent for a single-item write", () => {
    // One record is already legible as JSON. A sentence on every prompt is a
    // sentence nobody reads by the time it matters.
    expect(
      describeActionScope("create-table-records", { table: "Leads", records: records(1) }),
    ).toBe(null);
  });

  it("stays silent for read-only tools", () => {
    expect(describeActionScope("list-table-records", { table: "Leads" })).toBe(null);
    expect(describeActionScope("get-app", { app: "google-sheets" })).toBe(null);
  });

  it("flags a whole-table delete with no count at all", () => {
    // `{"table":"Leads"}` is the smallest-looking request in the product and
    // the largest in effect, so it reports count: null — never "routine".
    const scope = describeActionScope("delete-table", { table: "Leads" });
    expect(scope?.count).toBe(null);
    expect(scope?.sentence).toBe(
      "This will permanently delete the Leads table and every record in it.",
    );
  });

  it("finds the bulk payload inside run-action's opaque inputs bag", () => {
    const scope = describeActionScope("run-action", {
      app: "google-sheets",
      actionType: "write",
      action: "create_row",
      inputs: { rows: records(240), worksheet: "Sheet1" },
    });
    expect(scope).toEqual({
      count: 240,
      sentence: "This will send 240 items to Google Sheets in one action.",
    });
  });

  it("reports the largest collection when inputs carry several", () => {
    const scope = describeActionScope("run-action", {
      app: "gmail",
      inputs: { cc: ["a@x.com", "b@x.com"], to: records(60) },
    });
    expect(scope?.count).toBe(60);
  });

  it("omits an id-shaped table rather than reading one back to the user", () => {
    // `table` accepts an id as well as a name; "the 01234567-… table" is worse
    // than "the table".
    expect(
      describeActionScope("delete-table-records", { table: "12345", records: records(4) })
        ?.sentence,
    ).toBe("This will permanently delete 4 records from the table.");
    expect(
      describeActionScope("delete-table-records", {
        table: "0a1b2c3d-4e5f-6789-abcd-ef0123456789",
        records: records(4),
      })?.sentence,
    ).toBe("This will permanently delete 4 records from the table.");
  });

  it("survives a malformed or absent input without throwing", () => {
    expect(describeActionScope("create-table-records", null)).toBe(null);
    expect(describeActionScope("create-table-records", { records: "not-an-array" })).toBe(null);
    expect(describeActionScope("run-action", { app: "gmail", inputs: "nope" })).toBe(null);
  });
});
