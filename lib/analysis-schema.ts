import { z } from "zod";

// Shared contract for AI listing analysis.
export const CONDITION_VALUES = [
  "new_with_tags",
  "excellent",
  "good",
  "fair",
  "poor",
] as const;

export const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;

export const AnalysisSchema = z.object({
  title: z
    .string()
    .describe(
      "Marketplace-ready listing title, roughly 60-80 characters. Lead with the brand, then the item type, then key attributes such as size and colour. Write it the way an experienced reseller would title a listing, not as a sentence.",
    ),
  summary: z
    .string()
    .describe(
      "One concise sentence (under ~20 words) summarizing the item for a marketplace listing: what it is, the brand, and one or two standout attributes. Do not include price, condition, or size — those are shown on their own lines. Plain text, exactly one sentence.",
    ),
  description: z
    .string()
    .describe(
      "Buyer-facing listing description of 3 to 6 sentences. Cover what the item is, visible materials or construction, fit, and condition. Be honest about flaws. Do not invent details that are not visible in the photos. Plain text only, no markdown.",
    ),
  brand: z
    .string()
    .nullable()
    .describe(
      "Brand name if identifiable from a logo, tag, or distinctive design. Null if it cannot be determined from the photos.",
    ),
  category: z
    .string()
    .describe(
      "Broad item category, such as Sweatshirt, Sneakers, Jacket, T-Shirt, or Jeans.",
    ),
  size: z
    .string()
    .nullable()
    .describe(
      "The item's department and size, formatted as '<Department> <Size>' where Department is Men's, Women's, or Unisex, inferred from the tag, cut, or styling. Use the size as printed on the tag, for example 'Men's Medium', \"Women's Small\", 'Unisex Large', or 'Men's 32x30'. For footwear, give BOTH US sizes separated by ' / ' as \"Men's 10 / Women's 11.5\" (women's US runs about 1.5 sizes larger than men's). Null if no size is visible in the photos.",
    ),
  color: z
    .string()
    .nullable()
    .describe(
      "Primary colour of the item. Use a two-tone form such as Red/White when appropriate. Null if unclear.",
    ),
  condition: z
    .enum(CONDITION_VALUES)
    .describe(
      "Overall condition. Use new_with_tags only when tags are visibly still attached, excellent for barely worn with no visible flaws, good for light even wear, fair for clearly visible wear or minor damage, and poor for significant damage.",
    ),
  condition_notes: z
    .string()
    .describe(
      "Specific wear or damage visible in the photos, such as pilling, stains, fading, sole wear, or missing buttons. If the item looks clean and unworn, say so briefly. Never speculate about damage that is not visible.",
    ),
  suggested_price: z
    .number()
    .nonnegative()
    .describe(
      "The single price in USD to list this item at on the secondhand market. Must fall between price_low and price_high.",
    ),
  price_low: z
    .number()
    .nonnegative()
    .describe(
      "Low end of the realistic secondhand resale range in USD for this item in this condition.",
    ),
  price_high: z
    .number()
    .nonnegative()
    .describe(
      "High end of the realistic secondhand resale range in USD for this item in this condition.",
    ),
  price_reasoning: z
    .string()
    .describe(
      "Two to four sentences explaining the price: brand desirability, condition, and comparable secondhand sales. Where relevant, note how the price should differ across eBay, Depop, and Facebook Marketplace.",
    ),
  keywords: z
    .array(z.string())
    .describe(
      "Five to ten lowercase search terms a buyer would type to find this item. Include brand, item type, style, and era or collection where relevant.",
    ),
  confidence: z
    .enum(CONFIDENCE_VALUES)
    .describe(
      "How confident you are in the item identification. Use low when the brand or model cannot be clearly determined from the photos.",
    ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type Condition = Analysis["condition"];
export type Confidence = Analysis["confidence"];
