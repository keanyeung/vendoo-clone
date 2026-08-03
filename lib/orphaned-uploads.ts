import "server-only";

import { prisma } from "@/lib/db";
import { isPhotoObjectOlderThanMinimum } from "@/lib/photos";
import {
  deletePhoto,
  listStoredPhotos,
  type StoredPhotoObject,
} from "@/lib/storage";

type OrphanedUploadSweepDependencies = {
  listPhotos: () => Promise<StoredPhotoObject[]>;
  countReferences: (photoUrl: string) => Promise<number>;
  removePhoto: (photoUrl: string) => Promise<void>;
};

export type OrphanedUploadSweepResult = {
  dryRun: boolean;
  scanned: number;
  orphaned: number;
  deleted: number;
  failed: number;
};

const defaultDependencies: OrphanedUploadSweepDependencies = {
  listPhotos: listStoredPhotos,
  countReferences: (photoUrl) =>
    prisma.item.count({ where: { photos: { has: photoUrl } } }),
  removePhoto: deletePhoto,
};

export async function sweepOrphanedUploads(
  options: {
    deleteOrphans?: boolean;
    now?: Date;
  } = {},
  dependencies: OrphanedUploadSweepDependencies = defaultDependencies,
): Promise<OrphanedUploadSweepResult> {
  const deleteOrphans = options.deleteOrphans === true;
  const now = options.now ?? new Date();
  const photos = await dependencies.listPhotos();
  const result: OrphanedUploadSweepResult = {
    dryRun: !deleteOrphans,
    scanned: 0,
    orphaned: 0,
    deleted: 0,
    failed: 0,
  };

  for (const photo of photos) {
    result.scanned += 1;

    let referenceCount: number;
    try {
      referenceCount = await dependencies.countReferences(photo.publicUrl);
    } catch {
      result.failed += 1;
      continue;
    }

    if (
      referenceCount !== 0 ||
      !isPhotoObjectOlderThanMinimum(photo.createdAt, now)
    ) {
      continue;
    }

    result.orphaned += 1;
    if (!deleteOrphans) continue;

    try {
      await dependencies.removePhoto(photo.publicUrl);
      result.deleted += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
