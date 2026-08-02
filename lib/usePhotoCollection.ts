"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import {
  createPhotoCollectionState,
  getSavablePhotoUrls,
  photoCollectionReducer,
  type DraftPhoto,
  type PhotoCollectionState,
} from "./item-edit-draft";

async function deleteCreateUpload(url: string): Promise<boolean> {
  try {
    const response = await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type PhotoCollectionController = {
  photos: DraftPhoto[];
  lastRemoval: PhotoCollectionState["lastRemoval"];
  savablePhotoUrls: string[] | null;
  cleanupError: string | null;
  addPhotos: (photos: DraftPhoto[]) => void;
  markPhotoUploadStarted: (photoId: string) => void;
  markPhotoUploadSucceeded: (photoId: string, url: string) => void;
  markPhotoUploadFailed: (photoId: string, error: string) => void;
  removePhoto: (photoId: string) => void;
  undoPhotoRemoval: () => void;
  movePhoto: (photoId: string, toIndex: number) => void;
  setCover: (photoId: string) => void;
  dismissCleanupError: () => void;
  reset: () => void;
};

export function usePhotoCollection(
  initialUrls: string[],
): PhotoCollectionController {
  const [state, dispatch] = useReducer(
    photoCollectionReducer,
    initialUrls,
    createPhotoCollectionState,
  );
  const cleanupOnSuccessIdsRef = useRef<Set<string>>(new Set());
  const pendingDeletionUrlRef = useRef<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  useEffect(() => {
    // Retire the last undoable removal when the page goes away, so abandoning
    // /new mid-edit does not leave the object behind.
    return (): void => {
      const url = pendingDeletionUrlRef.current;
      if (url === null) return;
      pendingDeletionUrlRef.current = null;
      void deleteCreateUpload(url);
    };
  }, []);

  function reportDeleteResult(deleted: boolean): void {
    if (!deleted) {
      setCleanupError(
        "Photo removed, but the stored file could not be deleted.",
      );
    }
  }

  function deleteUpload(url: string): void {
    void deleteCreateUpload(url).then(reportDeleteResult);
  }

  function markPhotoUploadSucceeded(photoId: string, url: string): void {
    dispatch({ type: "photo_upload_succeeded", photoId, url });
    if (!cleanupOnSuccessIdsRef.current.has(photoId)) return;

    cleanupOnSuccessIdsRef.current.delete(photoId);
    deleteUpload(url);
  }

  // Deleting a removed photo's object immediately would strand Undo: the
  // reducer restores the DraftPhoto with its original url, which by then would
  // point at nothing. Hold the url until the removal stops being undoable —
  // the reducer keeps only one lastRemoval, so a second removal, a reset, or
  // unmount all retire it.
  function flushPendingDeletion(): void {
    const url = pendingDeletionUrlRef.current;
    if (url === null) return;
    pendingDeletionUrlRef.current = null;
    deleteUpload(url);
  }

  function removePhoto(photoId: string): void {
    const photo = state.photos.find(
      (candidate: DraftPhoto): boolean => candidate.id === photoId,
    );
    if (photo === undefined) return;

    flushPendingDeletion();
    if (photo.status === "uploading") {
      cleanupOnSuccessIdsRef.current.add(photoId);
    } else if (photo.status === "ready" && photo.url !== null) {
      pendingDeletionUrlRef.current = photo.url;
    }
    dispatch({ type: "photo_removed", photoId });
  }

  function undoPhotoRemoval(): void {
    if (state.lastRemoval !== null) {
      cleanupOnSuccessIdsRef.current.delete(state.lastRemoval.photo.id);
    }
    pendingDeletionUrlRef.current = null;
    dispatch({ type: "photo_removal_undone" });
  }

  function reset(): void {
    cleanupOnSuccessIdsRef.current.clear();
    flushPendingDeletion();
    setCleanupError(null);
    dispatch({ type: "photos_replaced", urls: [] });
  }

  return {
    photos: state.photos,
    lastRemoval: state.lastRemoval,
    savablePhotoUrls: getSavablePhotoUrls(state),
    cleanupError,
    addPhotos: (photos: DraftPhoto[]): void =>
      dispatch({ type: "photos_added", photos }),
    markPhotoUploadStarted: (photoId: string): void =>
      dispatch({ type: "photo_upload_started", photoId }),
    markPhotoUploadSucceeded,
    markPhotoUploadFailed: (photoId: string, error: string): void =>
      dispatch({ type: "photo_upload_failed", photoId, error }),
    removePhoto,
    undoPhotoRemoval,
    movePhoto: (photoId: string, toIndex: number): void =>
      dispatch({ type: "photo_moved", photoId, toIndex }),
    setCover: (photoId: string): void =>
      dispatch({ type: "photo_moved", photoId, toIndex: 0 }),
    dismissCleanupError: (): void => setCleanupError(null),
    reset,
  };
}
