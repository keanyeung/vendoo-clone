import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: mocks.isAuthenticated,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    item: {
      findUnique: mocks.findUnique,
      create: mocks.create,
    },
  },
}));
vi.mock("@/lib/item-schema", () => ({
  buildDuplicateTitle: (title: string) => `${title} (copy)`,
}));

import { POST } from "./route";

function requestContext(id = "source-item") {
  return {
    params: Promise.resolve({ id }),
  } as RouteContext<"/api/items/[id]/duplicate">;
}

describe("POST /api/items/[id]/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated.mockResolvedValue(true);
  });

  it("returns 404 when the source item does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/items/missing/duplicate", {
        method: "POST",
      }),
      requestContext("missing"),
    );

    expect(response.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("copies listing data into a reviewed draft without sale or sourcing data", async () => {
    const photos = ["https://example.com/one.jpg"];
    mocks.findUnique.mockResolvedValue({
      photos,
      title: "Vintage denim jacket",
      summary: "Vintage jacket",
      description: "A vintage denim jacket.",
      brand: "Levi's",
      category: "Jacket",
      size: "Men's Medium",
      color: "Blue",
      condition: "good",
      conditionNotes: "Light wear.",
      suggestedPrice: 80,
      priceLow: 65,
      priceHigh: 95,
      priceReasoning: "Comparable sales.",
      listPrice: 80,
      purchasePrice: 15,
      keywords: ["vintage", "denim"],
      aiConfidence: "high",
      soldPrice: 70,
      soldPlatform: "EBAY",
      soldDate: new Date(),
      platformFees: 9,
      purchaseDate: new Date(),
      notes: "Do not copy",
    });
    mocks.create.mockResolvedValue({ id: "duplicate-item" });

    const response = await POST(
      new Request("http://localhost/api/items/source-item/duplicate", {
        method: "POST",
      }),
      requestContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ id: "duplicate-item" });
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        photos,
        title: "Vintage denim jacket (copy)",
        summary: "Vintage jacket",
        description: "A vintage denim jacket.",
        brand: "Levi's",
        category: "Jacket",
        size: "Men's Medium",
        color: "Blue",
        condition: "good",
        conditionNotes: "Light wear.",
        suggestedPrice: 80,
        priceLow: 65,
        priceHigh: 95,
        priceReasoning: "Comparable sales.",
        listPrice: 80,
        purchasePrice: 15,
        keywords: ["vintage", "denim"],
        aiConfidence: "high",
        status: "DRAFT",
        draftStep: "reviewed",
      },
      select: { id: true },
    });
  });
});
