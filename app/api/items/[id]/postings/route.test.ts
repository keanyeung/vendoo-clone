import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: mocks.isAuthenticated,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    item: { findUnique: mocks.findUnique },
    itemPosting: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("@/lib/item-schema", () => {
  const parse = (body: unknown) => ({ success: true as const, data: body });
  return {
    formatZodIssues: () => "Invalid posting.",
    UpsertItemPostingSchema: { safeParse: parse },
    RemoveItemPostingSchema: { safeParse: parse },
  };
});
vi.mock("@/lib/item-dto", () => ({
  toItemPostingDto: (posting: {
    postedAt: Date;
    removedAt: Date | null;
  }) => ({
    ...posting,
    postedAt: posting.postedAt.toISOString(),
    removedAt: posting.removedAt?.toISOString() ?? null,
  }),
}));

import { DELETE, POST } from "./route";

function requestContext(id = "item-1") {
  return {
    params: Promise.resolve({ id }),
  } as RouteContext<"/api/items/[id]/postings">;
}

function jsonRequest(method: "POST" | "DELETE", body: unknown): Request {
  return new Request("http://localhost/api/items/item-1/postings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/items/[id]/postings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated.mockResolvedValue(true);
    mocks.findUnique.mockResolvedValue({ id: "item-1" });
  });

  it("uses one upsert key when the same platform is posted repeatedly", async () => {
    const posting = {
      id: "posting-1",
      itemId: "item-1",
      platform: "EBAY",
      postedAt: new Date("2026-08-02T12:00:00.000Z"),
      url: "https://www.ebay.com/itm/123",
      removedAt: null,
    };
    mocks.upsert.mockResolvedValue(posting);

    const first = await POST(
      jsonRequest("POST", {
        platform: "EBAY",
        url: "https://www.ebay.com/itm/123",
      }),
      requestContext(),
    );
    const second = await POST(
      jsonRequest("POST", { platform: "EBAY" }),
      requestContext(),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenLastCalledWith({
      where: {
        itemId_platform: { itemId: "item-1", platform: "EBAY" },
      },
      create: { itemId: "item-1", platform: "EBAY", url: null },
      update: { postedAt: expect.any(Date), removedAt: null },
    });
  });

  it("marks an existing posting removed and treats a missing posting as a no-op", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    const removed = await DELETE(
      jsonRequest("DELETE", { platform: "DEPOP" }),
      requestContext(),
    );
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    const missing = await DELETE(
      jsonRequest("DELETE", { platform: "DEPOP" }),
      requestContext(),
    );

    expect(await removed.json()).toEqual({ removed: true });
    expect(await missing.json()).toEqual({ removed: false });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { itemId: "item-1", platform: "DEPOP" },
      data: { removedAt: expect.any(Date) },
    });
  });

  it("returns 404 for either verb when the item is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const postResponse = await POST(
      jsonRequest("POST", { platform: "EBAY" }),
      requestContext("missing"),
    );
    const deleteResponse = await DELETE(
      jsonRequest("DELETE", { platform: "EBAY" }),
      requestContext("missing"),
    );

    expect(postResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
