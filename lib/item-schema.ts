import { z } from "zod";

import {
  CONDITION_VALUES,
  CONFIDENCE_VALUES,
} from "@/lib/analysis-schema";
import { MAX_FILES } from "@/lib/upload-limits";

// Single shared contract for creating an inventory item, used by the form and API route so neither can drift.
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

export const CreateItemSchema = z
  .object({
    photos: z
      .array(z.string())
      .min(1, { message: "At least one photo is required." })
      .max(MAX_FILES, {
        message: `At most ${MAX_FILES} photos are allowed.`,
      }),
    title: z
      .string()
      .trim()
      .min(1, { message: "Title is required." })
      .max(140),
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
    suggestedPrice: money.nonnegative().nullable(),
    priceLow: money.nonnegative().nullable(),
    priceHigh: money.nonnegative().nullable(),
    priceReasoning: z.string().nullable(),
    listPrice: money.positive({
      message: "List price must be greater than 0.",
    }),
    purchasePrice: requiredPurchaseMoney.nonnegative({
      message: "Purchase price cannot be negative.",
    }),
    keywords: z.array(z.string()).max(15).default([]),
    aiConfidence: z.enum(CONFIDENCE_VALUES).nullable(),
    purchaseDate: z
      .string()
      .refine((value: string): boolean => !Number.isNaN(Date.parse(value)), {
        message: "Purchase date is invalid.",
      })
      .nullable(),
    notes: z.string().nullable(),
    // SOLD is only available later through the sell flow.
    status: z.enum(["DRAFT", "LISTED"]).default("LISTED"),
  })
  .refine(
    (item): boolean =>
      item.priceLow === null ||
      item.priceHigh === null ||
      item.priceLow <= item.priceHigh,
    {
      message: "Price low cannot be greater than price high.",
      path: ["priceHigh"],
    },
  );

export type CreateItemInput = z.infer<typeof CreateItemSchema>;

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue): string => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export const UpdateItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required." })
    .max(140),
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
  // Photos, AI reference fields, status, and sale fields have separate ownership or actions.
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
    }),
  platformFees: money
    .nonnegative({
      message: "Platform fees cannot be negative.",
    })
    .nullable(),
});

export const SetStatusSchema = z.object({
  // SOLD requires the complete sale record supplied by the mark_sold action.
  status: z.enum(["DRAFT", "LISTED"]),
});

export const ItemMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    data: UpdateItemSchema,
  }),
  z.object({
    action: z.literal("mark_sold"),
    data: MarkSoldSchema,
  }),
  z.object({
    action: z.literal("set_status"),
    data: SetStatusSchema,
  }),
]);

export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;
export type MarkSoldInput = z.infer<typeof MarkSoldSchema>;
export type SetStatusInput = z.infer<typeof SetStatusSchema>;
export type ItemMutationInput = z.infer<typeof ItemMutationSchema>;
