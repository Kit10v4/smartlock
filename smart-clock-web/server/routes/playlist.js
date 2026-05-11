const express = require("express");
const { randomUUID } = require("crypto");

module.exports = function playlistRoutes({ store, sendToDevice, queueManager }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json(store.get("playlist", []));
  });

  router.post("/", (req, res) => {
    const payload = req.body || {};
    if (!payload.url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const track = {
      id: randomUUID(),
      title: payload.title || "Untitled",
      artist: payload.artist || "Unknown",
      duration: Number(payload.duration || 0),
      url: payload.url,
      source: payload.source || "upload",
      createdAt: new Date().toISOString()
    };
    store.push("playlist", track);
    res.status(201).json(track);
  });

  router.put("/:id", (req, res) => {
    const playlist = store.get("playlist", []);
    const idx = playlist.findIndex((item) => item.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: "track not found" });
      return;
    }
    playlist[idx] = { ...playlist[idx], ...req.body };
    store.set("playlist", playlist);
    res.json(playlist[idx]);
  });

  router.delete("/:id", (req, res) => {
    const before = store.get("playlist", []);
    const after = before.filter((item) => item.id !== req.params.id);
    if (after.length === before.length) {
      res.status(404).json({ error: "track not found" });
      return;
    }
    store.set("playlist", after);
    res.status(204).send();
  });

  router.post("/:id/play", (req, res) => {
    const track = store.get("playlist", []).find((item) => item.id === req.params.id);
    if (!track) {
      res.status(404).json({ error: "track not found" });
      return;
    }

    const sent = sendToDevice({
      type: "play_url",
      url: track.url,
      title: track.title,
      source: track.source || "upload"
    });
    if (!sent) {
      res.status(503).json({ error: "ESP32 is offline" });
      return;
    }

    res.json({ ok: true, track });
  });

  router.post("/queue", (req, res) => {
    const body = req.body || {};
    const tracks = Array.isArray(body.tracks) && body.tracks.length > 0 ? body.tracks : store.get("playlist", []);

    if (tracks.length === 0) {
      res.status(400).json({ error: "queue is empty" });
      return;
    }

    queueManager.setQueue(tracks);
    const first = queueManager.getCurrentTrack();
    const sent = sendToDevice({
      type: "play_url",
      url: first.url,
      title: first.title,
      source: first.source || "queue"
    });

    if (!sent) {
      res.status(503).json({ error: "ESP32 is offline", queue: queueManager.queue });
      return;
    }
    res.json({ ok: true, queue: queueManager.queue });
  });

  return router;
};
