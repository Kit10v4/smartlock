const express = require("express");

module.exports = function statusRoutes({ state, store }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json({
      online: state.deviceStatus.online,
      info: state.deviceInfo,
      status: state.deviceStatus,
      lastAck: state.lastAck,
      counts: {
        stations: store.get("stations", []).length,
        playlist: store.get("playlist", []).length,
        gallery: store.get("gallery", []).length,
        youtubeHistory: store.get("youtubeHistory", []).length
      }
    });
  });

  return router;
};
