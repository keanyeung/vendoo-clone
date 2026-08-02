import { describe, expect, it } from "vitest";

import {
  buildListingQuery,
  buildListingsHref,
  carryListingContext,
  parseListingContext,
} from "./listing-context";

describe("listing context", () => {
  it("normalizes the four supported listing parameters", () => {
    expect(
      parseListingContext({
        status: "LISTED",
        q: "  wool coat  ",
        sort: "oldest",
        view: "table",
        ignored: "value",
      }),
    ).toEqual({
      status: "LISTED",
      q: "wool coat",
      sort: "added-asc",
      view: "table",
    });
  });

  it("parses a context carried by one from parameter", () => {
    expect(
      parseListingContext({
        saved: "1",
        from: "status=LISTED&q=linen+shirt&sort=days-desc&view=table",
      }),
    ).toEqual({
      status: "LISTED",
      q: "linen shirt",
      sort: "days-desc",
      view: "table",
    });
    expect(
      buildListingsHref({
        saved: "1",
        from: "status=LISTED&q=linen+shirt&sort=days-desc&view=table",
      }),
    ).toBe(
      "/listings?status=LISTED&q=linen+shirt&sort=days-desc&view=table",
    );
  });

  it("builds a compact, canonical listings href", () => {
    expect(
      buildListingsHref({
        status: "LISTED",
        q: "linen shirt",
        sort: "days-desc",
        view: "grid",
      }),
    ).toBe("/listings?status=LISTED&q=linen+shirt&sort=days-desc");

    expect(
      buildListingsHref({
        status: "",
        q: "",
        sort: "newest",
        view: "grid",
      }),
    ).toBe("/listings");
  });

  it("carries the listings query as exactly one readable parameter", () => {
    expect(
      carryListingContext("/listings/item-1", {
        status: "LISTED",
        q: "",
        sort: "days-desc",
        view: "grid",
      }),
    ).toBe(
      "/listings/item-1?from=status%3DLISTED%26sort%3Ddays-desc",
    );
  });

  it("builds the shared database filter and sort token", () => {
    expect(
      buildListingQuery({
        from: "status=SOLD&q=boots&sort=soldDate-asc&view=table",
      }),
    ).toEqual({
      status: "SOLD",
      q: "boots",
      sort: "soldDate-asc",
      view: "table",
      sortToken: { field: "soldDate", dir: "asc" },
      where: {
        status: "SOLD",
        OR: [
          { title: { contains: "boots", mode: "insensitive" } },
          { brand: { contains: "boots", mode: "insensitive" } },
          { category: { contains: "boots", mode: "insensitive" } },
        ],
      },
    });
  });

  it("drops invalid values instead of carrying them", () => {
    expect(
      buildListingsHref({
        status: "ARCHIVED",
        q: "   ",
        sort: "not-a-sort",
        view: "cards",
      }),
    ).toBe("/listings");
  });
});
