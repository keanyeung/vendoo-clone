import { describe, expect, it } from "vitest";

import {
  buildCreateItemInput,
  buildDraftItemInput,
  restorePersistedDraft,
  type ItemDraft,
} from "./item-draft";
import { CreateItemSchema, DraftItemSchema } from "./item-schema";
import { MAX_FILES } from "./upload-limits";

function photoUrl(index: number): string {
  return `https://project.supabase.co/storage/v1/object/public/item-photos/${index}.jpg`;
}

function draftWithPhotos(photos: string[]): ItemDraft {
  return {
    photos,
    title: "Patagonia fleece",
    summary: "Black fleece jacket",
    description: "A black fleece jacket.",
    brand: "Patagonia",
    category: "Jacket",
    size: "Men's Medium",
    color: "Black",
    condition: "good",
    aiCondition: "good",
    conditionNotes: "",
    suggestedPrice: 65,
    priceLow: 50,
    priceHigh: 75,
    priceReasoning: "Comparable recent sales.",
    listPrice: "65",
    purchasePrice: "20",
    keywords: "fleece, jacket",
    aiConfidence: "high",
    purchaseDate: "",
    notes: "",
  };
}

describe("create item photo order", () => {
  it("preserves the reordered photo array through the create schema", () => {
    const orderedPhotos = [photoUrl(3), photoUrl(1), photoUrl(2)];
    const parsed = CreateItemSchema.safeParse(
      buildCreateItemInput(draftWithPhotos(orderedPhotos), "LISTED"),
    );

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected create input to parse");
    expect(parsed.data.photos).toEqual(orderedPhotos);
  });

  it("enforces the create photo minimum, maximum, and uniqueness", () => {
    const duplicate = photoUrl(1);
    const invalidPhotoSets = [
      [],
      Array.from({ length: MAX_FILES + 1 }, (_, index) => photoUrl(index)),
      [duplicate, duplicate],
    ];

    for (const photos of invalidPhotoSets) {
      const parsed = CreateItemSchema.safeParse(
        buildCreateItemInput(draftWithPhotos(photos), "LISTED"),
      );
      expect(parsed.success).toBe(false);
    }
  });
});

describe("server draft input", () => {
  it("uses the relaxed draft contract for empty prices and category", () => {
    const draft = {
      ...draftWithPhotos([photoUrl(1)]),
      category: "",
      listPrice: "",
      purchasePrice: "",
    };
    const parsed = DraftItemSchema.safeParse(
      buildDraftItemInput(draft, "analyzed"),
    );

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected draft input to parse");
    expect(parsed.data.category).toBeNull();
    expect(parsed.data.listPrice).toBeUndefined();
    expect(parsed.data.purchasePrice).toBeUndefined();
    expect(parsed.data.draftStep).toBe("analyzed");
  });

  it("restores editable and AI reference fields from an analyzed row", () => {
    const restored = restorePersistedDraft({
      photos: [photoUrl(1)],
      title: "Edited Patagonia fleece",
      summary: "Black fleece jacket",
      description: "A black fleece jacket.",
      brand: "Patagonia",
      category: "Jacket",
      size: "Men's Medium",
      color: "Black",
      condition: "good",
      conditionNotes: "Light wear.",
      suggestedPrice: 65,
      priceLow: 50,
      priceHigh: 75,
      priceReasoning: "Comparable recent sales.",
      listPrice: 60,
      purchasePrice: 20,
      keywords: ["fleece", "jacket"],
      aiConfidence: "high",
      purchaseDate: "2026-08-01T00:00:00.000Z",
      notes: "Thrifted",
      draftStep: "reviewed",
    });

    expect(restored.analysis?.suggested_price).toBe(65);
    expect(restored.draft).toMatchObject({
      title: "Edited Patagonia fleece",
      listPrice: "60",
      purchasePrice: "20",
      purchaseDate: "2026-08-01",
      notes: "Thrifted",
    });
  });

  it("keeps a photos-step row out of the review form while retaining save data", () => {
    const restored = restorePersistedDraft({
      photos: [photoUrl(1)],
      title: "Photo draft",
      summary: null,
      description: "Pending analysis",
      brand: null,
      category: null,
      size: null,
      color: null,
      condition: "good",
      conditionNotes: null,
      suggestedPrice: 65,
      priceLow: 50,
      priceHigh: 75,
      priceReasoning: "Comparable recent sales.",
      listPrice: 0,
      purchasePrice: 0,
      keywords: [],
      aiConfidence: "high",
      purchaseDate: null,
      notes: null,
      draftStep: "photos",
    });

    expect(restored.analysis).toBeNull();
    expect(restored.draft?.photos).toEqual([photoUrl(1)]);
  });
});
