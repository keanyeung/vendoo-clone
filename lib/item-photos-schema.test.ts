import { describe, expect, it } from "vitest";

import { UpdateItemSchema } from "./item-schema";
import { MAX_FILES } from "./upload-limits";

function updatePayload(photos?: string[]) {
  return {
    ...(photos === undefined ? {} : { photos }),
    title: "Patagonia fleece",
    summary: null,
    description: "A black fleece jacket.",
    brand: "Patagonia",
    category: "Jacket",
    size: "Men's Medium",
    color: "Black",
    condition: "good",
    conditionNotes: null,
    listPrice: 65,
    purchasePrice: 20,
    keywords: ["fleece"],
    purchaseDate: null,
    notes: null,
  };
}

function photoUrl(index: number): string {
  return `https://project.supabase.co/storage/v1/object/public/item-photos/${index}.jpg`;
}

describe("UpdateItemSchema photos", () => {
  it("keeps details-only updates valid during the edit-page transition", () => {
    expect(UpdateItemSchema.safeParse(updatePayload()).success).toBe(true);
  });

  it("accepts an ordered photo array at the configured limit", () => {
    const photos = Array.from({ length: MAX_FILES }, (_, index) =>
      photoUrl(index),
    );

    const parsed = UpdateItemSchema.safeParse(updatePayload(photos));
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected ordered photos to parse");
    expect(parsed.data.photos).toEqual(photos);
  });

  it("rejects an empty photo array", () => {
    const parsed = UpdateItemSchema.safeParse(updatePayload([]));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected empty photos to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toContain(
      "At least one photo is required.",
    );
  });

  it("rejects more than the configured limit", () => {
    const photos = Array.from({ length: MAX_FILES + 1 }, (_, index) =>
      photoUrl(index),
    );

    expect(UpdateItemSchema.safeParse(updatePayload(photos)).success).toBe(
      false,
    );
  });

  it("rejects duplicate and malformed photo URLs", () => {
    const duplicate = photoUrl(1);
    const parsed = UpdateItemSchema.safeParse(
      updatePayload([duplicate, duplicate, "not-a-url"]),
    );

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected invalid photos to fail");
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Photo URL is malformed.",
        "The same photo cannot appear more than once.",
      ]),
    );
  });
});
