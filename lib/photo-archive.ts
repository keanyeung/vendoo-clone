import { buildZip, type ZipEntry } from "./zip";

export const FALLBACK_ARCHIVE_NAME = "listing-photos";

// Windows rejects these outright, and they break paths on the other platforms
// too. Spaces and hyphens are legal everywhere and are deliberately kept, so a
// title like "Nike Air-Max" survives as written.
const RESERVED_CHARACTERS = new Set<string>([
  "<",
  ">",
  ":",
  '"',
  "/",
  "\\",
  "|",
  "?",
  "*",
]);
// Bare device names are unusable as folders on Windows regardless of extension.
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_NAME_LENGTH = 80;

function isControlCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f;
}

/** Replace anything a filesystem would reject with a space, to be collapsed. */
function blankUnsafeCharacters(title: string): string {
  let result = "";
  for (const character of title) {
    result +=
      RESERVED_CHARACTERS.has(character) || isControlCharacter(character)
        ? " "
        : character;
  }
  return result;
}

/**
 * Turn a listing title into a folder name that is safe on Windows, macOS, and
 * Linux. Falls back to a fixed name when nothing usable survives, so an
 * untitled draft still downloads.
 */
export function archiveFolderName(title: string): string {
  const cleaned = blankUnsafeCharacters(title)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    // Trailing dots and spaces are silently dropped by Windows Explorer, and
    // slicing to the length cap can expose a new one.
    .replace(/[. ]+$/, "");

  if (cleaned === "") return FALLBACK_ARCHIVE_NAME;
  return RESERVED_WINDOWS_NAMES.test(cleaned)
    ? `${cleaned}-${FALLBACK_ARCHIVE_NAME}`
    : cleaned;
}

const KNOWN_EXTENSIONS = new Set<string>([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
]);

/** Recover a photo's extension from its storage URL, defaulting to jpg. */
export function photoExtension(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0];
  const lastSegment = withoutQuery.slice(withoutQuery.lastIndexOf("/") + 1);
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex === -1) return "jpg";

  const extension = lastSegment.slice(dotIndex + 1).toLowerCase();
  return KNOWN_EXTENSIONS.has(extension) ? extension : "jpg";
}

/**
 * Numbered name for one photo inside the archive. Photos are zero-padded so the
 * cover sorts first in every file browser, and the listing's own order is kept.
 */
export function photoEntryName(
  url: string,
  index: number,
  total: number,
): string {
  const width = String(total).length;
  const position = String(index + 1).padStart(width, "0");
  const suffix = index === 0 ? "-cover" : "";
  return `${position}${suffix}.${photoExtension(url)}`;
}

export type PhotoArchive = {
  filename: string;
  bytes: Uint8Array<ArrayBuffer>;
};

/**
 * Pack downloaded photo bytes into a single archive. The files sit inside a
 * folder named after the listing, so extracting anywhere produces that folder
 * rather than scattering loose images into the user's Downloads directory.
 */
export function buildPhotoArchive(
  title: string,
  photos: { url: string; data: Uint8Array }[],
  modifiedAt: Date,
): PhotoArchive {
  const folder = archiveFolderName(title);
  const entries: ZipEntry[] = photos.map(
    (photo, index): ZipEntry => ({
      name: `${folder}/${photoEntryName(photo.url, index, photos.length)}`,
      data: photo.data,
    }),
  );

  return { filename: `${folder}.zip`, bytes: buildZip(entries, modifiedAt) };
}
