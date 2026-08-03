import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/photos", async () => import("./photos"));
vi.mock("@/lib/storage", () => ({
  deletePhoto: vi.fn(),
  listStoredPhotos: vi.fn(),
}));

import { sweepOrphanedUploads } from "./orphaned-uploads";
import type { StoredPhotoObject } from "./storage";

const NOW = new Date("2026-08-02T12:00:00.000Z");

function photo(
  name: string,
  createdAt: string | null = "2026-07-31T12:00:00.000Z",
): StoredPhotoObject {
  return {
    objectPath: name,
    publicUrl: `https://project.supabase.co/storage/v1/object/public/item-photos/${name}`,
    createdAt,
  };
}

describe("sweepOrphanedUploads", () => {
  it("identifies only old unreferenced objects in the default dry run", async () => {
    const photos = [
      photo("known-orphan.jpg"),
      photo("referenced.jpg"),
      photo("in-flight.jpg", "2026-08-02T11:00:00.000Z"),
    ];
    const countReferences = vi.fn(async (url: string) =>
      url.endsWith("referenced.jpg") ? 1 : 0,
    );
    const removePhoto = vi.fn(async () => undefined);

    const result = await sweepOrphanedUploads(
      { now: NOW },
      {
        listPhotos: async () => photos,
        countReferences,
        removePhoto,
      },
    );

    expect(countReferences).toHaveBeenCalledTimes(3);
    expect(removePhoto).not.toHaveBeenCalled();
    expect(result).toEqual({
      dryRun: true,
      scanned: 3,
      orphaned: 1,
      deleted: 0,
      failed: 0,
    });
  });

  it("deletes an old orphan only when explicitly enabled", async () => {
    const orphan = photo("known-orphan.jpg");
    const referenced = photo("referenced.jpg");
    const young = photo("in-flight.jpg", "2026-08-02T11:00:00.000Z");
    const removePhoto = vi.fn(async () => undefined);

    const result = await sweepOrphanedUploads(
      { deleteOrphans: true, now: NOW },
      {
        listPhotos: async () => [orphan, referenced, young],
        countReferences: async (url) => (url === referenced.publicUrl ? 1 : 0),
        removePhoto,
      },
    );

    expect(removePhoto).toHaveBeenCalledOnce();
    expect(removePhoto).toHaveBeenCalledWith(orphan.publicUrl);
    expect(removePhoto).not.toHaveBeenCalledWith(referenced.publicUrl);
    expect(removePhoto).not.toHaveBeenCalledWith(young.publicUrl);
    expect(result).toEqual({
      dryRun: false,
      scanned: 3,
      orphaned: 1,
      deleted: 1,
      failed: 0,
    });
  });

  it("continues safely after reference checks or deletions fail", async () => {
    const referenceFailure = photo("reference-failure.jpg");
    const deletionFailure = photo("deletion-failure.jpg");
    const success = photo("success.jpg");

    const result = await sweepOrphanedUploads(
      { deleteOrphans: true, now: NOW },
      {
        listPhotos: async () => [referenceFailure, deletionFailure, success],
        countReferences: async (url) => {
          if (url === referenceFailure.publicUrl) {
            throw new Error("Database unavailable");
          }
          return 0;
        },
        removePhoto: async (url) => {
          if (url === deletionFailure.publicUrl) {
            throw new Error("Storage unavailable");
          }
        },
      },
    );

    expect(result).toEqual({
      dryRun: false,
      scanned: 3,
      orphaned: 2,
      deleted: 1,
      failed: 2,
    });
  });
});
