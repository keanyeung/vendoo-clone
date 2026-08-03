import { describe, expect, it, vi } from "vitest";

import {
  buildItemUpdateInput,
  cleanupDraftUploads,
  createDraftPhoto,
  createItemEditDraftState,
  createPhotoCollectionState,
  getDraftChangeSummary,
  getSavablePhotoUrls,
  getUnusedDraftUploadUrls,
  isItemDraftDirty,
  itemEditDraftReducer,
  photoCollectionReducer,
  type ItemEditDraftState,
} from "./item-edit-draft";
import type { ItemDto } from "./item-dto";

const PHOTO_ONE = "https://project.supabase.co/photo-one.jpg";
const PHOTO_TWO = "https://project.supabase.co/photo-two.jpg";
const UPLOADED_PHOTO = "https://project.supabase.co/uploaded.jpg";

function itemFixture(): ItemDto {
  return {
    id: "item-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    photos: [PHOTO_ONE, PHOTO_TWO],
    title: "Patagonia fleece",
    summary: "Black fleece jacket",
    description: "A black fleece jacket.",
    brand: "Patagonia",
    category: "Jacket",
    size: "Men's Medium",
    color: "Black",
    condition: "good",
    conditionNotes: null,
    suggestedPrice: 65,
    priceLow: 50,
    priceHigh: 75,
    priceReasoning: null,
    listPrice: 65,
    purchasePrice: 20,
    keywords: ["fleece", "jacket"],
    aiConfidence: "high",
    purchaseDate: "2026-01-01T00:00:00.000Z",
    notes: null,
    status: "LISTED",
    soldPrice: null,
    soldPlatform: null,
    soldDate: null,
    platformFees: null,
    shippingCost: null,
    postings: [],
  };
}

function initialState(): ItemEditDraftState {
  return createItemEditDraftState(itemFixture());
}

describe("item edit draft", () => {
  it("starts clean with the stored photo order ready to save", () => {
    const state = initialState();

    expect(isItemDraftDirty(state)).toBe(false);
    expect(getDraftChangeSummary(state)).toBe("All changes saved.");
    expect(getSavablePhotoUrls(state)).toEqual([PHOTO_ONE, PHOTO_TWO]);
  });

  it("builds the update payload with ordered photos and nullable fields", () => {
    const state = initialState();
    const input = buildItemUpdateInput(
      { ...state.fields, brand: "", keywords: [" fleece ", ""] },
      [PHOTO_TWO, PHOTO_ONE],
    );

    expect(input.photos).toEqual([PHOTO_TWO, PHOTO_ONE]);
    expect(input.brand).toBeNull();
    expect(input.keywords).toEqual(["fleece"]);
    expect(input.listPrice).toBe(65);
  });

  it("tracks field changes and becomes clean when the value is restored", () => {
    const original = initialState();
    const changed = itemEditDraftReducer(original, {
      type: "fields_replaced",
      fields: { ...original.fields, title: "Changed title" },
    });

    expect(isItemDraftDirty(changed)).toBe(true);
    expect(getDraftChangeSummary(changed)).toBe(
      "Edited details — not saved yet.",
    );

    const restored = itemEditDraftReducer(changed, {
      type: "fields_replaced",
      fields: original.fields,
    });
    expect(isItemDraftDirty(restored)).toBe(false);
  });

  it("removes a photo and undoes it at its original position", () => {
    const original = initialState();
    const removed = itemEditDraftReducer(original, {
      type: "photo_removed",
      photoId: original.photos[0]?.id ?? "missing",
    });

    expect(removed.photos.map((photo) => photo.url)).toEqual([PHOTO_TWO]);
    expect(removed.lastRemoval?.index).toBe(0);
    expect(getDraftChangeSummary(removed)).toBe(
      "Edited photos — not saved yet.",
    );

    const restored = itemEditDraftReducer(removed, {
      type: "photo_removal_undone",
    });
    expect(restored.photos.map((photo) => photo.url)).toEqual([
      PHOTO_ONE,
      PHOTO_TWO,
    ]);
    expect(isItemDraftDirty(restored)).toBe(false);
  });

  it("moves a photo to the cover position and preserves that saved order", () => {
    const original = initialState();
    const reordered = itemEditDraftReducer(original, {
      type: "photo_moved",
      photoId: original.photos[1]?.id ?? "missing",
      toIndex: 0,
    });

    expect(getSavablePhotoUrls(reordered)).toEqual([PHOTO_TWO, PHOTO_ONE]);
    expect(isItemDraftDirty(reordered)).toBe(true);
  });

  it("tracks a new upload without deleting it when removed from the draft", () => {
    const original = initialState();
    const draftPhoto = createDraftPhoto(
      "new-photo",
      "new-photo.jpg",
      "blob:preview",
    );
    const added = itemEditDraftReducer(original, {
      type: "photos_added",
      photos: [draftPhoto],
    });

    expect(getSavablePhotoUrls(added)).toBeNull();

    const uploaded = itemEditDraftReducer(added, {
      type: "photo_upload_succeeded",
      photoId: draftPhoto.id,
      url: UPLOADED_PHOTO,
    });
    const removed = itemEditDraftReducer(uploaded, {
      type: "photo_removed",
      photoId: draftPhoto.id,
    });

    expect(removed.uploadedDraftUrls).toEqual([UPLOADED_PHOTO]);
    expect(getUnusedDraftUploadUrls(removed)).toEqual([UPLOADED_PHOTO]);
    expect(getSavablePhotoUrls(removed)).toEqual([PHOTO_ONE, PHOTO_TWO]);
  });

  it("discard restores fields and photos and clears upload bookkeeping", () => {
    const original = initialState();
    const draftPhoto = createDraftPhoto("new-photo", "new.jpg", "blob:new");
    const changed = itemEditDraftReducer(
      itemEditDraftReducer(
        itemEditDraftReducer(original, {
          type: "photos_added",
          photos: [draftPhoto],
        }),
        {
          type: "photo_upload_succeeded",
          photoId: draftPhoto.id,
          url: UPLOADED_PHOTO,
        },
      ),
      {
        type: "fields_replaced",
        fields: { ...original.fields, title: "Changed" },
      },
    );

    const discarded = itemEditDraftReducer(changed, { type: "discarded" });
    expect(discarded.fields).toEqual(original.fields);
    expect(discarded.photos).toEqual(original.photos);
    expect(discarded.uploadedDraftUrls).toEqual([]);
    expect(isItemDraftDirty(discarded)).toBe(false);
  });

  it("marks the current state as the clean baseline after save", () => {
    const original = initialState();
    const reordered = itemEditDraftReducer(original, {
      type: "photo_moved",
      photoId: original.photos[1]?.id ?? "missing",
      toIndex: 0,
    });
    const saved = itemEditDraftReducer(reordered, { type: "saved" });

    expect(isItemDraftDirty(saved)).toBe(false);
    expect(saved.originalPhotos.map((photo) => photo.url)).toEqual([
      PHOTO_TWO,
      PHOTO_ONE,
    ]);
  });
});

