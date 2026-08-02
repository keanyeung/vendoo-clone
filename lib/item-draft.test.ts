import { describe, expect, it } from "vitest";

import {
  buildCreateItemInput,
  type ItemDraft,
} from "./item-draft";
import { CreateItemSchema } from "./item-schema";
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
