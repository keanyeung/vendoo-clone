import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/storage", () => ({ deletePhoto: vi.fn() }));

import { cleanupUnreferencedItemPhotos } from "./item-cleanup";

describe("cleanupUnreferencedItemPhotos", () => {
  it("never deletes a photo that a surviving item still references", async () => {
    const countReferences = vi.fn(async (photoUrl: string) =>
      photoUrl === "shared-photo" ? 1 : 0,
    );
    const removePhoto = vi.fn(async () => undefined);

    const result = await cleanupUnreferencedItemPhotos(
      ["shared-photo", "orphan-photo", "orphan-photo"],
      { countReferences, removePhoto },
    );

    expect(countReferences).toHaveBeenCalledTimes(2);
    expect(removePhoto).toHaveBeenCalledOnce();
    expect(removePhoto).toHaveBeenCalledWith("orphan-photo");
    expect(removePhoto).not.toHaveBeenCalledWith("shared-photo");
    expect(result).toEqual({ deleted: 1, retained: 1, failed: 0 });
  });

  it("keeps cleanup best-effort after a storage failure", async () => {
    const countReferences = vi.fn(async () => 0);
    const removePhoto = vi.fn(async (photoUrl: string) => {
      if (photoUrl === "fails") throw new Error("Storage unavailable");
    });

    const result = await cleanupUnreferencedItemPhotos(
      ["fails", "succeeds"],
      { countReferences, removePhoto },
    );

    expect(removePhoto).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ deleted: 1, retained: 0, failed: 1 });
  });
});
