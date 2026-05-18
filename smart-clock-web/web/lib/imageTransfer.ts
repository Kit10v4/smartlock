import {
  ESP32_IMAGE_CHUNK_BYTES,
  ESP32_IMAGE_CHUNK_DELAY_MS,
  resizeAndConvertToRGB565
} from "@/lib/imageUtils";

type SendJson = (payload: unknown) => void;
type SendBinary = (buffer: ArrayBuffer) => void;

const LOG_PREFIX = "[image-transfer]";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function sendImageFileToDevice(
  file: File,
  sendJson: SendJson,
  sendBinary: SendBinary
) {
  const startedAt = performance.now();
  console.info(`${LOG_PREFIX} start`, {
    name: file.name,
    type: file.type,
    bytes: file.size
  });

  try {
    const result = await resizeAndConvertToRGB565(file);
    console.info(`${LOG_PREFIX} conversion complete`, {
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      width: result.width,
      height: result.height,
      totalBytes: result.totalBytes,
      chunkBytes: ESP32_IMAGE_CHUNK_BYTES
    });

    sendJson({
      type: "image_begin",
      w: result.width,
      h: result.height,
      total: result.totalBytes
    });

    // Give ESP32 a beat to allocate its PSRAM buffer before chunks arrive.
    await sleep(60);

    const pixels = result.pixels;
    const chunkCount = Math.ceil(pixels.byteLength / ESP32_IMAGE_CHUNK_BYTES);
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * ESP32_IMAGE_CHUNK_BYTES;
      const end = Math.min(start + ESP32_IMAGE_CHUNK_BYTES, pixels.byteLength);
      const slice = pixels.slice(start, end);
      sendBinary(slice.buffer as ArrayBuffer);
      if (ESP32_IMAGE_CHUNK_DELAY_MS > 0 && i < chunkCount - 1) {
        await sleep(ESP32_IMAGE_CHUNK_DELAY_MS);
      }
    }

    sendJson({ type: "image_end" });

    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(`${LOG_PREFIX} send success`, {
      width: result.width,
      height: result.height,
      totalBytes: result.totalBytes,
      chunks: chunkCount,
      elapsedMs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image transfer error";
    console.error(`${LOG_PREFIX} failed`, { message });
    throw new Error(`Image transfer failed: ${message}`);
  }
}
