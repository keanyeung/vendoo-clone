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
      "One concise sentence (under ~20 words) summarizing the item for a marketplace listing: what it is, the brand, and one or two standout attributes. Do not include price, condition, or size — size has its own line, and price and condition are handled in their own fields. Plain text, exactly one sentence.",
    ),
  description: z
    .string()
    .describe(
      "Concise buyer-facing listing description of exactly 2 short sentences and no more than 35 words total. In the first sentence, identify the item, its brand, and its most notable visible features. In the second sentence, add further detail a buyer would care about, such as material, fit, cut, styling, era, or how it wears. Do not mention condition, wear, flaws, or price — condition is recorded separately in the condition and condition_notes fields, and never appears in the pasted listing text. Do not invent details that are not visible in the photos. Plain text only, no markdown.",
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
      "Exactly 1 concise sentence of no more than 18 words describing visible wear or damage. If no flaws are visible, say that briefly. Never speculate about damage that is not visible. Plain text only, no markdown.",
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
      "Exactly two sentences and no more than 45 words total explaining the price using brand desirability, condition, and realistic comparable secondhand sales. When relevant, use the second sentence to explain how pricing differs across eBay, Depop, and Facebook Marketplace.",
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
