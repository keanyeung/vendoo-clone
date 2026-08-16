import { z } from "zod";

import {
  CONDITION_VALUES,
  CONFIDENCE_VALUES,
} from "./analysis-schema";
import { MAX_FILES } from "./upload-limits";

// Single shared contract for creating an inventory item, used by the form and API route so neither can drift.
export const ITEM_TITLE_MAX_LENGTH = 140;
const COPY_TITLE_SUFFIX = " (copy)";

export function buildDuplicateTitle(title: string): string {
  const availableLength = ITEM_TITLE_MAX_LENGTH - COPY_TITLE_SUFFIX.length;
  return `${title.slice(0, availableLength).trimEnd()}${COPY_TITLE_SUFFIX}`;
}

const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.round(value * 100) / 100 === value;

const money = z
  .number()
  .refine(hasAtMostTwoDecimals, {
    message: "Amount can have at most 2 decimal places.",
  });
const requiredPurchaseMoney = z
  .number({ error: "Purchase price is required." })
  .refine(hasAtMostTwoDecimals, {
    message: "Amount can have at most 2 decimal places.",
  });
const orderedPhotoUrls = z
  .array(z.string().url({ message: "Photo URL is malformed." }))
  .min(1, { message: "At least one photo is required." })
  .max(MAX_FILES, {
    message: `At most ${MAX_FILES} photos are allowed.`,
  })
  .refine(
    (photos: string[]): boolean => new Set(photos).size === photos.length,
    { message: "The same photo cannot appear more than once." },
  );

const sharedItemFields = {
  photos: orderedPhotoUrls,
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required." })
    .max(ITEM_TITLE_MAX_LENGTH),
  summary: z.string().nullable(),
  description: z
    .string()
    .min(1, { message: "Description is required." }),
  brand: z.string().nullable(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  condition: z.enum(CONDITION_VALUES),
  conditionNotes: z.string().nullable(),
  suggestedPrice: money.nonnegative().nullable(),
  priceLow: money.nonnegative().nullable(),
  priceHigh: money.nonnegative().nullable(),
  priceReasoning: z.string().nullable(),
  keywords: z.array(z.string()).max(15).default([]),
  aiConfidence: z.enum(CONFIDENCE_VALUES).nullable(),
  purchaseDate: z
    .string()
    .refine((value: string): boolean => !Number.isNaN(Date.parse(value)), {
      message: "Purchase date is invalid.",
    })
    .nullable(),
  notes: z.string().nullable(),
};

const hasOrderedPriceRange = (item: {
  priceLow: number | null;
  priceHigh: number | null;
}): boolean =>
  item.priceLow === null ||
  item.priceHigh === null ||
  item.priceLow <= item.priceHigh;

export const CreateItemSchema = z
  .object({
    ...sharedItemFields,
    category: z
      .string()
      .trim()
      .min(1, { message: "Category is required." }),
    listPrice: money.positive({
      message: "List price must be greater than 0.",
    }),
    purchasePrice: requiredPurchaseMoney.nonnegative({
      message: "Purchase price cannot be negative.",
    }),
    // SOLD is only available later through the sell flow.
    status: z.enum(["DRAFT", "LISTED"]).default("LISTED"),
  })
  .refine(hasOrderedPriceRange, {
    message: "Price low cannot be greater than price high.",
    path: ["priceHigh"],
  });

const draftItemFields = {
  ...sharedItemFields,
  // A photo-only or manual-entry draft exists before listing copy is known.
  // The strict create schema still requires both fields before publishing.
  title: z.string().max(ITEM_TITLE_MAX_LENGTH),
  description: z.string(),
  category: z.string().trim().nullable(),
  listPrice: money.nonnegative().optional(),
  purchasePrice: money.nonnegative({
    message: "Purchase price cannot be negative.",
  }).optional(),
  draftStep: z.enum(["photos", "analyzed", "reviewed"]).nullable().optional(),
};

export const DraftItemSchema = z
  .object({
    ...draftItemFields,
    status: z.literal("DRAFT"),
  })
  .refine(hasOrderedPriceRange, {
    message: "Price low cannot be greater than price high.",
    path: ["priceHigh"],
  });

const UpdateDraftItemSchema = z
  .object(draftItemFields)
  .refine(hasOrderedPriceRange, {
    message: "Price low cannot be greater than price high.",
    path: ["priceHigh"],
  });

export type CreateItemInput = z.infer<typeof CreateItemSchema>;
export type DraftItemInput = z.infer<typeof DraftItemSchema>;

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue): string => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export const UpdateItemSchema = z.object({
  // Optional during the transition so the existing details-only editor remains valid.
  // The dedicated edit page sends the complete ordered array when it is introduced.
  photos: orderedPhotoUrls.optional(),
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required." })
    .max(ITEM_TITLE_MAX_LENGTH),
  summary: z.string().nullable(),
  description: z
    .string()
    .min(1, { message: "Description is required." }),
  brand: z.string().nullable(),
  category: z
    .string()
    .trim()
    .min(1, { message: "Category is required." }),
  size: z.string().nullable(),
  color: z.string().nullable(),
  condition: z.enum(CONDITION_VALUES),
  conditionNotes: z.string().nullable(),
  listPrice: money.positive({
    message: "List price must be greater than 0.",
  }),
  purchasePrice: money.nonnegative({
    message: "Purchase price cannot be negative.",
  }),
  keywords: z.array(z.string()).max(15).default([]),
  purchaseDate: z
    .string()
    .refine((value: string): boolean => !Number.isNaN(Date.parse(value)), {
      message: "Purchase date is invalid.",
    })
    .nullable(),
  notes: z.string().nullable(),
  // AI reference fields, status, and sale fields have separate ownership or actions.
});

