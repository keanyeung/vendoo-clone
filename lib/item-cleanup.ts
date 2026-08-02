import "server-only";

import { prisma } from "@/lib/db";
import { deletePhoto } from "@/lib/storage";

type PhotoCleanupDependencies = {
  countReferences: (photoUrl: string) => Promise<number>;
  removePhoto: (photoUrl: string) => Promise<void>;
};

export type PhotoCleanupResult = {
  deleted: number;
  retained: number;
  failed: number;
};

const defaultDependencies: PhotoCleanupDependencies = {
  countReferences: (photoUrl) =>
    prisma.item.count({ where: { photos: { has: photoUrl } } }),
  removePhoto: deletePhoto,
};

export async function cleanupUnreferencedItemPhotos(
  photoUrls: Iterable<string>,
  dependencies: PhotoCleanupDependencies = defaultDependencies,
): Promise<PhotoCleanupResult> {
  const result: PhotoCleanupResult = {
    deleted: 0,
    retained: 0,
    failed: 0,
  };

  for (const photoUrl of new Set(photoUrls)) {
    try {
      const referenceCount = await dependencies.countReferences(photoUrl);
      if (referenceCount !== 0) {
        result.retained += 1;
        continue;
      }

      await dependencies.removePhoto(photoUrl);
      result.deleted += 1;
    } catch {
      // Item rows are authoritative. Storage orphans can be retried later.
      result.failed += 1;
    }
  }

  return result;
}
