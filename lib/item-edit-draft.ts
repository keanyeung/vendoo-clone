import { CONDITION_VALUES } from "./analysis-schema";
import type { ItemDto } from "./item-dto";
import type { UpdateItemInput } from "./item-schema";

export type ItemDraftFields = {
  title: string;
  summary: string;
  description: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  condition: (typeof CONDITION_VALUES)[number];
  conditionNotes: string;
  listPrice: string;
  purchasePrice: string;
  keywords: string[];
  purchaseDate: string;
  notes: string;
};

export type DraftPhotoStatus = "uploading" | "ready" | "error";

export type DraftPhoto = {
  id: string;
  filename: string;
  previewUrl: string;
  url: string | null;
  origin: "existing" | "new";
  status: DraftPhotoStatus;
  error: string | null;
};

export type RemovedDraftPhoto = {
  photo: DraftPhoto;
  index: number;
};

export type ItemEditDraftState = {
  originalFields: ItemDraftFields;
  originalPhotos: DraftPhoto[];
  fields: ItemDraftFields;
  photos: DraftPhoto[];
  lastRemoval: RemovedDraftPhoto | null;
  uploadedDraftUrls: string[];
};

export type ItemEditDraftAction =
  | { type: "fields_replaced"; fields: ItemDraftFields }
  | {
      type: "field_changed";
      field: keyof ItemDraftFields;
      value: ItemDraftFields[keyof ItemDraftFields];
    }
  | { type: "photos_added"; photos: DraftPhoto[] }
  | { type: "photo_upload_started"; photoId: string }
  | { type: "photo_upload_succeeded"; photoId: string; url: string }
  | { type: "photo_upload_failed"; photoId: string; error: string }
  | { type: "photo_removed"; photoId: string }
  | { type: "photo_removal_undone" }
  | { type: "photo_moved"; photoId: string; toIndex: number }
  | { type: "discarded" }
  | { type: "saved" };

export type DraftUploadCleanupResult = {
  deletedUrls: string[];
  failedUrls: string[];
};

export type DraftUploadDeleter = (url: string) => Promise<boolean>;

function cloneFields(fields: ItemDraftFields): ItemDraftFields {
  return { ...fields, keywords: [...fields.keywords] };
}

function clonePhotos(photos: DraftPhoto[]): DraftPhoto[] {
  return photos.map((photo: DraftPhoto): DraftPhoto => ({ ...photo }));
}

function existingPhoto(url: string, index: number): DraftPhoto {
  return {
    id: `existing:${url}`,
    filename: `Photo ${index + 1}`,
    previewUrl: url,
    url,
    origin: "existing",
    status: "ready",
    error: null,
  };
}

export function createDraftPhoto(
  id: string,
  filename: string,
  previewUrl: string,
): DraftPhoto {
  return {
    id,
    filename,
    previewUrl,
    url: null,
    origin: "new",
    status: "uploading",
    error: null,
  };
}

export function createItemDraftFields(item: ItemDto): ItemDraftFields {
  const condition =
    CONDITION_VALUES.find(
      (value): boolean => value === item.condition,
    ) ?? "good";

  return {
    title: item.title,
    summary: item.summary ?? "",
    description: item.description,
    brand: item.brand ?? "",
    category: item.category ?? "",
    size: item.size ?? "",
    color: item.color ?? "",
    condition,
    conditionNotes: item.conditionNotes ?? "",
    listPrice: String(item.listPrice),
    purchasePrice: String(item.purchasePrice),
    keywords: [...item.keywords],
    purchaseDate:
      item.purchaseDate === null ? "" : item.purchaseDate.slice(0, 10),
    notes: item.notes ?? "",
  };
}