describe("photo collection reducer", () => {
  it("returns null until every photo is ready, then preserves reordered URLs", () => {
    const pendingPhoto = createDraftPhoto(
      "new-photo",
      "new-photo.jpg",
      "blob:new-photo",
    );
    const withPending = photoCollectionReducer(
      createPhotoCollectionState([PHOTO_ONE]),
      { type: "photos_added", photos: [pendingPhoto] },
    );

    expect(getSavablePhotoUrls(withPending)).toBeNull();

    const ready = photoCollectionReducer(withPending, {
      type: "photo_upload_succeeded",
      photoId: pendingPhoto.id,
      url: UPLOADED_PHOTO,
    });
    const reordered = photoCollectionReducer(ready, {
      type: "photo_moved",
      photoId: pendingPhoto.id,
      toIndex: 0,
    });

    expect(getSavablePhotoUrls(reordered)).toEqual([
      UPLOADED_PHOTO,
      PHOTO_ONE,
    ]);
  });

  it("restores a removed photo at its original collection position", () => {
    const initial = createPhotoCollectionState([PHOTO_ONE, PHOTO_TWO]);
    const removed = photoCollectionReducer(initial, {
      type: "photo_removed",
      photoId: initial.photos[0]?.id ?? "missing",
    });
    const restored = photoCollectionReducer(removed, {
      type: "photo_removal_undone",
    });

    expect(getSavablePhotoUrls(restored)).toEqual([PHOTO_ONE, PHOTO_TWO]);
  });
});

describe("cleanupDraftUploads", () => {
  it("deduplicates URLs and reports successful and failed cleanup", async () => {
    const deleteUpload = vi.fn(async (url: string): Promise<boolean> => {
      if (url === "throws") throw new Error("offline");
      return url !== "fails";
    });

    const result = await cleanupDraftUploads(
      ["deleted", "deleted", "fails", "throws"],
      deleteUpload,
    );

    expect(deleteUpload).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      deletedUrls: ["deleted"],
      failedUrls: ["fails", "throws"],
    });
  });
});
