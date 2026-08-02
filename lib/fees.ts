import type { Platform } from "@prisma/client";

export const FEE_RULES = {
  FB_MARKETPLACE: { rate: 0, flat: 0 },
  DEPOP: { rate: 0.1, flat: 0 },
  EBAY: { rate: 0.1325, flat: 0.4 },
} as const satisfies Record<Platform, { rate: number; flat: number }>;

export const FEE_HINTS = {
  FB_MARKETPLACE: "Local pickup — usually $0",
  DEPOP: "Est. 10% of sold price",
  EBAY: "Est. 13.25% + $0.40",
} as const satisfies Record<Platform, string>;

export function estimateFees(platform: Platform, soldPrice: number): number {
  // Partially typed form values must not create invalid or negative fees.
  if (!Number.isFinite(soldPrice) || soldPrice < 0) {
    return 0;
  }

  const { rate, flat } = FEE_RULES[platform];
  const estimate = soldPrice * rate + flat;
  const rounded = Math.round(estimate * 100) / 100;

  return Number.isFinite(rounded) ? rounded : 0;
}

export function chargesFees(platform: Platform): boolean {
  const { rate, flat } = FEE_RULES[platform];
  return rate > 0 || flat > 0;
}
