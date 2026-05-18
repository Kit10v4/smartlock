function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gửi ảnh dưới dạng MỘT WebSocket binary frame nguyên cục.
// ESP32 firmware đã được define WEBSOCKETS_MAX_DATA_SIZE = 160KB để nhận được frame lớn.
async function sendImageChunkedToDevice(sendToDevice, width, height, pixelBuffer) {
  const total = pixelBuffer.length;
  if (!sendToDevice({ type: "image_begin", w: width, h: height, total })) {
    return { ok: false, reason: "offline" };
  }
  // Cho ESP32 chút thời gian alloc PSRAM buffer trước khi binary frame tới.
  await sleep(60);
  if (!sendToDevice(pixelBuffer, true)) return { ok: false, reason: "offline" };
  await sleep(20);
  if (!sendToDevice({ type: "image_end" })) return { ok: false, reason: "offline" };
  return { ok: true, total, chunkBytes: total };
}

module.exports = {
  sendImageChunkedToDevice
};
