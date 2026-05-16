module.exports = function createSocketHandler({ io, state, sendToDevice, queueManager }) {
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
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      console.log(`[Binary] Nhan ${buf.length} bytes tu web, relay xuong ESP32`);
      const success = sendToDevice(buf, true);
      console.log(`[Binary] Ket qua relay: ${success}`);
      if (!success) {
        callback?.({ ok: false, message: "ESP32 is offline" });
        return;
      }
      callback?.({ ok: true });
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
