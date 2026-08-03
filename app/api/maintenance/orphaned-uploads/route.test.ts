import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  sweepOrphanedUploads: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: mocks.isAuthenticated,
}));
vi.mock("@/lib/orphaned-uploads", () => ({
  sweepOrphanedUploads: mocks.sweepOrphanedUploads,
}));

import { POST } from "./route";

const sweepResult = {
  dryRun: true,
  scanned: 3,
  orphaned: 1,
  deleted: 0,
  failed: 0,
};

function request(body?: string): Request {
  return new Request(
    "http://localhost/api/maintenance/orphaned-uploads",
    {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body,
    },
  );
}

describe("POST /api/maintenance/orphaned-uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated.mockResolvedValue(true);
    mocks.sweepOrphanedUploads.mockResolvedValue(sweepResult);
  });

  it("rejects unauthenticated maintenance requests", async () => {
    mocks.isAuthenticated.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.sweepOrphanedUploads).not.toHaveBeenCalled();
  });

  it("defaults an empty request to a dry run", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sweepResult);
    expect(mocks.sweepOrphanedUploads).toHaveBeenCalledWith({
      deleteOrphans: false,
    });
  });

  it("only enables deletion for an explicit boolean true flag", async () => {
    await POST(request(JSON.stringify({ delete: true })));

    expect(mocks.sweepOrphanedUploads).toHaveBeenCalledWith({
      deleteOrphans: true,
    });
  });

  it.each(["not-json", JSON.stringify({ delete: "yes" })])(
    "rejects an invalid destructive flag: %s",
    async (body) => {
      const response = await POST(request(body));

      expect(response.status).toBe(400);
      expect(mocks.sweepOrphanedUploads).not.toHaveBeenCalled();
    },
  );

  it("returns a server error when inventory cannot be completed", async () => {
    mocks.sweepOrphanedUploads.mockRejectedValue(
      new Error("Supabase photo listing failed: unavailable"),
    );

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Supabase photo listing failed: unavailable",
    });
  });
});
