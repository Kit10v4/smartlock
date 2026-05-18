function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gửi pixel dưới dạng JSON text + base64 chunks.
// Lý do: WebSocketsClient của Markus Sattler có giới hạn binary frame 15KB không sửa được
// từ sketch (define không lan tới library .cpp). JSON text thì hoạt động ổn định ở mọi size.
const CHUNK_RAW_BYTES = 4 * 1024;       // 4KB raw → ~5.5KB base64 → ~5.6KB JSON (< 15KB limit)
const CHUNK_DELAY_MS = 25;

async function sendImageChunkedToDevice(sendToDevice, width, height, pixelBuffer) {
  const total = pixelBuffer.length;
  if (!sendToDevice({ type: "image_begin", w: width, h: height, total })) {
    return { ok: false, reason: "offline" };
  }
  await sleep(60);
  let seq = 0;
  for (let off = 0; off < total; off += CHUNK_RAW_BYTES) {
    const slice = pixelBuffer.subarray(off, Math.min(off + CHUNK_RAW_BYTES, total));
    const b64 = slice.toString("base64");
    if (!sendToDevice({ type: "img_chunk", seq, data: b64 })) return { ok: false, reason: "offline" };
    seq += 1;
    await sleep(CHUNK_DELAY_MS);
  }
  await sleep(40);
  if (!sendToDevice({ type: "image_end" })) return { ok: false, reason: "offline" };
  return { ok: true, total, chunkBytes: CHUNK_RAW_BYTES };
}

module.exports = {
  sendImageChunkedToDevice
};
