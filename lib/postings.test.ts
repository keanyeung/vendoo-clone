import { describe, expect, it } from "vitest";

import {
  livePlatforms,
  missingPlatforms,
  postingAccessibleLabel,
  postingSummary,
  type PostingState,
} from "./postings";

const postings: PostingState[] = [
  { platform: "EBAY", removedAt: null },
  { platform: "FB_MARKETPLACE", removedAt: "2026-08-01T00:00:00.000Z" },
  { platform: "DEPOP", removedAt: null },
];

describe("posting helpers", () => {
  it("returns only live platforms in the canonical marketplace order", () => {
    expect(livePlatforms(postings)).toEqual(["DEPOP", "EBAY"]);
  });

  it("returns removed and never-posted platforms as missing", () => {
    expect(missingPlatforms(postings)).toEqual(["FB_MARKETPLACE"]);
    expect(missingPlatforms([])).toEqual([
      "FB_MARKETPLACE",
      "DEPOP",
      "EBAY",
    ]);
  });

  it("summarizes the number of live marketplaces", () => {
    expect(postingSummary(postings)).toBe("2 of 3 marketplaces");
    expect(postingSummary([])).toBe("0 of 3 marketplaces");
  });

  it("describes the live marketplace initials for assistive technology", () => {
    expect(postingAccessibleLabel(postings)).toBe(
      "Posted to Depop and eBay",
    );
    expect(postingAccessibleLabel([])).toBe(
      "Not posted to any marketplace",
    );
  });
});
