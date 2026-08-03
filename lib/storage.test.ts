import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  list: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/upload-limits", () => ({
  ALLOWED_MIME_TYPES: { "image/jpeg": "jpg" },
  MAX_FILE_BYTES: 1,
  MAX_FILES: 1,
  isAllowedMimeType: vi.fn(),
}));
vi.mock("@/lib/photos", () => ({
  getAppPhotoObjectPath: vi.fn(),
}));

import { listStoredPhotos } from "./storage";

function file(name: string, createdAt = "2026-07-31T12:00:00.000Z") {
  return {
    name,
    id: `id-${name}`,
    created_at: createdAt,
  };
}

describe("listStoredPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("SUPABASE_STORAGE_BUCKET", "item-photos");

    const bucketClient = {
      list: mocks.list,
      getPublicUrl: mocks.getPublicUrl,
    };
    mocks.from.mockReturnValue(bucketClient);
    mocks.createClient.mockReturnValue({ storage: { from: mocks.from } });
    mocks.getPublicUrl.mockImplementation((objectPath: string) => ({
      data: {
        publicUrl: `https://project.supabase.co/storage/v1/object/public/item-photos/${objectPath}`,
      },
    }));
  });

  it("recursively lists folders and paginates every object in the bucket", async () => {
    const firstPage = [
      {
        name: "nested",
        id: null,
        created_at: null,
      },
      ...Array.from({ length: 99 }, (_, index) =>
        file(`root-${index}.jpg`),
      ),
    ];

    mocks.list.mockImplementation(
      async (prefix: string, options: { offset: number }) => {
        if (prefix === "" && options.offset === 0) {
          return { data: firstPage, error: null };
        }
        if (prefix === "" && options.offset === 100) {
          return { data: [file("last-root.jpg")], error: null };
        }
        if (prefix === "nested" && options.offset === 0) {
          return { data: [file("inside.jpg")], error: null };
        }
        return { data: [], error: null };
      },
    );

    const result = await listStoredPhotos();

    expect(result).toHaveLength(101);
    expect(result).toContainEqual({
      objectPath: "nested/inside.jpg",
      publicUrl:
        "https://project.supabase.co/storage/v1/object/public/item-photos/nested/inside.jpg",
      createdAt: "2026-07-31T12:00:00.000Z",
    });
    expect(result.at(-1)?.objectPath).toBe("last-root.jpg");
    expect(mocks.list).toHaveBeenCalledWith("", {
      limit: 100,
      offset: 100,
      sortBy: { column: "name", order: "asc" },
    });
  });
});
