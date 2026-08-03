import { describe, expect, it } from "vitest";

import type { Analysis } from "./analysis-schema";
import {
  analysisReferenceFields,
  applyAnalysisSelection,
  buildAnalysisDiff,
} from "./analysis-diff";
import type { ItemDraftFields } from "./item-edit-draft";

const fields: ItemDraftFields = {
  title: "Current title",
  summary: "Current summary",
  description: "Current body",
  brand: "Nike",
  category: "Sneakers",
  size: "Men's 10",
  color: "Black",
  condition: "good",
  conditionNotes: "Light wear.",
  listPrice: "50",
  purchasePrice: "20",
  keywords: ["nike", "sneakers"],
  purchaseDate: "2026-07-01",
  notes: "Private",
};

const analysis: Analysis = {
  title: "Proposed title",
  summary: "Current summary",
  description: "Proposed body",
  brand: "Nike",
  category: "Sneakers",
  size: "Men's 10",
  color: "Black/White",
  condition: "excellent",
  condition_notes: "No visible flaws.",
  suggested_price: 65,
  price_low: 55,
  price_high: 75,
  price_reasoning: "Strong demand. Price reflects condition.",
  keywords: ["nike", "retro", "sneakers"],
  confidence: "high",
};

describe("analysis edit diff", () => {
  it("includes only editable values that would change", () => {
    expect(buildAnalysisDiff(fields, analysis).map((change) => change.field))
      .toEqual([
        "title",
        "description",
        "color",
        "condition",
        "conditionNotes",
        "listPrice",
        "keywords",
      ]);
  });

  it("applies only selected fields and preserves private fields", () => {
    const next = applyAnalysisSelection(fields, analysis, [
      "listPrice",
      "color",
    ]);

    expect(next.listPrice).toBe("65");
    expect(next.color).toBe("Black/White");
    expect(next.title).toBe(fields.title);
    expect(next.description).toBe(fields.description);
    expect(next.purchasePrice).toBe(fields.purchasePrice);
    expect(next.notes).toBe(fields.notes);
  });

  it("maps AI reference fields without mixing them into editable fields", () => {
    expect(analysisReferenceFields(analysis)).toEqual({
      suggestedPrice: 65,
      priceLow: 55,
      priceHigh: 75,
      priceReasoning: "Strong demand. Price reflects condition.",
      aiConfidence: "high",
    });
  });
});