export const PatchItemFieldsSchema = z
  .object({
    title: UpdateItemSchema.shape.title.optional(),
    listPrice: UpdateItemSchema.shape.listPrice.optional(),
    purchasePrice: UpdateItemSchema.shape.purchasePrice.optional(),
  })
  .strict()
  .refine(
    (fields): boolean =>
      fields.title !== undefined ||
      fields.listPrice !== undefined ||
      fields.purchasePrice !== undefined,
    { message: "Provide a title, list price, or purchase price to update." },
  );

export const ApplyAnalysisSchema = UpdateItemSchema.extend({
  suggestedPrice: money.nonnegative(),
  priceLow: money.nonnegative(),
  priceHigh: money.nonnegative(),
  priceReasoning: z.string(),
  aiConfidence: z.enum(CONFIDENCE_VALUES),
}).refine(hasOrderedPriceRange, {
  message: "Price low cannot be greater than price high.",
  path: ["priceHigh"],
});

export const MarkSoldSchema = z.object({
  soldPrice: money.positive({
    message: "Sold price must be greater than 0.",
  }),
  soldPlatform: z.enum(["FB_MARKETPLACE", "DEPOP", "EBAY"]),
  soldDate: z
    .string()
    .refine((value: string): boolean => !Number.isNaN(Date.parse(value)), {
      message: "Sold date is invalid.",
    })
    .refine((value: string): boolean => {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) || parsed <= Date.now() + 24 * 60 * 60 * 1000;
    }, {
      message: "Sold date cannot be in the future.",
    }),
  platformFees: money
    .nonnegative({
      message: "Platform fees cannot be negative.",
    })
    .nullable(),
  shippingCost: money
    .nonnegative({
      message: "Shipping cost cannot be negative.",
    })
    .nullable(),
});

export const SetStatusSchema = z.object({
  // SOLD requires the complete sale record supplied by the mark_sold action.
  status: z.enum(["DRAFT", "LISTED"]),
});

const postingPlatform = z.enum(["FB_MARKETPLACE", "DEPOP", "EBAY"]);
const postingUrl = z
  .string()
  .trim()
  .url({ message: "Listing URL is invalid." })
  .max(2048, { message: "Listing URL is too long." })
  .nullable()
  .optional();

export const UpsertItemPostingSchema = z.object({
  platform: postingPlatform,
  url: postingUrl,
});

export const RemoveItemPostingSchema = z.object({
  platform: postingPlatform,
});

export const ItemMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    data: UpdateItemSchema,
  }),
  z.object({
    action: z.literal("update_draft"),
    data: UpdateDraftItemSchema,
  }),
  z.object({
    action: z.literal("patch_fields"),
    data: PatchItemFieldsSchema,
  }),
  z.object({
    action: z.literal("apply_analysis"),
    data: ApplyAnalysisSchema,
  }),
  z.object({
    action: z.literal("mark_sold"),
    data: MarkSoldSchema,
  }),
  z.object({
    action: z.literal("edit_sale"),
    data: MarkSoldSchema,
  }),
  z.object({
    action: z.literal("set_status"),
    data: SetStatusSchema,
  }),
]);

const bulkItemIds = z
  .array(
    z.string().trim().min(1, {
      message: "Item ids cannot be empty.",
    }),
  )
  .min(1, { message: "Select at least one item." })
  .max(200, { message: "Bulk actions are limited to 200 items at a time." });

export const BulkItemMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_status"),
    ids: bulkItemIds,
    data: SetStatusSchema,
  }),
  z.object({
    action: z.literal("delete"),
    ids: bulkItemIds,
  }),
]);

export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type UpdateDraftItemInput = z.infer<typeof UpdateDraftItemSchema>;
export type PatchItemFieldsInput = z.infer<typeof PatchItemFieldsSchema>;
export type ApplyAnalysisInput = z.infer<typeof ApplyAnalysisSchema>;
export type MarkSoldInput = z.infer<typeof MarkSoldSchema>;
export type EditSaleInput = z.infer<typeof MarkSoldSchema>;
export type SetStatusInput = z.infer<typeof SetStatusSchema>;
export type UpsertItemPostingInput = z.infer<
  typeof UpsertItemPostingSchema
>;
export type RemoveItemPostingInput = z.infer<
  typeof RemoveItemPostingSchema
>;
export type ItemMutationInput = z.infer<typeof ItemMutationSchema>;
export type BulkItemMutationInput = z.infer<typeof BulkItemMutationSchema>;
