export const ESP32_MAX_WIDTH = 320;
export const ESP32_MAX_HEIGHT = 218;

const DEFAULT_CHUNK_BYTES = 4096;
const parsedChunkBytes = Number(process.env.NEXT_PUBLIC_ESP32_IMAGE_CHUNK_BYTES || DEFAULT_CHUNK_BYTES);
export const ESP32_IMAGE_CHUNK_BYTES =
  Number.isFinite(parsedChunkBytes) && parsedChunkBytes >= 512
    ? Math.floor(parsedChunkBytes)
    : DEFAULT_CHUNK_BYTES;

const DEFAULT_CHUNK_DELAY_MS = 8;
const parsedChunkDelay = Number(process.env.NEXT_PUBLIC_ESP32_IMAGE_CHUNK_DELAY_MS || DEFAULT_CHUNK_DELAY_MS);
export const ESP32_IMAGE_CHUNK_DELAY_MS =
  Number.isFinite(parsedChunkDelay) && parsedChunkDelay >= 0
    ? Math.floor(parsedChunkDelay)
    : DEFAULT_CHUNK_DELAY_MS;

function getTargetSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid source image size");
  }
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio))
  };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cannot decode image in browser"));
    };
    img.src = objectUrl;
  });
}

export function rgbaToRGB565Pixels(imageData: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const expectedRgbaBytes = width * height * 4;
  if (imageData.length !== expectedRgbaBytes) {
    throw new Error(`Unexpected RGBA buffer size: got ${imageData.length}, expected ${expectedRgbaBytes}`);
  }

  const pixels = new Uint8Array(width * height * 2);
  let out = 0;
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    pixels[out] = (rgb565 >> 8) & 0xff;
    pixels[out + 1] = rgb565 & 0xff;
    out += 2;
  }
  return pixels;
}

export async function resizeAndConvertToRGB565(
  file: File,
  maxWidth = ESP32_MAX_WIDTH,
  maxHeight = ESP32_MAX_HEIGHT
) {
  const img = await loadImageFromFile(file);
  const target = getTargetSize(img.width, img.height, maxWidth, maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas context is unavailable");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, target.width, target.height);

  const rgba = ctx.getImageData(0, 0, target.width, target.height).data;
  const pixels = rgbaToRGB565Pixels(rgba, target.width, target.height);

  return {
    width: target.width,
    height: target.height,
    pixels,
    totalBytes: pixels.byteLength,
    sourceWidth: img.width,
    sourceHeight: img.height
  };
}
