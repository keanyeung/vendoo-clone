import { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  PLATFORM_BAR_CLASSES,
  PLATFORM_SHORT_LABELS,
  formatFee,
  formatMoney,
  formatMonthYear,
  formatPercent,
  formatProfitDelta,
  formatRangeSubline,
  formatRoi,
  formatSaleDate,
} from "./sales-format";

describe("formatMoney", () => {
  it.each([
    [1275, "$1,275"],
    [382.4, "$382.40"],
    [0, "$0"],
    [-14.3, "-$14.30"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatMoney(value)).toBe(expected);
  });

  it("normalizes negative zero", () => {
    expect(formatMoney(-0)).toBe("$0");
  });
});

describe("formatPercent", () => {
  it("always renders one decimal place", () => {
    expect(formatPercent(48.1)).toBe("48.1%");
    expect(formatPercent(48)).toBe("48.0%");
  });

  it("renders an em dash for a missing ratio", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatMonthYear", () => {
  it("formats a UTC-midnight timestamp without shifting months", () => {
    expect(formatMonthYear("2025-08-03T00:00:00.000Z")).toBe("Aug 2025");
  });
});

describe("formatRangeSubline", () => {
  it("formats the all-time variant from the earliest sale", () => {
    expect(
      formatRangeSubline({
        range: "all",
        bounds: {
          start: "2025-08-03T00:00:00.000Z",
          end: "2026-08-01T00:00:00.000Z",
        },
        count: 28,
        earliestSoldAt: "2025-08-03T00:00:00.000Z",
      }),
    ).toBe("All time · 28 sales · since Aug 2025");
  });

  it("drops the since clause when no sale exists", () => {
    expect(
      formatRangeSubline({
        range: "all",
        bounds: {
          start: "2026-07-31T00:00:00.000Z",
          end: "2026-08-01T00:00:00.000Z",
        },
        count: 0,
        earliestSoldAt: null,
      }),
    ).toBe("All time · 0 sales");
  });

  it("formats a same-year span with the shared year once", () => {
    expect(
      formatRangeSubline({
        range: "month",
        bounds: {
          start: "2026-07-01T00:00:00.000Z",
          end: "2026-08-01T00:00:00.000Z",
        },
        count: 8,
        earliestSoldAt: "2025-08-03T00:00:00.000Z",
      }),
    ).toBe("This month · 8 sales · Jul 1 – Jul 31, 2026");
  });

  it("formats a year-crossing span with both years", () => {
    expect(
      formatRangeSubline({
        range: "week",
        bounds: {
          start: "2025-12-28T00:00:00.000Z",
          end: "2026-01-04T00:00:00.000Z",
        },
        count: 3,
        earliestSoldAt: "2025-08-03T00:00:00.000Z",
      }),
    ).toBe("This week · 3 sales · Dec 28, 2025 – Jan 3, 2026");
  });

  it("renders a single-day span without a dash", () => {
    expect(
      formatRangeSubline({
        range: "week",
        bounds: {
          start: "2026-07-27T00:00:00.000Z",
          end: "2026-07-28T00:00:00.000Z",
        },
        count: 2,
        earliestSoldAt: "2025-08-03T00:00:00.000Z",
      }),
    ).toBe("This week · 2 sales · Jul 27, 2026");
  });

  it("singularizes one sale", () => {
    expect(
      formatRangeSubline({
        range: "year",
        bounds: {
          start: "2026-01-01T00:00:00.000Z",
          end: "2026-08-01T00:00:00.000Z",
        },
        count: 1,
        earliestSoldAt: "2026-07-30T00:00:00.000Z",
      }),
    ).toBe("This year · 1 sale · Jan 1 – Jul 31, 2026");
  });

  it("converts an Aug 1 exclusive end to a Jul 31 inclusive end", () => {
    const result = formatRangeSubline({
      range: "month",
      bounds: {
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-08-01T00:00:00.000Z",
      },
      count: 0,
      earliestSoldAt: "2025-08-03T00:00:00.000Z",
    });

    expect(result).toContain("Jul 31");
    expect(result).not.toContain("Aug 1");
  });
});

describe("formatSaleDate", () => {
  it("formats a UTC-midnight timestamp without shifting to the previous day", () => {
    expect(formatSaleDate("2026-07-30T00:00:00.000Z")).toBe("Jul 30, 2026");
  });
});

describe("formatRoi", () => {
  it("rounds ledger percentages to a whole number", () => {
    expect(formatRoi(1999.4)).toBe("1999%");
  });

  it("renders an em dash for a missing ROI", () => {
    expect(formatRoi(null)).toBe("—");
  });
});

describe("formatFee", () => {
  it("renders an em dash when no fee was recorded", () => {
    expect(formatFee(0)).toBe("—");
  });

  it("renders a deduction sign and two decimal places", () => {
    expect(formatFee(14.3)).toBe("−$14.30");
  });
});

describe("formatProfitDelta", () => {
  it("uses the earliest sale for the all-time caption", () => {
    expect(
      formatProfitDelta({
        profit: 500,
        previousProfit: 100,
        range: "all",
        earliestSoldAt: "2025-08-03T00:00:00.000Z",
      }),
    ).toEqual({ text: "Since Aug 2025", tone: "muted" });
  });

  it("uses an empty-state caption when there is no earliest sale", () => {
    expect(
      formatProfitDelta({
        profit: 0,
        previousProfit: 0,
        range: "all",
        earliestSoldAt: null,
      }),
    ).toEqual({ text: "No sales yet", tone: "muted" });
  });

  it.each([
    ["week", "No profit last week"],
    ["month", "No profit last month"],
    ["year", "No profit last year"],
  ] as const)("handles a zero previous profit for %s", (range, text) => {
    expect(
      formatProfitDelta({
        profit: 100,
        previousProfit: 0,
        range,
        earliestSoldAt: null,
      }),
    ).toEqual({ text, tone: "muted" });
  });

  it("reproduces the upward monthly delta", () => {
    expect(
      formatProfitDelta({
        profit: 382.4,
        previousProfit: 215.8,
        range: "month",
        earliestSoldAt: null,
      }),
    ).toEqual({
      text: "▲ 77% vs last month ($215.80)",
      tone: "up",
    });
  });

  it("renders a downward delta with an unsigned percentage", () => {
    expect(
      formatProfitDelta({
        profit: 39.22,
        previousProfit: 44.5,
        range: "week",
        earliestSoldAt: null,
      }),
    ).toEqual({
      text: "▼ 12% vs last week ($44.50)",
      tone: "down",
    });
  });

  it("uses the absolute previous loss as the denominator", () => {
    expect(
      formatProfitDelta({
        profit: -50,
        previousProfit: -100,
        range: "year",
        earliestSoldAt: null,
      }),
    ).toEqual({
      text: "▲ 50% vs last year (-$100)",
      tone: "up",
    });
  });

  it("treats an unchanged profit as non-negative", () => {
    expect(
      formatProfitDelta({
        profit: 25,
        previousProfit: 25,
        range: "week",
        earliestSoldAt: null,
      }),
    ).toEqual({ text: "▲ 0% vs last week ($25)", tone: "up" });
  });
});

describe("platform presentation maps", () => {
  it("covers every platform enum member", () => {
    const platforms = Object.values(Platform).sort();

    expect(Object.keys(PLATFORM_SHORT_LABELS).sort()).toEqual(platforms);
    expect(Object.keys(PLATFORM_BAR_CLASSES).sort()).toEqual(platforms);
  });
});
