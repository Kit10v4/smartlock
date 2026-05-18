import { resizeAndConvertToRGB565 } from "@/lib/imageUtils";
import { getSocket } from "@/lib/socket";

const LOG_PREFIX = "[image-transfer]";

type Ack = { ok?: boolean; message?: string; width?: number; height?: number; totalBytes?: number; chunkBytes?: number };

export async function sendImageFileToDevice(file: File) {
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
      totalBytes: result.totalBytes
    });

    const socket = getSocket();
    const ack = await new Promise<Ack>((resolve) => {
      socket.emit(
        "to_device_image",
        {
          width: result.width,
          height: result.height,
          pixels: result.pixels.buffer.slice(
            result.pixels.byteOffset,
            result.pixels.byteOffset + result.pixels.byteLength
          )
        },
        (response: Ack) => resolve(response || { ok: false, message: "No ACK" })
      );
    });

    if (!ack.ok) {
      throw new Error(ack.message || "ESP32 relay failed");
    }

    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(`${LOG_PREFIX} send success`, {
      width: ack.width,
      height: ack.height,
      totalBytes: ack.totalBytes,
      chunkBytes: ack.chunkBytes,
      elapsedMs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image transfer error";
    console.error(`${LOG_PREFIX} failed`, { message });
    throw new Error(`Image transfer failed: ${message}`);
  }
}
