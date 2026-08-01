import { describe, expect, it } from "vitest";
import type { ProfitBucket } from "./analytics";
import { toProfitBars } from "./profit-bars";

function bucket(overrides: Partial<ProfitBucket> = {}): ProfitBucket {
  return {
    key: "2026-07-01",
    label: "Jul 1",
    tipLabel: "Jul 1",
    profit: 10,
    revenue: 20,
    count: 1,
    ...overrides,
  };
}

describe("toProfitBars", () => {
  it("highlights the last bucket with sales when empty buckets follow it", () => {
    const bars = toProfitBars([
      bucket({ key: "2026-07-01" }),
      bucket({ key: "2026-07-02", label: "Jul 2", tipLabel: "Jul 2" }),
      bucket({
        key: "2026-07-03",
        label: "Jul 3",
        tipLabel: "Jul 3",
        profit: 0,
        revenue: 0,
        count: 0,
      }),
    ]);

    expect(bars.map((bar) => bar.tone)).toEqual([
      "positive",
      "latest",
      "empty",
    ]);
  });

  it("renders an empty bucket without a bar or value label", () => {
    const [bar] = toProfitBars([
      bucket({ profit: 0, revenue: 0, count: 0 }),
    ]);

    expect(bar).toMatchObject({
      tone: "empty",
      heightPct: 0,
      valueLabel: "",
    });
  });

  it("uses absolute profit for a negative bar and keeps the latest loss red", () => {
    const bars = toProfitBars([
      bucket({ key: "2026-07-01", profit: 100 }),
      bucket({ key: "2026-07-02", profit: -25 }),
    ]);

    expect(bars[1]).toMatchObject({
      tone: "negative",
      heightPct: 25,
      valueLabel: "-$25",
    });
  });

  it("gives active zero-profit buckets a finite three-percent bar", () => {
    const bars = toProfitBars([
      bucket({ key: "2026-07-01", profit: 0 }),
      bucket({ key: "2026-07-02", profit: 0, count: 2 }),
    ]);

    expect(bars.map((bar) => bar.heightPct)).toEqual([3, 3]);
    expect(bars.every((bar) => Number.isFinite(bar.heightPct))).toBe(true);
  });

  it("scales heights against the largest absolute profit", () => {
    const bars = toProfitBars([
      bucket({ key: "2026-07-01", profit: 50 }),
      bucket({ key: "2026-07-02", profit: -200 }),
    ]);

    expect(bars.map((bar) => bar.heightPct)).toEqual([25, 100]);
  });

  it("rounds proportional heights to one decimal place", () => {
    const bars = toProfitBars([
      bucket({ key: "2026-07-01", profit: 1 }),
      bucket({ key: "2026-07-02", profit: 3 }),
    ]);

    expect(bars.map((bar) => bar.heightPct)).toEqual([33.3, 100]);
  });

  it("uses the one-unit scale floor for sub-dollar profits", () => {
    const [bar] = toProfitBars([bucket({ profit: 0.1 })]);

    expect(bar?.heightPct).toBe(10);
  });

  it("formats singular and plural tooltip text", () => {
    const bars = toProfitBars([
      bucket({ profit: 5, count: 1 }),
      bucket({
        key: "2026-07-08",
        label: "Jul 8",
        tipLabel: "Week of Jul 8",
        profit: 5,
        count: 3,
      }),
    ]);

    expect(bars[0]?.tip).toBe("Jul 1 · $5 from 1 sale");
    expect(bars[1]?.tip).toBe("Week of Jul 8 · $5 from 3 sales");
  });

  it("returns an empty array for empty input", () => {
    expect(toProfitBars([])).toEqual([]);
  });
});