function nullable(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export function buildItemUpdateInput(
  fields: ItemDraftFields,
  photos: string[],
): UpdateItemInput {
  return {
    photos,
    title: fields.title,
    summary: nullable(fields.summary),
    description: fields.description,
    brand: nullable(fields.brand),
    category: fields.category,
    size: nullable(fields.size),
    color: nullable(fields.color),
    condition: fields.condition,
    conditionNotes: nullable(fields.conditionNotes),
    listPrice:
      fields.listPrice.trim() === "" ? Number.NaN : Number(fields.listPrice),
    purchasePrice:
      fields.purchasePrice.trim() === ""
        ? Number.NaN
        : Number(fields.purchasePrice),
    keywords: fields.keywords
      .map((keyword: string): string => keyword.trim())
      .filter((keyword: string): boolean => keyword !== ""),
    purchaseDate: nullable(fields.purchaseDate),
    notes: nullable(fields.notes),
  };
}

export function buildEditDraftItemDto(
  item: ItemDto,
  fields: ItemDraftFields,
  photos: string[],
): ItemDto {
  const input = buildItemUpdateInput(fields, photos);
  const finiteMoney = (value: number): number =>
    Number.isFinite(value) ? value : 0;

  return {
    ...item,
    photos: input.photos ?? item.photos,
    title: input.title,
    summary: input.summary,
    description: input.description,
    brand: input.brand,
    category: input.category,
    size: input.size,
    color: input.color,
    condition: input.condition,
    conditionNotes: input.conditionNotes,
    listPrice: finiteMoney(input.listPrice),
    purchasePrice: finiteMoney(input.purchasePrice),
    keywords: input.keywords,
    purchaseDate: input.purchaseDate,
    notes: input.notes,
  };
}

export function createItemEditDraftState(item: ItemDto): ItemEditDraftState {
  const fields = createItemDraftFields(item);
  const photos = item.photos.map(existingPhoto);

  return {
    originalFields: cloneFields(fields),
    originalPhotos: clonePhotos(photos),
    fields,
    photos,
    lastRemoval: null,
    uploadedDraftUrls: [],
  };
}

function updatePhoto(
  photo: DraftPhoto,
  photoId: string,
  update: Partial<DraftPhoto>,
): DraftPhoto {
  return photo.id === photoId ? { ...photo, ...update } : photo;
}

function updatePhotoEverywhere(
  state: ItemEditDraftState,
  photoId: string,
  update: Partial<DraftPhoto>,
): Pick<ItemEditDraftState, "photos" | "lastRemoval"> {
  return {
    photos: state.photos.map((photo: DraftPhoto): DraftPhoto =>
      updatePhoto(photo, photoId, update),
    ),
    lastRemoval:
      state.lastRemoval?.photo.id === photoId
        ? {
            ...state.lastRemoval,
            photo: updatePhoto(state.lastRemoval.photo, photoId, update),
          }
        : state.lastRemoval,
  };
}

function movePhoto(
  photos: DraftPhoto[],
  photoId: string,
  toIndex: number,
): DraftPhoto[] {
  const fromIndex = photos.findIndex(
    (photo: DraftPhoto): boolean => photo.id === photoId,
  );
  if (fromIndex === -1 || photos.length < 2) return photos;

  const targetIndex = Math.max(0, Math.min(toIndex, photos.length - 1));
  if (fromIndex === targetIndex) return photos;

  const next = [...photos];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return photos;
  next.splice(targetIndex, 0, moved);
  return next;
}

export function itemEditDraftReducer(
  state: ItemEditDraftState,
  action: ItemEditDraftAction,
): ItemEditDraftState {
  switch (action.type) {
    case "fields_replaced":
      return { ...state, fields: cloneFields(action.fields) };
    case "field_changed":
      return {
        ...state,
        fields: {
          ...state.fields,
          [action.field]: action.value,
        } as ItemDraftFields,
      };
    case "photos_added": {
      const knownIds = new Set(
        state.photos.map((photo: DraftPhoto): string => photo.id),
      );
      const added = action.photos.filter(
        (photo: DraftPhoto): boolean => {
          if (knownIds.has(photo.id)) return false;
          knownIds.add(photo.id);
          return true;
        },
      );
      return { ...state, photos: [...state.photos, ...clonePhotos(added)] };
    }
    case "photo_upload_started": {
      const updated = updatePhotoEverywhere(state, action.photoId, {
        status: "uploading",
        error: null,
      });
      return { ...state, ...updated };
    }
    case "photo_upload_succeeded": {
      const updated = updatePhotoEverywhere(state, action.photoId, {
        status: "ready",
        url: action.url,
        error: null,
      });
      return {
        ...state,
        ...updated,
        uploadedDraftUrls: state.uploadedDraftUrls.includes(action.url)
          ? state.uploadedDraftUrls
          : [...state.uploadedDraftUrls, action.url],
      };
    }
    case "photo_upload_failed": {
      const updated = updatePhotoEverywhere(state, action.photoId, {
        status: "error",
        error: action.error,
      });
      return { ...state, ...updated };
    }
    case "photo_removed": {
      const index = state.photos.findIndex(
        (photo: DraftPhoto): boolean => photo.id === action.photoId,
      );
      const photo = state.photos[index];
      if (index === -1 || photo === undefined) return state;

      return {
        ...state,
        photos: state.photos.filter(
          (candidate: DraftPhoto): boolean => candidate.id !== action.photoId,
        ),
        lastRemoval: { photo, index },
      };
    }
    case "photo_removal_undone": {
      if (state.lastRemoval === null) return state;
      const photos = [...state.photos];
      photos.splice(
        Math.min(state.lastRemoval.index, photos.length),
        0,
        state.lastRemoval.photo,
      );
      return { ...state, photos, lastRemoval: null };
    }
    case "photo_moved":
      return {
        ...state,
        photos: movePhoto(state.photos, action.photoId, action.toIndex),
      };
    case "discarded":
      return {
        ...state,
        fields: cloneFields(state.originalFields),
        photos: clonePhotos(state.originalPhotos),
        lastRemoval: null,
        uploadedDraftUrls: [],
      };
    case "saved": {
      const committedPhotos = state.photos.map(
        (photo: DraftPhoto): DraftPhoto => ({
          ...photo,
          origin: "existing",
        }),
      );
      return {
        originalFields: cloneFields(state.fields),
        originalPhotos: clonePhotos(committedPhotos),
        fields: cloneFields(state.fields),
        photos: committedPhotos,
        lastRemoval: null,
        uploadedDraftUrls: [],
      };
    }
  }
}

export function hasDraftFieldChanges(state: ItemEditDraftState): boolean {
  return JSON.stringify(state.fields) !== JSON.stringify(state.originalFields);
}

export function hasDraftPhotoChanges(state: ItemEditDraftState): boolean {
  return (
    state.photos.length !== state.originalPhotos.length ||
    state.photos.some(
      (photo: DraftPhoto, index: number): boolean =>
        photo.id !== state.originalPhotos[index]?.id,
    )
  );
}

export function isItemDraftDirty(state: ItemEditDraftState): boolean {
  return hasDraftFieldChanges(state) || hasDraftPhotoChanges(state);
}

export function getDraftChangeSummary(state: ItemEditDraftState): string {
  const changed: string[] = [];
  if (hasDraftPhotoChanges(state)) changed.push("photos");
  if (hasDraftFieldChanges(state)) changed.push("details");

  return changed.length === 0
    ? "All changes saved."
    : `Edited ${changed.join(" and ")} — not saved yet.`;
}

export function getSavablePhotoUrls(
  state: ItemEditDraftState,
): string[] | null {
  if (state.photos.length === 0) return null;

  const urls: string[] = [];
  for (const photo of state.photos) {
    if (photo.status !== "ready" || photo.url === null) return null;
    urls.push(photo.url);
  }
  return urls;
}

export function getUnusedDraftUploadUrls(
  state: ItemEditDraftState,
): string[] {
  const retainedUrls = new Set(
    state.photos.flatMap((photo: DraftPhoto): string[] =>
      photo.url === null ? [] : [photo.url],
    ),
  );
  return state.uploadedDraftUrls.filter(
    (url: string): boolean => !retainedUrls.has(url),
  );
}

export async function cleanupDraftUploads(
  urls: string[],
  deleteUpload: DraftUploadDeleter,
): Promise<DraftUploadCleanupResult> {
  const uniqueUrls = [...new Set(urls)];
  const results = await Promise.all(
    uniqueUrls.map(async (url: string): Promise<[string, boolean]> => {
      try {
        return [url, await deleteUpload(url)];
      } catch {
        return [url, false];
      }
    }),
  );

  return results.reduce<DraftUploadCleanupResult>(
    (cleanup, [url, deleted]) => {
      cleanup[deleted ? "deletedUrls" : "failedUrls"].push(url);
      return cleanup;
    },
    { deletedUrls: [], failedUrls: [] },
  );
}
