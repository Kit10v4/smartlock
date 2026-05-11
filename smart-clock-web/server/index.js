const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const { WebSocketServer, WebSocket } = require("ws");

const createStore = require("./services/storage");
const createWeatherService = require("./services/weatherService");
const createYouTubeService = require("./services/youtubeService");
const createWsHandler = require("./services/wsHandler");
const createSocketHandler = require("./services/socketHandler");
const queueManager = require("./services/queueManager");
const state = require("./services/runtimeState");

dotenv.config();

const port = Number(process.env.PORT || 10000);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.WEB_ORIGIN || "*",
    credentials: true
  }
});

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const store = createStore(path.join(__dirname, "data", "db.json"));
const weatherService = createWeatherService();
const youtubeService = createYouTubeService();

function sendToDevice(payload, binary = false) {
  if (!state.deviceSocket || state.deviceSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  if (binary) {
    state.deviceSocket.send(payload);
    return true;
  }

  state.deviceSocket.send(JSON.stringify(payload));
  return true;
}

app.use(
  cors({
    origin: process.env.WEB_ORIGIN || "*",
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadsDir));

const routeDeps = {
  io,
  store,
  state,
  queueManager,
  weatherService,
  youtubeService,
  sendToDevice
};

app.use("/api/status", require("./routes/status")(routeDeps));
app.use("/api/stations", require("./routes/stations")(routeDeps));
app.use("/api/youtube", require("./routes/youtube")(routeDeps));
app.use("/api/playlist", require("./routes/playlist")(routeDeps));
app.use("/api/upload", require("./routes/upload")(routeDeps, uploadsDir));
app.use("/api/weather", require("./routes/weather")(routeDeps));
app.use("/api/gallery", require("./routes/gallery")(routeDeps, uploadsDir));
app.use("/api/settings", require("./routes/settings")(routeDeps));

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const wsServer = new WebSocketServer({ noServer: true });
wsServer.on("connection", createWsHandler({ io, state, queueManager, sendToDevice }));

server.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/ws")) {
    socket.destroy();
    return;
  }
  wsServer.handleUpgrade(req, socket, head, (ws) => {
    wsServer.emit("connection", ws, req);
  });
});

io.on("connection", createSocketHandler({ io, state, sendToDevice, queueManager }));

server.listen(port, () => {
  console.log(`Smart Clock server listening on :${port}`);
});
