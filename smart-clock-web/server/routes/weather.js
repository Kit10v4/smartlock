const express = require("express");

module.exports = function weatherRoutes({ weatherService, store, sendToDevice }) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    try {
      const city = store.get("settings.city", process.env.DEFAULT_CITY || "Ho Chi Minh");
      const weather = await weatherService.getWeather(city);
      sendToDevice({
        type: "weather",
        temp: weather.temp,
        humidity: weather.humidity,
        wind: weather.wind,
        desc: weather.desc,
        icon: weather.icon
      });
      res.json(weather);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to get weather" });
    }
  });

  router.post("/city", async (req, res) => {
    const city = String(req.body?.city || "").trim();
    if (!city) {
      res.status(400).json({ error: "city is required" });
      return;
    }
    store.set("settings.city", city);
    try {
      const weather = await weatherService.getWeather(city);
      sendToDevice({
        type: "weather",
        temp: weather.temp,
        humidity: weather.humidity,
        wind: weather.wind,
        desc: weather.desc,
        icon: weather.icon
      });
      res.json(weather);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to update city weather" });
    }
  });

  return router;
};
