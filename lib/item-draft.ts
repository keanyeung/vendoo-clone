import { AnalysisSchema, type Analysis } from "./analysis-schema";
import type { ItemDto } from "./item-dto";
import type {
  CreateItemInput,
  DraftItemInput,
} from "./item-schema";

export type ItemDraft = {
  photos: string[];
  title: string;
  summary: string;
  description: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  condition: Analysis["condition"];
  aiCondition: Analysis["condition"];
  conditionNotes: string;
  suggestedPrice: number;
  priceLow: number;
  priceHigh: number;
  priceReasoning: string;
  listPrice: string;
  purchasePrice: string;
  keywords: string;
  aiConfidence: Analysis["confidence"];
  purchaseDate: string;
  notes: string;
};

export type DraftItemStatus = "DRAFT" | "LISTED";
export type DraftStep = "photos" | "analyzed" | "reviewed";

export type PersistedDraftItem = {
  photos: string[];
  title: string;
  summary: string | null;
  description: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  condition: string | null;
  conditionNotes: string | null;
  suggestedPrice: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  priceReasoning: string | null;
  listPrice: number;
  purchasePrice: number;
  keywords: string[];
  aiConfidence: string | null;
  purchaseDate: string | null;
  notes: string | null;
  draftStep: string | null;
};

function nullable(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((keyword: string): string => keyword.trim())
    .filter((keyword: string): boolean => keyword !== "");
}

export function createItemDraft(
  analysis: Analysis,
  photoUrls: string[],
): ItemDraft {
  return {
    photos: photoUrls,
    title: analysis.title,
    summary: analysis.summary,
    description: analysis.description,
    brand: analysis.brand ?? "",
    category: analysis.category,
    size: analysis.size ?? "",
    color: analysis.color ?? "",
    condition: analysis.condition,
    aiCondition: analysis.condition,
    conditionNotes: analysis.condition_notes,
    suggestedPrice: analysis.suggested_price,
    priceLow: analysis.price_low,
    priceHigh: analysis.price_high,
    priceReasoning: analysis.price_reasoning,
    listPrice: String(analysis.suggested_price),
    purchasePrice: "",
    keywords: analysis.keywords.join(", "),
    aiConfidence: analysis.confidence,
    purchaseDate: "",
    notes: "",
  };
}

export function buildCreateItemInput(
  draft: ItemDraft,
  status: DraftItemStatus,
): CreateItemInput {
  return {
    photos: draft.photos,
    title: draft.title,
    summary: nullable(draft.summary),
    description: draft.description,
    brand: nullable(draft.brand),
    category: draft.category,
    size: nullable(draft.size),
    color: nullable(draft.color),
    condition: draft.condition,
    conditionNotes: nullable(draft.conditionNotes),
    suggestedPrice: draft.suggestedPrice,
    priceLow: draft.priceLow,
    priceHigh: draft.priceHigh,
    priceReasoning: nullable(draft.priceReasoning),
    listPrice: Number(draft.listPrice),
    purchasePrice:
      draft.purchasePrice.trim() === ""
        ? status === "DRAFT"
          ? 0
          : Number.NaN
        : Number(draft.purchasePrice),
    keywords: parseKeywords(draft.keywords),
    aiConfidence: draft.aiConfidence,
    purchaseDate: nullable(draft.purchaseDate),
    notes: nullable(draft.notes),
    status,
  };
}

export function buildDraftItemInput(
  draft: ItemDraft,
  draftStep: DraftStep,
): DraftItemInput {
  return {
    photos: draft.photos,
    title: draft.title,
    summary: nullable(draft.summary),
    description: draft.description,
    brand: nullable(draft.brand),
    category: nullable(draft.category),
    size: nullable(draft.size),
    color: nullable(draft.color),
    condition: draft.condition,
    conditionNotes: nullable(draft.conditionNotes),
    suggestedPrice: draft.suggestedPrice,
    priceLow: draft.priceLow,
    priceHigh: draft.priceHigh,
    priceReasoning: nullable(draft.priceReasoning),
    listPrice:
      draft.listPrice.trim() === "" ? undefined : Number(draft.listPrice),
    purchasePrice:
      draft.purchasePrice.trim() === ""
        ? undefined
        : Number(draft.purchasePrice),
    keywords: parseKeywords(draft.keywords),
    aiConfidence: draft.aiConfidence,
    purchaseDate: nullable(draft.purchaseDate),
    notes: nullable(draft.notes),
    status: "DRAFT",
    draftStep,
  };
}

export function buildDraftMutationData(
  draft: ItemDraft,
  draftStep: DraftStep,
): Omit<DraftItemInput, "status"> {
  const { status, ...data } = buildDraftItemInput(draft, draftStep);
  void status;
  return data;
}

export function restorePersistedDraft(item: PersistedDraftItem): {
  analysis: Analysis | null;
  draft: ItemDraft | null;
} {
  const parsedAnalysis = AnalysisSchema.safeParse({
    title: item.title,
    summary: item.summary ?? "",
    description: item.description,
    brand: item.brand,
    category: item.category ?? "",
    size: item.size,
    color: item.color,
    condition: item.condition,
    condition_notes: item.conditionNotes ?? "",
    suggested_price: item.suggestedPrice,
    price_low: item.priceLow,
    price_high: item.priceHigh,
    price_reasoning: item.priceReasoning ?? "",
    keywords: item.keywords,
    confidence: item.aiConfidence,
  });
  if (!parsedAnalysis.success) return { analysis: null, draft: null };

  const analysis = parsedAnalysis.data;
  const draft = {
    ...createItemDraft(analysis, item.photos),
    title: item.title,
    summary: item.summary ?? "",
    description: item.description,
    brand: item.brand ?? "",
    category: item.category ?? "",
    size: item.size ?? "",
    color: item.color ?? "",
    condition: analysis.condition,
    conditionNotes: item.conditionNotes ?? "",
    listPrice: String(item.listPrice),
    // The draft API stores a missing purchase price as the database's zero
    // sentinel, and the promotion endpoint treats that sentinel as missing.
    purchasePrice: item.purchasePrice === 0 ? "" : String(item.purchasePrice),
    keywords: item.keywords.join(", "),
    purchaseDate: item.purchaseDate?.slice(0, 10) ?? "",
    notes: item.notes ?? "",
  };
  return {
    analysis:
      item.draftStep === "analyzed" || item.draftStep === "reviewed"
        ? analysis
        : null,
    draft,
  };
}

export function buildDraftItemDto(
  draft: ItemDraft,
  id: string,
  status: DraftItemStatus,
  timestamp: string,
): ItemDto {
  const input = buildCreateItemInput(draft, status);
  const finiteMoney = (value: number): number =>
    Number.isFinite(value) ? value : 0;

  return {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    photos: input.photos,
    title: input.title,
    summary: input.summary,
    description: input.description,
    brand: input.brand,
    category: input.category,
    size: input.size,
    color: input.color,
    condition: input.condition,
    conditionNotes: input.conditionNotes,
    suggestedPrice: input.suggestedPrice,
    priceLow: input.priceLow,
    priceHigh: input.priceHigh,
    priceReasoning: input.priceReasoning,
    listPrice: finiteMoney(input.listPrice),
    purchasePrice: finiteMoney(input.purchasePrice),
    keywords: input.keywords,
    aiConfidence: input.aiConfidence,
    purchaseDate: input.purchaseDate,
    notes: input.notes,
    status,
    soldPrice: null,
    soldPlatform: null,
    soldDate: null,
    platformFees: null,
  };
}
