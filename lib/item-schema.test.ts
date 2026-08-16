import { describe, expect, it } from "vitest";

import {
  BulkItemMutationSchema,
  buildDuplicateTitle,
  CreateItemSchema,
  DraftItemSchema,
  ItemMutationSchema,
  MarkSoldSchema,
  ITEM_TITLE_MAX_LENGTH,
  RemoveItemPostingSchema,
  UpsertItemPostingSchema,
} from "./item-schema";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("buildDuplicateTitle", () => {
  it("adds the copy suffix without exceeding the title limit", () => {
    expect(buildDuplicateTitle("Vintage denim jacket")).toBe(
      "Vintage denim jacket (copy)",
    );

    const title = buildDuplicateTitle("x".repeat(ITEM_TITLE_MAX_LENGTH));
    expect(title).toHaveLength(ITEM_TITLE_MAX_LENGTH);
    expect(title.endsWith(" (copy)")).toBe(true);
  });
});

describe("item posting schemas", () => {
  it("accepts an optional valid URL and allows it to be cleared", () => {
    expect(
      UpsertItemPostingSchema.safeParse({
        platform: "EBAY",
        url: "https://www.ebay.com/itm/123",
      }).success,
    ).toBe(true);
    expect(
      UpsertItemPostingSchema.safeParse({
        platform: "DEPOP",
        url: null,
      }).success,
    ).toBe(true);
    expect(
      UpsertItemPostingSchema.safeParse({ platform: "FB_MARKETPLACE" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown platforms and malformed URLs", () => {
    expect(
      UpsertItemPostingSchema.safeParse({ platform: "OTHER" }).success,
    ).toBe(false);
    expect(
      UpsertItemPostingSchema.safeParse({
        platform: "EBAY",
        url: "not a URL",
      }).success,
    ).toBe(false);
    expect(
      RemoveItemPostingSchema.safeParse({ platform: "OTHER" }).success,
    ).toBe(false);
  });
});

function salePayload(overrides: Record<string, unknown> = {}) {
  return {
    soldPrice: 65,
    soldPlatform: "EBAY",
    soldDate: new Date().toISOString().slice(0, 10),
    platformFees: 8.5,
    shippingCost: null,
    ...overrides,
  };
}

function itemPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    photos: ["https://example.com/item.jpg"],
    title: "Vintage denim jacket",
    summary: null,
    description: "A well-kept vintage denim jacket.",
    brand: null,
    category: "Jacket",
    size: null,
    color: "Blue",
    condition: "good",
    conditionNotes: null,
    suggestedPrice: 60,
    priceLow: 45,
    priceHigh: 70,
    priceReasoning: null,
    listPrice: 60,
    purchasePrice: 15,
    keywords: ["denim", "jacket"],
    aiConfidence: "high",
    purchaseDate: null,
    notes: null,
    status: "LISTED",
    ...overrides,
  };
}

describe("DraftItemSchema", () => {
  it("accepts an incomplete draft with no category or purchase price", () => {
    const draft = itemPayload({
      category: null,
      listPrice: 0,
      status: "DRAFT",
      draftStep: "analyzed",
    });
    delete draft.purchasePrice;

    expect(DraftItemSchema.safeParse(draft).success).toBe(true);
  });

  it("still rejects an empty photo list", () => {
    const parsed = DraftItemSchema.safeParse(
      itemPayload({ photos: [], status: "DRAFT" }),
    );

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected photos to fail");
    expect(parsed.error.issues.map((issue) => issue.path[0])).toContain(
      "photos",
    );
  });

  it("accepts blank listing copy while a manual draft is incomplete", () => {
    expect(
      DraftItemSchema.safeParse(
        itemPayload({ title: "", description: "", status: "DRAFT" }),
      ).success,
    ).toBe(true);
  });

  it("keeps the ordered price-range check", () => {
    const parsed = DraftItemSchema.safeParse(
      itemPayload({ priceLow: 80, priceHigh: 40, status: "DRAFT" }),
    );

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected reversed prices to fail");
    expect(parsed.error.issues.map((issue) => issue.path[0])).toContain(
      "priceHigh",
    );
  });

  it("rejects an unknown draftStep", () => {
    expect(
      DraftItemSchema.safeParse(
        itemPayload({ status: "DRAFT", draftStep: "published" }),
      ).success,
    ).toBe(false);
  });
});

describe("CreateItemSchema", () => {
  it("remains strict for fields relaxed only on drafts", () => {
    const item = itemPayload({
      category: "",
      listPrice: 0,
      status: "DRAFT",
    });
    delete item.purchasePrice;

    const parsed = CreateItemSchema.safeParse(item);

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected strict create to fail");
    expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["category", "listPrice", "purchasePrice"]),
    );
  });
});

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

  it("accepts a recorded zero shipping cost and rejects a negative one", () => {
    expect(
      MarkSoldSchema.safeParse(salePayload({ shippingCost: 0 })).success,
    ).toBe(true);

    const parsed = MarkSoldSchema.safeParse(
      salePayload({ shippingCost: -1 }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected shipping cost to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "Shipping cost cannot be negative.",
    );
  });
});

