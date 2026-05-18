function readPositiveInt(value, fallback, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  if (intVal < minimum) return fallback;
  return intVal;
}

const CHUNK_BYTES = readPositiveInt(process.env.ESP32_IMAGE_CHUNK_BYTES, 4096, 512);
const CHUNK_DELAY_MS = readPositiveInt(process.env.ESP32_IMAGE_CHUNK_DELAY_MS, 8, 0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendImageChunkedToDevice(sendToDevice, width, height, pixelBuffer) {
  const total = pixelBuffer.length;
  if (!sendToDevice({ type: "image_begin", w: width, h: height, total })) {
    return { ok: false, reason: "offline" };
  }
  await sleep(40);
  for (let off = 0; off < total; off += CHUNK_BYTES) {
    const slice = pixelBuffer.subarray(off, Math.min(off + CHUNK_BYTES, total));
    if (!sendToDevice(slice, true)) return { ok: false, reason: "offline" };
    if (CHUNK_DELAY_MS > 0) await sleep(CHUNK_DELAY_MS);
  }
  if (!sendToDevice({ type: "image_end" })) return { ok: false, reason: "offline" };
  return { ok: true, total, chunkBytes: CHUNK_BYTES };
}

module.exports = {
  sendImageChunkedToDevice,
  CHUNK_BYTES,
  CHUNK_DELAY_MS
};
