const { WebSocket } = require("ws");

function broadcastStatus(io, state) {
  io.emit("device_status", {
    info: state.deviceInfo,
    status: state.deviceStatus,
    lastAck: state.lastAck
  });
}

module.exports = function createWsHandler({ io, state, queueManager, sendToDevice }) {
  return function handleDeviceConnection(ws, req) {
    state.deviceSocket = ws;
    state.deviceStatus = {
      ...state.deviceStatus,
      online: true,
      updatedAt: new Date().toISOString()
    };
    state.deviceInfo = {
      ip: req.socket.remoteAddress
    };
    broadcastStatus(io, state);

    ws.on("message", (raw, isBinary) => {
      if (isBinary) {
        io.emit("device_binary", raw);
        return;
      }

      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        io.emit("device_error", { message: "Invalid JSON from ESP32" });
        return;
      }

      if (payload.type === "hello") {
        state.deviceInfo = payload;
      }
      if (payload.type === "status" || payload.type === "heartbeat") {
        state.deviceStatus = {
          ...state.deviceStatus,
          ...payload,
          online: true,
          updatedAt: new Date().toISOString()
        };
      }
      if (payload.type === "ack") {
        state.lastAck = payload;
      }
      if (payload.type === "track_end") {
        const nextTrack = queueManager.onTrackEnd();
        if (nextTrack) {
          sendToDevice({
            type: "play_url",
            url: nextTrack.url,
            title: nextTrack.title,
            source: nextTrack.source || "queue"
          });
        }
      }

      io.emit("device_message", payload);
      broadcastStatus(io, state);
    });

    ws.on("close", () => {
      if (state.deviceSocket === ws) {
        state.deviceSocket = null;
      }
      state.deviceStatus = {
        ...state.deviceStatus,
        online: false,
        updatedAt: new Date().toISOString()
      };
      broadcastStatus(io, state);
    });

    ws.on("error", () => {
      state.deviceStatus = {
        ...state.deviceStatus,
        online: false,
        updatedAt: new Date().toISOString()
      };
      broadcastStatus(io, state);
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "notify", text: "Server connected" }));
    }
  };
};
