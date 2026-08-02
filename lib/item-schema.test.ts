import { describe, expect, it } from "vitest";

import {
  BulkItemMutationSchema,
  ItemMutationSchema,
  MarkSoldSchema,
} from "./item-schema";

const DAY_MS = 24 * 60 * 60 * 1000;

function salePayload(overrides: Record<string, unknown> = {}) {
  return {
    soldPrice: 65,
    soldPlatform: "EBAY",
    soldDate: new Date().toISOString().slice(0, 10),
    platformFees: 8.5,
    ...overrides,
  };
}

describe("MarkSoldSchema", () => {
  it("accepts a valid payload with today's date", () => {
    expect(MarkSoldSchema.safeParse(salePayload()).success).toBe(true);
  });

  it("accepts a date well in the past", () => {
    const soldDate = new Date(Date.now() - 365 * DAY_MS).toISOString();

    expect(
      MarkSoldSchema.safeParse(salePayload({ soldDate })).success,
    ).toBe(true);
  });

  it("accepts a date a few hours in the future for timezone tolerance", () => {
    const soldDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    expect(
      MarkSoldSchema.safeParse(salePayload({ soldDate })).success,
    ).toBe(true);
  });

  it("rejects a date far in the future with the future-date message", () => {
    const soldDate = new Date(Date.now() + 10 * DAY_MS).toISOString();
    const parsed = MarkSoldSchema.safeParse(salePayload({ soldDate }));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected future sold date to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "Sold date cannot be in the future.",
    );
  });

  it("reports only the parseability message for an unparseable date", () => {
    const parsed = MarkSoldSchema.safeParse(
      salePayload({ soldDate: "not-a-date" }),
    );

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected invalid sold date to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual([
      "Sold date is invalid.",
    ]);
  });

  it("accepts a loss-making sale with fees above the sold price", () => {
    expect(
      MarkSoldSchema.safeParse(
        salePayload({ soldPrice: 10, platformFees: 25 }),
      ).success,
    ).toBe(true);
  });

  it("rejects a zero sold price and negative platform fees", () => {
    const parsed = MarkSoldSchema.safeParse(
      salePayload({ soldPrice: 0, platformFees: -1 }),
    );

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected invalid money values to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Sold price must be greater than 0.",
        "Platform fees cannot be negative.",
      ]),
    );
  });
});

describe("ItemMutationSchema", () => {
  it("parses edit_sale and narrows its data", () => {
    const parsed = ItemMutationSchema.safeParse({
      action: "edit_sale",
      data: salePayload(),
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected edit_sale to parse");
    if (parsed.data.action !== "edit_sale") {
      throw new Error("Expected edit_sale action");
    }
    expect(parsed.data.data.soldPrice).toBe(65);
  });

  it("rejects an unknown action", () => {
    expect(
      ItemMutationSchema.safeParse({
        action: "delete_sale",
        data: salePayload(),
      }).success,
    ).toBe(false);
  });
});

describe("BulkItemMutationSchema", () => {
  it("accepts valid set_status and delete payloads", () => {
    expect(
      BulkItemMutationSchema.safeParse({
        action: "set_status",
        ids: ["item-1", "item-2"],
        data: { status: "DRAFT" },
      }).success,
    ).toBe(true);
    expect(
      BulkItemMutationSchema.safeParse({
        action: "delete",
        ids: ["item-1"],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty ids array", () => {
    const parsed = BulkItemMutationSchema.safeParse({
      action: "delete",
      ids: [],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected empty ids to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "Select at least one item.",
    );
  });

  it("rejects more than 200 ids with a readable message", () => {
    const parsed = BulkItemMutationSchema.safeParse({
      action: "set_status",
      ids: Array.from({ length: 201 }, (_, index) => `item-${index}`),
      data: { status: "LISTED" },
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected the bulk cap to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "Bulk actions are limited to 200 items at a time.",
    );
  });

  it("rejects an unknown action", () => {
    expect(
      BulkItemMutationSchema.safeParse({
        action: "archive",
        ids: ["item-1"],
      }).success,
    ).toBe(false);
  });
});
