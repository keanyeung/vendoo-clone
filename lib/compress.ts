// Browser-only image compression utilities.

export const DEFAULT_MAX_EDGE = 1600;
export const DEFAULT_QUALITY = 0.85;

export type CompressImageOptions = {
  maxEdge?: number;
  quality?: number;
};

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<Blob> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    throw new Error(
      "The browser could not decode this image. Its format may be unsupported; HEIC images are a common cause.",
    );
  }

  const scale = Math.min(
    1,
    maxEdge / Math.max(bitmap.width, bitmap.height),
  );
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  try {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(
        "The browser could not create a canvas context to process the image.",
      );
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  } finally {
    bitmap.close();
  }

  const encodedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob: Blob | null): void => {
        if (!blob) {
          reject(
            new Error("The browser could not encode the processed image."),
          );
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });

  // Re-encoding an already-small PNG as JPEG can produce a bigger file.
  if (scale === 1 && encodedBlob.size > file.size) {
    return file;
  }

  return encodedBlob;
}
