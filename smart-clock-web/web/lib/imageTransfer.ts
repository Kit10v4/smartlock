import { resizeAndConvertToRGB565 } from "@/lib/imageUtils";

type SendBinary = (buffer: ArrayBuffer) => void;

const LOG_PREFIX = "[image-transfer]";

export async function sendImageFileToDevice(file: File, sendBinary: SendBinary) {
  const startedAt = performance.now();
  console.info(`${LOG_PREFIX} start`, {
    name: file.name,
    type: file.type,
    bytes: file.size
  });

  try {
    const result = await resizeAndConvertToRGB565(file);
    const expectedPacketBytes = 4 + result.width * result.height * 2;

    console.info(`${LOG_PREFIX} conversion complete`, {
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      width: result.width,
      height: result.height,
      packetBytes: result.packet.byteLength,
      expectedPacketBytes,
      maxPacketBytes: result.maxPacketBytes,
      effectivePacketBytes: result.effectivePacketBytes
    });

    if (result.packet.byteLength !== expectedPacketBytes) {
      throw new Error(
        `Invalid packet size: got ${result.packet.byteLength}, expected ${expectedPacketBytes}`
      );
    }

    sendBinary(result.packet.buffer.slice(0) as ArrayBuffer);

    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(`${LOG_PREFIX} send success`, {
      width: result.width,
      height: result.height,
      packetBytes: result.packet.byteLength,
      elapsedMs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown image transfer error";
    console.error(`${LOG_PREFIX} failed`, { message });
    throw new Error(`Image transfer failed: ${message}`);
  }
}

