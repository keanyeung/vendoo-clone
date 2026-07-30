export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
};

// Standard global API rates in USD per one million tokens.
// Last verified against Anthropic's published pricing on 2026-07-30.
export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  "claude-opus-4-8": {
    inputPer1M: 5,
    outputPer1M: 25,
  },
};

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

const tokenCount = new Intl.NumberFormat("en-US");

export function estimateModelCost(usage: ModelUsage): number | null {
  const pricing = MODEL_PRICING[usage.model];
  if (pricing === undefined) return null;
  if (
    !Number.isFinite(usage.inputTokens) ||
    !Number.isFinite(usage.outputTokens) ||
    usage.inputTokens < 0 ||
    usage.outputTokens < 0
  ) {
    return null;
  }

  return (
    (usage.inputTokens * pricing.inputPer1M +
      usage.outputTokens * pricing.outputPer1M) /
    1_000_000
  );
}

export function formatModelCost(cost: number): string {
  if (cost > 0 && cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

export function formatUsageLine(usage: ModelUsage): string {
  const parts = [
    `${tokenCount.format(usage.inputTokens)} in`,
    `${tokenCount.format(usage.outputTokens)} out`,
    usage.model,
  ];
  const cost = estimateModelCost(usage);
  if (cost !== null) parts.push(formatModelCost(cost));
  return parts.join(" · ");
}
