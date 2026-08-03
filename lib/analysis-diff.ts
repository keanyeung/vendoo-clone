import type { Analysis } from "./analysis-schema";
import type { ItemDraftFields } from "./item-edit-draft";

export const ANALYSIS_EDITABLE_FIELDS = [
  "title",
  "summary",
  "description",
  "brand",
  "category",
  "size",
  "color",
  "condition",
  "conditionNotes",
  "listPrice",
  "keywords",
] as const satisfies readonly (keyof ItemDraftFields)[];

export type AnalysisEditableField =
  (typeof ANALYSIS_EDITABLE_FIELDS)[number];

export type AnalysisFieldChange = {
  field: AnalysisEditableField;
  label: string;
  current: string;
  proposed: string;
};

const FIELD_LABELS: Record<AnalysisEditableField, string> = {
  title: "Title",
  summary: "Summary",
  description: "Marketplace listing body",
  brand: "Brand",
  category: "Category",
  size: "Size",
  color: "Color",
  condition: "Condition",
  conditionNotes: "Condition notes",
  listPrice: "List price",
  keywords: "Keywords",
};

function analysisDraftFields(analysis: Analysis): Pick<
  ItemDraftFields,
  AnalysisEditableField
> {
  return {
    title: analysis.title,
    summary: analysis.summary,
    description: analysis.description,
    brand: analysis.brand ?? "",
    category: analysis.category,
    size: analysis.size ?? "",
    color: analysis.color ?? "",
    condition: analysis.condition,
    conditionNotes: analysis.condition_notes,
    listPrice: String(analysis.suggested_price),
    keywords: [...analysis.keywords],
  };
}

function valuesEqual(
  current: ItemDraftFields[AnalysisEditableField],
  proposed: ItemDraftFields[AnalysisEditableField],
): boolean {
  if (Array.isArray(current) && Array.isArray(proposed)) {
    return JSON.stringify(current) === JSON.stringify(proposed);
  }
  return current === proposed;
}

function displayValue(
  field: AnalysisEditableField,
  value: ItemDraftFields[AnalysisEditableField],
): string {
  if (Array.isArray(value)) return value.length === 0 ? "Not set" : value.join(", ");
  if (value.trim() === "") return "Not set";
  if (field === "listPrice") {
    const price = Number(value);
    return Number.isFinite(price)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(price)
      : value;
  }
  if (field === "condition") {
    const label = value.replaceAll("_", " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return value;
}

export function buildAnalysisDiff(
  fields: ItemDraftFields,
  analysis: Analysis,
): AnalysisFieldChange[] {
  const proposedFields = analysisDraftFields(analysis);

  return ANALYSIS_EDITABLE_FIELDS.flatMap((field) => {
    const current = fields[field];
    const proposed = proposedFields[field];
    if (valuesEqual(current, proposed)) return [];

    return [
      {
        field,
        label: FIELD_LABELS[field],
        current: displayValue(field, current),
        proposed: displayValue(field, proposed),
      },
    ];
  });
}

export function applyAnalysisSelection(
  fields: ItemDraftFields,
  analysis: Analysis,
  selectedFields: readonly AnalysisEditableField[],
): ItemDraftFields {
  const proposedFields = analysisDraftFields(analysis);
  const selected = new Set(selectedFields);
  const selectedEntries = ANALYSIS_EDITABLE_FIELDS.filter((field) =>
    selected.has(field),
  ).map((field) => [
    field,
    field === "keywords"
      ? [...proposedFields.keywords]
      : proposedFields[field],
  ]);

  return {
    ...fields,
    keywords: [...fields.keywords],
    ...Object.fromEntries(selectedEntries),
  } as ItemDraftFields;
}

export function analysisReferenceFields(analysis: Analysis) {
  return {
    suggestedPrice: analysis.suggested_price,
    priceLow: analysis.price_low,
    priceHigh: analysis.price_high,
    priceReasoning: analysis.price_reasoning,
    aiConfidence: analysis.confidence,
  };
}
