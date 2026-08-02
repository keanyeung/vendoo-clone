export type ProfitTone = "positive" | "negative" | "break-even";

export function profitTone(profit: number): ProfitTone {
  if (profit > 0) return "positive";
  if (profit < 0) return "negative";
  return "break-even";
}

export const PROFIT_TONE_CLASSES: Record<ProfitTone, string> = {
  positive: "text-green-700 dark:text-green-400",
  negative: "text-red-700 dark:text-red-400",
  "break-even": "text-foreground",
};
