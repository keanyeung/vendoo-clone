import { describe, expect, it } from "vitest";

import {
  archiveFolderName,
  buildPhotoArchive,
  FALLBACK_ARCHIVE_NAME,
  photoEntryName,
  photoExtension,
  photoFileName,
} from "./photo-archive";

const MODIFIED_AT = new Date(2026, 7, 3, 14, 30, 20);

function photoUrl(name: string): string {
  return `https://project.supabase.co/storage/v1/object/public/item-photos/${name}`;
}

describe("archiveFolderName", () => {
  it("keeps a normal title as written", () => {
    expect(archiveFolderName("Patagonia Better Sweater")).toBe(
      "Patagonia Better Sweater",
    );
  });

  it("keeps spaces and hyphens, which are legal filename characters", () => {
    expect(archiveFolderName("Nike Air-Max 90")).toBe("Nike Air-Max 90");
  });

  it("blanks characters the filesystem reserves", () => {
    expect(archiveFolderName('Levi\'s 501 <32/34> "raw"')).toBe(
      "Levi's 501 32 34 raw",
    );
  });

  it("collapses the whitespace left behind by stripping", () => {
    expect(archiveFolderName("A///B")).toBe("A B");
  });

  it("drops trailing dots and spaces that Windows would discard", () => {
    expect(archiveFolderName("Vintage tee...  ")).toBe("Vintage tee");
  });

  it("falls back when nothing usable survives", () => {
    expect(archiveFolderName("")).toBe(FALLBACK_ARCHIVE_NAME);
    expect(archiveFolderName("///")).toBe(FALLBACK_ARCHIVE_NAME);
    expect(archiveFolderName("   ")).toBe(FALLBACK_ARCHIVE_NAME);
  });

  it("escapes reserved Windows device names", () => {
    expect(archiveFolderName("CON")).toBe(`CON-${FALLBACK_ARCHIVE_NAME}`);
    expect(archiveFolderName("lpt1")).toBe(`lpt1-${FALLBACK_ARCHIVE_NAME}`);
  });

  it("caps very long titles without leaving a trailing space", () => {
    const name = archiveFolderName(`${"a".repeat(79)}   tail`);

    expect(name.length).toBeLessThanOrEqual(80);
    expect(name).toBe("a".repeat(79));
  });
});

describe("photoExtension", () => {
  it("reads the extension from a storage URL", () => {
    expect(photoExtension(photoUrl("abc.png"))).toBe("png");
    expect(photoExtension(photoUrl("abc.WEBP"))).toBe("webp");
  });

  it("ignores query strings and fragments", () => {
    expect(photoExtension(`${photoUrl("abc.jpg")}?width=800`)).toBe("jpg");
  });

  it("defaults to jpg when the extension is missing or unknown", () => {
    expect(photoExtension(photoUrl("abc"))).toBe("jpg");
    expect(photoExtension(photoUrl("abc.exe"))).toBe("jpg");
  });
});

describe("photoEntryName", () => {
  it("marks the first photo as the cover", () => {
    expect(photoEntryName(photoUrl("a.jpg"), 0, 3)).toBe("1-cover.jpg");
    expect(photoEntryName(photoUrl("b.jpg"), 1, 3)).toBe("2.jpg");
  });

  it("zero-pads so file browsers sort the photos in listing order", () => {
    expect(photoEntryName(photoUrl("a.jpg"), 0, 12)).toBe("01-cover.jpg");
    expect(photoEntryName(photoUrl("j.jpg"), 9, 12)).toBe("10.jpg");
  });
});

describe("photoFileName", () => {
  it("carries the listing name, since a lone photo has no folder", () => {
    expect(photoFileName("Patagonia fleece", photoUrl("a.jpg"), 0, 3)).toBe(
      "Patagonia fleece 1-cover.jpg",
    );
    expect(photoFileName("Patagonia fleece", photoUrl("b.png"), 1, 3)).toBe(
      "Patagonia fleece 2.png",
    );
  });

  it("sanitises the title the same way the folder name is sanitised", () => {
    expect(photoFileName("Levi's 501 <32/34>", photoUrl("a.jpg"), 1, 2)).toBe(
      "Levi's 501 32 34 2.jpg",
    );
  });

  it("falls back for an untitled listing", () => {
    expect(photoFileName("", photoUrl("a.jpg"), 0, 1)).toBe(
      `${FALLBACK_ARCHIVE_NAME} 1-cover.jpg`,
    );
  });
});

describe("buildPhotoArchive", () => {
  it("names the archive after the listing and nests the photos in that folder", () => {
    const archive = buildPhotoArchive(
      "Patagonia fleece",
      [
        { url: photoUrl("a.jpg"), data: new Uint8Array([1, 2, 3]) },
        { url: photoUrl("b.png"), data: new Uint8Array([4, 5]) },
      ],
      MODIFIED_AT,
    );

    expect(archive.filename).toBe("Patagonia fleece.zip");

    const text = new TextDecoder().decode(archive.bytes);
    expect(text).toContain("Patagonia fleece/1-cover.jpg");
    expect(text).toContain("Patagonia fleece/2.png");
  });

  it("uses the fallback name for an untitled draft", () => {
    const archive = buildPhotoArchive(
      "",
      [{ url: photoUrl("a.jpg"), data: new Uint8Array([1]) }],
      MODIFIED_AT,
    );

    expect(archive.filename).toBe(`${FALLBACK_ARCHIVE_NAME}.zip`);
  });
});
