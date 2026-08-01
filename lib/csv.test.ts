import { describe, expect, it } from "vitest";
import type { Sale, SalesRange } from "./analytics";
import { buildSoldItemsCsv, soldItemsCsvFilename } from "./csv";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "item-1",
    title: "Test item",
    category: null,
    size: null,
    photo: null,
    platform: "EBAY",
    soldAt: "2026-07-15T00:00:00.000Z",
    listedAt: "2026-07-01T00:00:00.000Z",
    soldPrice: 1234.5,
    purchasePrice: 20,
    fees: 0,
    profit: 1214.5,
    roiPct: 6072.5,
    daysToSell: 14,
    ...overrides,
  };
}

describe("buildSoldItemsCsv", () => {
  const header =
    "Item,Sold date,Platform,Sold price,Paid,Fees,Profit,ROI";

  it("emits the exact header and preserves raw numeric values", () => {
    const csv = buildSoldItemsCsv([sale()]);

    expect(csv.split("\r\n")[0]).toBe(header);
    expect(csv).toContain(",1234.5,20,0,1214.5,6072.5");
    expect(csv).not.toContain("$1,234.50");
  });

  it.each([
    ["comma", "Nike, Shorts", '"Nike, Shorts"'],
    ["double quote", 'Nike 10" Shorts', '"Nike 10"" Shorts"'],
    ["newline", "Nike\nShorts", '"Nike\nShorts"'],
  ])("quotes a title containing a %s", (_name, title, expected) => {
    expect(buildSoldItemsCsv([sale({ title })])).toContain(expected);
  });

  it("uses empty fields for null platform and ROI", () => {
    const row = buildSoldItemsCsv([
      sale({ platform: null, roiPct: null }),
    ]).split("\r\n")[1];

    expect(row).toBe("Test item,2026-07-15,,1234.5,20,0,1214.5,");
  });

  it("exports zero fees as zero", () => {
    expect(buildSoldItemsCsv([sale()])).toContain(",20,0,1214.5,");
  });

  it("returns the header alone for empty input", () => {
    expect(buildSoldItemsCsv([])).toBe(header);
  });
});

describe("soldItemsCsvFilename", () => {
  it.each(["week", "month", "year", "all"] as const)(
    "builds the %s filename from the UTC date",
    (range: SalesRange) => {
      expect(
        soldItemsCsvFilename(
          range,
          new Date("2026-08-01T23:59:59.000-06:00"),
        ),
      ).toBe(`sold-items-${range}-2026-08-02.csv`);
    },
  );
});
