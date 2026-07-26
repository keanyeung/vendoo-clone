import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnalysisSchema, type Analysis } from "@/lib/analysis-schema";

export const DEFAULT_MODEL = "claude-opus-4-8";

export const SYSTEM_PROMPT = `You are an expert secondhand clothing and footwear reseller. You analyze photos of a single item and produce an accurate, honest listing draft for resale on eBay, Depop, and Facebook Marketplace.

Rules:
- Describe only what is actually visible in the photos. Never invent details, materials, measurements, or history you cannot see.
- Read any visible tags closely for brand, size, and fabric. If a tag is not legible, say the size is unknown rather than guessing.
- Be honest and specific about flaws such as pilling, stains, fading, holes, sole wear, or stretched cuffs. Accurate condition reporting reduces returns and builds buyer trust.
- Price for the SECONDHAND resale market, not retail. Base the range on what this brand, model, and condition realistically sells for used. Most ordinary used clothing sells for modest amounts; do not inflate prices.
- Account for platform differences: eBay reaches collectors and buyers searching for specific items, Depop skews younger and pays a premium for vintage and streetwear, and Facebook Marketplace is local, price-sensitive, and best for fast sales.
- If you cannot confidently identify the brand or model, set confidence to low and keep the title generic rather than asserting a brand you are unsure about.`;

const USER_PROMPT =
  "These photos all show the SAME single item from different angles and close-ups. Analyze them together as one item and produce the listing details.";

let anthropic: Anthropic | undefined;

function getAnthropicClient(): Anthropic {
  if (anthropic) return anthropic;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing required environment variable: ANTHROPIC_API_KEY",
    );
  }

  anthropic = new Anthropic({ apiKey });
  return anthropic;
}

export type AnalysisResult = {
  analysis: Analysis;
  usage: { inputTokens: number; outputTokens: number; model: string };
};

export async function analyzeItemPhotos(
  photoUrls: string[],
): Promise<AnalysisResult> {
  if (photoUrls.length === 0) {
    throw new Error("At least one photo URL is required to analyze an item.");
  }

  const content: Anthropic.ContentBlockParam[] = photoUrls.map((url) => ({
    type: "image",
    source: { type: "url", url },
  }));
  content.push({ type: "text", text: USER_PROMPT });

  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const response = await (async () => {
    try {
      return await client.messages.parse({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(AnalysisSchema) },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Anthropic analysis request failed: ${message}`);
    }
  })();

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to analyze the provided images.");
  }

  const analysis = response.parsed_output;
  if (analysis == null) {
    throw new Error("The model did not return a valid structured result.");
  }

  return {
    analysis,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: response.model,
    },
  };
}
