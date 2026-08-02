import { describe, expect, it } from "vitest";

import { PAGE_SIZE, paginate, parsePage } from "./listing-page";

describe("listing pagination", () => {
  it("parses positive integer pages and clamps invalid input to page one", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("NaN")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("clamps low, negative, and NaN requested pages to page one", () => {
    const items = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => index);

    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -4).page).toBe(1);
    expect(paginate(items, Number.NaN).page).toBe(1);
  });

  it("clamps a high requested page to the last non-empty page", () => {
    const items = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => index);
    const result = paginate(items, 999);

    expect(result.page).toBe(2);
    expect(result.pageCount).toBe(2);
    expect(result.items).toEqual([PAGE_SIZE]);
  });

  it("does not add an empty page at an exact page-size multiple", () => {
    const items = Array.from({ length: PAGE_SIZE * 2 }, (_, index) => index);
    const result = paginate(items, 3);

    expect(result.page).toBe(2);
    expect(result.pageCount).toBe(2);
    expect(result.items).toHaveLength(PAGE_SIZE);
    expect(result.items[0]).toBe(PAGE_SIZE);
  });

  it("returns page one of one for an empty collection", () => {
    expect(paginate([], 8)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
    });
  });
});
