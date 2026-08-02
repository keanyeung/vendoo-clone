import { describe, expect, it } from "vitest";

import {
  buildListingQuery,
  buildListingsHref,
  carryListingContext,
  parseListingContext,
} from "./listing-context";

describe("listing context", () => {
  it("normalizes the six supported listing parameters", () => {
    expect(
      parseListingContext({
        status: "LISTED",
        q: "  wool coat  ",
        attention: "aging",
        sort: "oldest",
        view: "table",
        page: "3",
        ignored: "value",
      }),
    ).toEqual({
      status: "LISTED",
      q: "wool coat",
      attention: "aging",
      sort: "added-asc",
      view: "table",
      page: 3,
    });
  });

  it("parses a context carried by one from parameter", () => {
    expect(
      parseListingContext({
        saved: "1",
        from: "status=LISTED&q=linen+shirt&attention=aging&sort=days-desc&view=table&page=4",
      }),
    ).toEqual({
      status: "LISTED",
      q: "linen shirt",
      attention: "aging",
      sort: "days-desc",
      view: "table",
      page: 4,
    });
    expect(
      buildListingsHref({
        saved: "1",
        from: "status=LISTED&q=linen+shirt&attention=aging&sort=days-desc&view=table&page=4",
      }),
    ).toBe(
      "/listings?status=LISTED&q=linen+shirt&attention=aging&sort=days-desc&view=table&page=4",
    );
  });

  it("builds a compact, canonical listings href", () => {
    expect(buildListingsHref({ attention: "aging" })).toBe(
      "/listings?attention=aging",
    );

    expect(
      buildListingsHref({
        status: "LISTED",
        q: "linen shirt",
        attention: "missing-fees",
        sort: "days-desc",
        view: "grid",
        page: 2,
      }),
    ).toBe(
      "/listings?status=LISTED&q=linen+shirt&attention=missing-fees&sort=days-desc&page=2",
    );

    expect(
      buildListingsHref({
        status: "",
        q: "",
        attention: "",
        sort: "newest",
        view: "grid",
        page: 1,
      }),
    ).toBe("/listings");
  });

  it("carries the listings query as exactly one readable parameter", () => {
    expect(
      carryListingContext("/listings/item-1", {
        status: "LISTED",
        q: "",
        attention: "stale-drafts",
        sort: "days-desc",
        view: "grid",
        page: 4,
      }),
    ).toBe(
      "/listings/item-1?from=status%3DLISTED%26attention%3Dstale-drafts%26sort%3Ddays-desc%26page%3D4",
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
      attention: "",
      sort: "soldDate-asc",
      view: "table",
      page: 1,
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
        attention: "overdue",
        sort: "not-a-sort",
        view: "cards",
        page: "-7",
      }),
    ).toBe("/listings");
  });
});
