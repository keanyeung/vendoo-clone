import { describe, expect, it } from "vitest";
import type { Platform } from "@prisma/client";
import {
  FEE_HINTS,
  chargesFees,
  estimateFees,
} from "./fees";

const PLATFORMS = [
  "FB_MARKETPLACE",
  "DEPOP",
  "EBAY",
] as const satisfies readonly Platform[];

describe("estimateFees", () => {
  it("estimates every platform at a $65 sold price", () => {
    expect(estimateFees("FB_MARKETPLACE", 65)).toBe(0);
    expect(estimateFees("DEPOP", 65)).toBe(6.5);
    expect(estimateFees("EBAY", 65)).toBe(9.01);
  });

  it("estimates every platform at a $0 sold price", () => {
    expect(estimateFees("FB_MARKETPLACE", 0)).toBe(0);
    expect(estimateFees("DEPOP", 0)).toBe(0);
    expect(estimateFees("EBAY", 0)).toBe(0.4);
  });

  it("applies eBay's flat fee on top of its percentage", () => {
    expect(estimateFees("EBAY", 65)).toBe(
      Math.round((65 * 0.1325 + 0.4) * 100) / 100,
    );
  });

  it("rounds estimates to an exact two-decimal money value", () => {
    const value = estimateFees("EBAY", 65);

    expect(value).toBe(9.01);
    expect(Math.round(value * 100) / 100 === value).toBe(true);
  });

  it("clamps negative and non-finite input to zero", () => {
    expect(estimateFees("EBAY", -1)).toBe(0);
    expect(estimateFees("EBAY", Number.NaN)).toBe(0);
    expect(estimateFees("EBAY", Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("chargesFees", () => {
  it("identifies fee-charging platforms", () => {
    expect(chargesFees("FB_MARKETPLACE")).toBe(false);
    expect(chargesFees("DEPOP")).toBe(true);
    expect(chargesFees("EBAY")).toBe(true);
  });
});

describe("FEE_HINTS", () => {
  it("has a non-empty hint for every platform", () => {
    for (const platform of PLATFORMS) {
      expect(FEE_HINTS[platform].length).toBeGreaterThan(0);
    }
  });
});
