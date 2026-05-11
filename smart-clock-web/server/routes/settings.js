const express = require("express");

module.exports = function settingsRoutes({ store, sendToDevice }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json(store.get("settings", {}));
  });

  router.put("/", (req, res) => {
    const current = store.get("settings", {});
    const next = { ...current, ...(req.body || {}) };
    store.set("settings", next);

    if (typeof req.body?.brightness === "number") {
      sendToDevice({ type: "set_brightness", value: req.body.brightness });
    }
    if (req.body?.timestamp) {
      sendToDevice({ type: "set_time", timestamp: req.body.timestamp });
    }
    if (req.body?.restart === true) {
      sendToDevice({ type: "restart" });
    }

    res.json(next);
  });

  return router;
};
