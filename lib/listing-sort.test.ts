import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  parseSort,
  serializeSort,
  SORT_OPTIONS,
} from "./listing-sort";

describe("listing sort tokens", () => {
  it("round-trips every select option", () => {
    for (const option of SORT_OPTIONS) {
      expect(parseSort(serializeSort(option.token))).toEqual(option.token);
    }
  });

  it("parses legacy aliases for old bookmarks", () => {
    expect(parseSort("newest")).toEqual({ field: "added", dir: "desc" });
    expect(parseSort("oldest")).toEqual({ field: "added", dir: "asc" });
    expect(parseSort("price-high")).toEqual({ field: "price", dir: "desc" });
    expect(parseSort("price-low")).toEqual({ field: "price", dir: "asc" });
  });

  it("falls back to the default for an unknown token", () => {
    expect(parseSort("unknown-desc")).toEqual(DEFAULT_SORT);
  });
});
