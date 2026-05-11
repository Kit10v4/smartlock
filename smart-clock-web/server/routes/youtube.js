const express = require("express");
const { randomUUID } = require("crypto");

module.exports = function youtubeRoutes({ youtubeService, sendToDevice, store }) {
  const router = express.Router();

  router.post("/play", async (req, res) => {
    const { url } = req.body || {};
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    try {
      const [audioUrl, info] = await Promise.all([
        youtubeService.getAudioURL(url),
        youtubeService.getVideoInfo(url)
      ]);

      const payload = {
        type: "play_url",
        url: audioUrl,
        title: info.title,
        source: "youtube"
      };

      const sent = sendToDevice(payload);
      if (!sent) {
        res.status(503).json({ error: "ESP32 is offline", ...info, audioUrl });
        return;
      }

      const history = store.get("youtubeHistory", []);
      const item = {
        id: randomUUID(),
        ...info,
        audioUrl,
        playedAt: new Date().toISOString()
      };
      history.unshift(item);
      store.set("youtubeHistory", history.slice(0, 200));

      res.json({ ...info, audioUrl });
    } catch (error) {
      res.status(500).json({ error: error.message || "YouTube processing failed" });
    }
  });

  router.get("/search", async (req, res) => {
    const query = String(req.query.q || "").trim();
    const maxResults = Number(req.query.limit || 10);
    if (!query) {
      res.status(400).json({ error: "query q is required" });
      return;
    }

    try {
      const items = await youtubeService.searchYouTube(query, Math.min(20, Math.max(1, maxResults)));
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message || "Search failed" });
    }
  });

  router.get("/history", (_req, res) => {
    res.json(store.get("youtubeHistory", []));
  });

  return router;
};
