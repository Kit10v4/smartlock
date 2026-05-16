export const ESP32_MAX_WIDTH = 160;
export const ESP32_MAX_HEIGHT = 120;

const DEFAULT_PACKET_LIMIT_BYTES = 15 * 1024;
const parsedPacketLimit = Number(process.env.NEXT_PUBLIC_ESP32_WS_SAFE_PACKET_BYTES || DEFAULT_PACKET_LIMIT_BYTES);

const DEFAULT_PACKET_SAFETY_RATIO = 0.8;
const parsedSafetyRatio = Number(
  process.env.NEXT_PUBLIC_ESP32_WS_PACKET_SAFETY_RATIO || DEFAULT_PACKET_SAFETY_RATIO
);

export const ESP32_WS_PACKET_SAFETY_RATIO =
  Number.isFinite(parsedSafetyRatio) && parsedSafetyRatio > 0 && parsedSafetyRatio <= 1
    ? parsedSafetyRatio
    : DEFAULT_PACKET_SAFETY_RATIO;

export const ESP32_WS_SAFE_PACKET_BYTES =
  Number.isFinite(parsedPacketLimit) && parsedPacketLimit > 512
    ? Math.floor(parsedPacketLimit)
    : DEFAULT_PACKET_LIMIT_BYTES;

const PROTOCOL_HEADER_BYTES = 4;
const RGB565_BYTES_PER_PIXEL = 2;

function getTargetSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
  maxPacketBytes: number
) {
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid source image size");
  }

  if (maxPacketBytes <= PROTOCOL_HEADER_BYTES) {
    throw new Error("Invalid packet byte limit");
  }

  const effectivePacketBytes = Math.max(
    512,
    Math.floor(maxPacketBytes * ESP32_WS_PACKET_SAFETY_RATIO)
  );

  const maxPixelsByPacket = Math.floor((effectivePacketBytes - PROTOCOL_HEADER_BYTES) / RGB565_BYTES_PER_PIXEL);
  if (maxPixelsByPacket <= 0) {
    throw new Error("Packet limit is too small for RGB565 payload");
  }

  const ratioByDimensions = Math.min(1, maxWidth / width, maxHeight / height);
  const ratioByPacket = Math.min(1, Math.sqrt(maxPixelsByPacket / (width * height)));
  const ratio = Math.min(ratioByDimensions, ratioByPacket);

  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
    effectivePacketBytes
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

export function rgbaToRGB565Packet(imageData: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const expectedRgbaBytes = width * height * 4;
  if (imageData.length !== expectedRgbaBytes) {
    throw new Error(`Unexpected RGBA buffer size: got ${imageData.length}, expected ${expectedRgbaBytes}`);
  }

  const packet = new Uint8Array(4 + width * height * 2);
  packet[0] = (width >> 8) & 0xff;
  packet[1] = width & 0xff;
  packet[2] = (height >> 8) & 0xff;
  packet[3] = height & 0xff;

  let out = 4;
  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];

    const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    packet[out] = (rgb565 >> 8) & 0xff;
    packet[out + 1] = rgb565 & 0xff;
    out += 2;
  }

  return packet;
}

export async function resizeAndConvertToRGB565(
  file: File,
  maxWidth = ESP32_MAX_WIDTH,
  maxHeight = ESP32_MAX_HEIGHT,
  maxPacketBytes = ESP32_WS_SAFE_PACKET_BYTES
) {
  const img = await loadImageFromFile(file);
  const target = getTargetSize(img.width, img.height, maxWidth, maxHeight, maxPacketBytes);

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
  const packet = rgbaToRGB565Packet(rgba, target.width, target.height);

  return {
    width: target.width,
    height: target.height,
    packet,
    packetBytes: packet.byteLength,
    sourceWidth: img.width,
    sourceHeight: img.height,
    maxPacketBytes,
    effectivePacketBytes: target.effectivePacketBytes
  };
}
