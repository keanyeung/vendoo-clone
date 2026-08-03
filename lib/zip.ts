// A minimal ZIP writer, enough to hand the browser a folder of photos.
//
// Entries are stored uncompressed (method 0). Photos are already-compressed
// JPEG/PNG/WebP, so deflating them would cost CPU and save almost nothing, and
// storing lets this stay dependency-free. Sizes are written as 32-bit fields,
// which is sound here because an item caps out at MAX_FILES photos of
// MAX_FILE_BYTES each - orders of magnitude below the 4 GiB ZIP64 threshold.

export type ZipEntry = {
  /** Path inside the archive, e.g. "Patagonia fleece/01.jpg". */
  name: string;
  data: Uint8Array;
};

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION_STORED = 20;
// Bit 11 tells the reader that names are UTF-8 rather than the legacy code page.
const FLAG_UTF8_NAMES = 0x0800;
const METHOD_STORED = 0;

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed time and date, the only timestamp a base ZIP header carries. */
function dosTimestamp(modifiedAt: Date): { time: number; date: number } {
  const year = Math.max(1980, modifiedAt.getFullYear());
  const time =
    (modifiedAt.getHours() << 11) |
    (modifiedAt.getMinutes() << 5) |
    (modifiedAt.getSeconds() >>> 1);
  const date =
    ((year - 1980) << 9) |
    ((modifiedAt.getMonth() + 1) << 5) |
    modifiedAt.getDate();
  return { time, date };
}

// The ArrayBuffer type argument is explicit because callers hand the result to
// Blob, which does not accept a possibly-shared buffer.
export function buildZip(
  entries: ZipEntry[],
  modifiedAt: Date,
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, date } = dosTimestamp(modifiedAt);

  const prepared = entries.map((entry: ZipEntry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }));

  const localSize = prepared.reduce(
    (total, entry): number => total + 30 + entry.nameBytes.length + entry.data.length,
    0,
  );
  const centralSize = prepared.reduce(
    (total, entry): number => total + 46 + entry.nameBytes.length,
    0,
  );

  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let offset = 0;

  function writeU16(value: number): void {
    view.setUint16(offset, value, true);
    offset += 2;
  }

  function writeU32(value: number): void {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  }

  function writeBytes(bytes: Uint8Array): void {
    output.set(bytes, offset);
    offset += bytes.length;
  }

  const localOffsets: number[] = [];

  for (const entry of prepared) {
    localOffsets.push(offset);
    writeU32(LOCAL_HEADER_SIGNATURE);
    writeU16(VERSION_STORED);
    writeU16(FLAG_UTF8_NAMES);
    writeU16(METHOD_STORED);
    writeU16(time);
    writeU16(date);
    writeU32(entry.crc);
    writeU32(entry.data.length);
    writeU32(entry.data.length);
    writeU16(entry.nameBytes.length);
    writeU16(0);
    writeBytes(entry.nameBytes);
    writeBytes(entry.data);
  }

  const centralStart = offset;

  for (const [index, entry] of prepared.entries()) {
    writeU32(CENTRAL_HEADER_SIGNATURE);
    writeU16(VERSION_STORED);
    writeU16(VERSION_STORED);
    writeU16(FLAG_UTF8_NAMES);
    writeU16(METHOD_STORED);
    writeU16(time);
    writeU16(date);
    writeU32(entry.crc);
    writeU32(entry.data.length);
    writeU32(entry.data.length);
    writeU16(entry.nameBytes.length);
    writeU16(0);
    writeU16(0);
    writeU16(0);
    writeU16(0);
    writeU32(0);
    writeU32(localOffsets[index]);
    writeBytes(entry.nameBytes);
  }

  // Captured before the end-of-directory record is written, because the write
  // helpers advance `offset` as they go.
  const centralDirectorySize = offset - centralStart;

  writeU32(END_OF_DIRECTORY_SIGNATURE);
  writeU16(0);
  writeU16(0);
  writeU16(prepared.length);
  writeU16(prepared.length);
  writeU32(centralDirectorySize);
  writeU32(centralStart);
  writeU16(0);

  return output;
}
