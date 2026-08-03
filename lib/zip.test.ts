import { describe, expect, it } from "vitest";

import { buildZip, crc32, type ZipEntry } from "./zip";

const MODIFIED_AT = new Date(2026, 7, 3, 14, 30, 20);

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Minimal reader used only by these tests. It walks the central directory the
 * way a real unzip tool does, so a mistake in our offsets or sizes surfaces
 * here rather than as a corrupt download.
 */
function readZip(archive: Uint8Array): { name: string; data: Uint8Array }[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();

  const endOffset = archive.length - 22;
  expect(view.getUint32(endOffset, true)).toBe(0x06054b50);

  const entryCount = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryStart = view.getUint32(endOffset + 16, true);
  // The declared directory size must land exactly on the end record. Real
  // unzip tools check this and refuse an archive that disagrees.
  expect(directoryStart + directorySize).toBe(endOffset);

  let cursor = directoryStart;
  const entries: { name: string; data: Uint8Array }[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const storedCrc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = archive.subarray(dataStart, dataStart + size);

    expect(crc32(data)).toBe(storedCrc);
    entries.push({ name, data });
    cursor += 46 + nameLength;
  }

  return entries;
}

describe("crc32", () => {
  it("matches the reference check value", () => {
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
  });

  it("is zero for empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("buildZip", () => {
  it("round-trips names and bytes through the central directory", () => {
    const entries: ZipEntry[] = [
      { name: "Patagonia fleece/1-cover.jpg", data: bytes("first photo bytes") },
      { name: "Patagonia fleece/2.png", data: bytes("second") },
    ];

    expect(readZip(buildZip(entries, MODIFIED_AT))).toEqual([
      { name: "Patagonia fleece/1-cover.jpg", data: bytes("first photo bytes") },
      { name: "Patagonia fleece/2.png", data: bytes("second") },
    ]);
  });

  it("preserves non-ASCII names, which rely on the UTF-8 flag", () => {
    const archive = buildZip(
      [{ name: "Café jacket/1.jpg", data: bytes("x") }],
      MODIFIED_AT,
    );

    expect(readZip(archive)[0].name).toBe("Café jacket/1.jpg");
  });

  it("writes a readable archive with no entries", () => {
    expect(readZip(buildZip([], MODIFIED_AT))).toEqual([]);
  });

  it("keeps binary bytes intact", () => {
    const binary = new Uint8Array([0, 255, 128, 13, 10, 26, 7]);
    const archive = buildZip([{ name: "a/1.jpg", data: binary }], MODIFIED_AT);

    expect(readZip(archive)[0].data).toEqual(binary);
  });
});
