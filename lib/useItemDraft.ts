"use client";

import { useReducer, useRef } from "react";

import {
  cleanupDraftUploads,
  createItemEditDraftState,
  getDraftChangeSummary,
  getSavablePhotoUrls,
  getUnusedDraftUploadUrls,
  hasDraftFieldChanges,
  hasDraftPhotoChanges,
  isItemDraftDirty,
  itemEditDraftReducer,
  type DraftPhoto,
  type DraftUploadCleanupResult,
  type ItemDraftFields,
  type ItemEditDraftState,
} from "./item-edit-draft";
import type { ItemDto } from "./item-dto";

async function deleteDraftUpload(url: string): Promise<boolean> {
  const response = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return response.ok;
}

export type ItemDraftController = {
  state: ItemEditDraftState;
  fields: ItemDraftFields;
  photos: DraftPhoto[];
  lastRemoval: ItemEditDraftState["lastRemoval"];
  dirty: boolean;
  fieldsDirty: boolean;
  photosDirty: boolean;
  changeSummary: string;
  savablePhotoUrls: string[] | null;
  setField: <Key extends keyof ItemDraftFields>(
    field: Key,
    value: ItemDraftFields[Key],
  ) => void;
  replaceFields: (fields: ItemDraftFields) => void;
  addPhotos: (photos: DraftPhoto[]) => void;
  markPhotoUploadStarted: (photoId: string) => void;
  markPhotoUploadSucceeded: (photoId: string, url: string) => void;
  markPhotoUploadFailed: (photoId: string, error: string) => void;
  removePhoto: (photoId: string) => void;
  undoPhotoRemoval: () => void;
  movePhoto: (photoId: string, toIndex: number) => void;
  setCover: (photoId: string) => void;
  discard: () => Promise<DraftUploadCleanupResult>;
  finalizeSave: () => Promise<DraftUploadCleanupResult>;
};

export function useItemDraft(item: ItemDto): ItemDraftController {
  const [state, dispatch] = useReducer(
    itemEditDraftReducer,
    item,
    createItemEditDraftState,
  );
  const activeNewPhotoIdsRef = useRef<Set<string>>(new Set());
  const uploadedUrlByPhotoIdRef = useRef<Map<string, string>>(new Map());
  const cleanupOnSuccessIdsRef = useRef<Set<string>>(new Set());

  function setField<Key extends keyof ItemDraftFields>(
    field: Key,
    value: ItemDraftFields[Key],
  ): void {
    dispatch({ type: "field_changed", field, value });
  }

  async function discard(): Promise<DraftUploadCleanupResult> {
    const uploadUrls = [...uploadedUrlByPhotoIdRef.current.values()];
    for (const photoId of activeNewPhotoIdsRef.current) {
      if (!uploadedUrlByPhotoIdRef.current.has(photoId)) {
        cleanupOnSuccessIdsRef.current.add(photoId);
      }
    }
    activeNewPhotoIdsRef.current.clear();
    uploadedUrlByPhotoIdRef.current.clear();
    dispatch({ type: "discarded" });
    return cleanupDraftUploads(uploadUrls, deleteDraftUpload);
  }

  async function finalizeSave(): Promise<DraftUploadCleanupResult> {
    const retainedNewPhotoIds = new Set(
      state.photos
        .filter((photo: DraftPhoto): boolean => photo.origin === "new")
        .map((photo: DraftPhoto): string => photo.id),
    );
    for (const photoId of activeNewPhotoIdsRef.current) {
      if (
        !retainedNewPhotoIds.has(photoId) &&
        !uploadedUrlByPhotoIdRef.current.has(photoId)
      ) {
        cleanupOnSuccessIdsRef.current.add(photoId);
      }
    }
    const unusedUploadUrls = getUnusedDraftUploadUrls(state);
    const result = await cleanupDraftUploads(
      unusedUploadUrls,
      deleteDraftUpload,
    );
    activeNewPhotoIdsRef.current.clear();
    uploadedUrlByPhotoIdRef.current.clear();
    dispatch({ type: "saved" });
    return result;
  }

  function addPhotos(photos: DraftPhoto[]): void {
    for (const photo of photos) {
      if (photo.origin === "new") activeNewPhotoIdsRef.current.add(photo.id);
    }
    dispatch({ type: "photos_added", photos });
  }

  function markPhotoUploadSucceeded(photoId: string, url: string): void {
    if (cleanupOnSuccessIdsRef.current.has(photoId)) {
      void deleteDraftUpload(url)
        .catch((): boolean => false)
        .finally((): void => {
          cleanupOnSuccessIdsRef.current.delete(photoId);
        });
      return;
    }

    uploadedUrlByPhotoIdRef.current.set(photoId, url);
    dispatch({ type: "photo_upload_succeeded", photoId, url });
  }

  return {
    state,
    fields: state.fields,
    photos: state.photos,
    lastRemoval: state.lastRemoval,
    dirty: isItemDraftDirty(state),
    fieldsDirty: hasDraftFieldChanges(state),
    photosDirty: hasDraftPhotoChanges(state),
    changeSummary: getDraftChangeSummary(state),
    savablePhotoUrls: getSavablePhotoUrls(state),
    setField,
    replaceFields: (fields: ItemDraftFields): void =>
      dispatch({ type: "fields_replaced", fields }),
    addPhotos,
    markPhotoUploadStarted: (photoId: string): void =>
      dispatch({ type: "photo_upload_started", photoId }),
    markPhotoUploadSucceeded,
    markPhotoUploadFailed: (photoId: string, error: string): void =>
      dispatch({ type: "photo_upload_failed", photoId, error }),
    removePhoto: (photoId: string): void =>
      dispatch({ type: "photo_removed", photoId }),
    undoPhotoRemoval: (): void =>
      dispatch({ type: "photo_removal_undone" }),
    movePhoto: (photoId: string, toIndex: number): void =>
      dispatch({ type: "photo_moved", photoId, toIndex }),
    setCover: (photoId: string): void =>
      dispatch({ type: "photo_moved", photoId, toIndex: 0 }),
    discard,
    finalizeSave,
  };
}
