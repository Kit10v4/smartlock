module.exports = function createSocketHandler({ io, state, sendToDevice, queueManager }) {
  function normalizeBinaryPayload(data) {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }
    if (ArrayBuffer.isView(data)) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    if (data && typeof data === "object" && Array.isArray(data.data)) {
      return Buffer.from(data.data);
    }
    throw new Error("Unsupported binary payload type");
  }

  return function handleSocketConnection(socket) {
    socket.emit("bootstrap", {
      info: state.deviceInfo,
      status: state.deviceStatus,
      lastAck: state.lastAck
    });

    socket.on("to_device", (payload, callback) => {
      const success = sendToDevice(payload);
      if (!success) {
        callback?.({ ok: false, message: "ESP32 is offline" });
        return;
      }
      callback?.({ ok: true });
    });

    socket.on("to_device_binary", (data, callback) => {
      let buf;
      try {
        buf = normalizeBinaryPayload(data);
      } catch (error) {
        callback?.({ ok: false, message: error.message || "Invalid binary payload" });
        return;
      }

      console.log(`[Binary] Nhan ${buf.length} bytes tu web, relay xuong ESP32`);
      const success = sendToDevice(buf, true);
      console.log(`[Binary] Ket qua relay: ${success}`);
      if (!success) {
        callback?.({ ok: false, message: "ESP32 is offline" });
        return;
      }
      callback?.({ ok: true, bytes: buf.length });
    });

    socket.on("queue", (tracks) => {
      queueManager.setQueue(tracks);
      const first = queueManager.getCurrentTrack();
      if (first) {
        sendToDevice({
          type: "play_url",
          url: first.url,
          title: first.title,
          source: first.source || "queue"
        });
      }
      io.emit("queue_updated", { queue: queueManager.queue, currentIndex: queueManager.currentIndex });
    });

    socket.on("disconnect", () => {
      io.emit("web_client_disconnected", { id: socket.id });
    });
  };
};