describe("ItemMutationSchema", () => {
  it("keeps AI reference ownership in apply_analysis", () => {
    const data = {
      ...itemPayload(),
      suggestedPrice: 60,
      priceLow: 50,
      priceHigh: 70,
      priceReasoning: "Based on current secondhand demand.",
      aiConfidence: "high",
    };

    expect(
      ItemMutationSchema.safeParse({ action: "apply_analysis", data }).success,
    ).toBe(true);
    expect(
      ItemMutationSchema.safeParse({
        action: "apply_analysis",
        data: { ...data, priceLow: 80, priceHigh: 70 },
      }).success,
    ).toBe(false);
    const ordinaryUpdate = ItemMutationSchema.safeParse({
      action: "update",
      data,
    });
    expect(ordinaryUpdate.success).toBe(true);
    if (!ordinaryUpdate.success || ordinaryUpdate.data.action !== "update") {
      throw new Error("Expected ordinary update to parse");
    }
    expect("suggestedPrice" in ordinaryUpdate.data.data).toBe(false);
  });

  it("accepts only validated title and price quick edits", () => {
    for (const data of [
      { title: "Updated title" },
      { listPrice: 42.5 },
      { purchasePrice: 12.5 },
      // A free or gifted item is a real purchase price of zero.
      { purchasePrice: 0 },
    ]) {
      expect(
        ItemMutationSchema.safeParse({ action: "patch_fields", data }).success,
      ).toBe(true);
    }

    for (const data of [
      {},
      { title: "" },
      { listPrice: 0 },
      { listPrice: 12.345 },
      { purchasePrice: -1 },
      { purchasePrice: 12.345 },
      { notes: "Not quick editable" },
    ]) {
      expect(
        ItemMutationSchema.safeParse({ action: "patch_fields", data })
          .success,
      ).toBe(false);
    }
  });

  it("parses update_draft without allowing a status change", () => {
    const data = itemPayload({ status: "DRAFT", draftStep: "reviewed" });
    delete data.status;
    delete data.purchasePrice;

    const parsed = ItemMutationSchema.safeParse({
      action: "update_draft",
      data,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected update_draft to parse");
    if (parsed.data.action !== "update_draft") {
      throw new Error("Expected update_draft action");
    }
    expect(parsed.data.data.draftStep).toBe("reviewed");
    expect("status" in parsed.data.data).toBe(false);
  });

  it("parses a DRAFT to LISTED set_status action", () => {
    const parsed = ItemMutationSchema.safeParse({
      action: "set_status",
      data: { status: "LISTED" },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected set_status to parse");
    if (parsed.data.action !== "set_status") {
      throw new Error("Expected set_status action");
    }
    expect(parsed.data.data.status).toBe("LISTED");
  });

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
