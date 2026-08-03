import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  upsertPosting: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: mocks.isAuthenticated,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    item: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    itemPosting: { upsert: mocks.upsertPosting },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/item-cleanup", () => ({
  cleanupUnreferencedItemPhotos: vi.fn(),
}));
vi.mock("@/lib/item-schema", () => ({
  CreateItemSchema: { safeParse: vi.fn() },
  formatZodIssues: () => "Invalid item mutation.",
  ItemMutationSchema: {
    safeParse: (body: unknown) => ({ success: true as const, data: body }),
  },
}));
vi.mock("@/lib/photos", () => ({
  getRemovedPhotoUrls: vi.fn(() => []),
  isAppPhotoUrl: vi.fn(() => true),
}));
vi.mock("@/lib/storage", () => ({ deletePhoto: vi.fn() }));

import { PATCH } from "./route";

function requestContext(id = "item-1") {
  return {
    params: Promise.resolve({ id }),
  } as RouteContext<"/api/items/[id]">;
}

function markSoldRequest(): Request {
  return new Request("http://localhost/api/items/item-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "mark_sold",
      data: {
        soldPrice: 65,
        soldPlatform: "EBAY",
        soldDate: "2026-08-02",
        platformFees: 8.61,
        shippingCost: 12,
      },
    }),
  });
}

describe("PATCH /api/items/[id] mark_sold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated.mockResolvedValue(true);
    mocks.update.mockResolvedValue({ id: "item-1" });
    mocks.upsertPosting.mockResolvedValue({ id: "posting-1" });
    mocks.transaction.mockImplementation(
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );
  });

  it.each(["DRAFT", "LISTED"] as const)(
    "records a %s sale and its marketplace posting atomically",
    async (status) => {
      mocks.findUnique.mockResolvedValue({ status });

      const response = await PATCH(markSoldRequest(), requestContext());

      expect(response.status).toBe(200);
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          soldPrice: 65,
          soldPlatform: "EBAY",
          soldDate: new Date("2026-08-02"),
          platformFees: 8.61,
          shippingCost: 12,
          status: "SOLD",
        },
        select: { id: true },
      });
      expect(mocks.upsertPosting).toHaveBeenCalledWith({
        where: {
          itemId_platform: { itemId: "item-1", platform: "EBAY" },
        },
        create: { itemId: "item-1", platform: "EBAY" },
        update: { postedAt: expect.any(Date), removedAt: null },
      });
      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      expect(mocks.transaction.mock.calls[0]?.[0]).toHaveLength(2);
    },
  );

  it("keeps the existing conflict for an already-sold item", async () => {
    mocks.findUnique.mockResolvedValue({ status: "SOLD" });

    const response = await PATCH(markSoldRequest(), requestContext());

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.upsertPosting).not.toHaveBeenCalled();
  });
});
