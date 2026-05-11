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

    socket.on("to_device_binary", (arrayBuffer, callback) => {
      const success = sendToDevice(arrayBuffer, true);
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
