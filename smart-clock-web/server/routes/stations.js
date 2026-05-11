const express = require("express");
const { randomUUID } = require("crypto");

module.exports = function stationRoutes({ store }) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.json(store.get("stations", []));
  });

  router.post("/", (req, res) => {
    const { name, url, genre = "" } = req.body || {};
    if (!name || !url) {
      res.status(400).json({ error: "name and url are required" });
      return;
    }
    const station = { id: randomUUID(), name, url, genre };
    store.push("stations", station);
    res.status(201).json(station);
  });

  router.put("/:id", (req, res) => {
    const stations = store.get("stations", []);
    const idx = stations.findIndex((item) => item.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: "station not found" });
      return;
    }
    stations[idx] = { ...stations[idx], ...req.body };
    store.set("stations", stations);
    res.json(stations[idx]);
  });

  router.delete("/:id", (req, res) => {
    const before = store.get("stations", []);
    const after = before.filter((item) => item.id !== req.params.id);
    if (after.length === before.length) {
      res.status(404).json({ error: "station not found" });
      return;
    }
    store.set("stations", after);
    res.status(204).send();
  });

  return router;
};
