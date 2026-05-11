const axios = require("axios");

module.exports = function createWeatherService() {
  const cache = new Map();
  const ttlMs = 15 * 60 * 1000;

  async function getWeather(city) {
    const key = String(city || "Ho Chi Minh").toLowerCase().trim();
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.value;
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      const fallback = {
        city: city || "Ho Chi Minh",
        temp: 30,
        humidity: 70,
        wind: 2.1,
        desc: "Clear sky",
        icon: "01d",
        updatedAt: new Date().toISOString(),
        mock: true
      };
      cache.set(key, { value: fallback, timestamp: now });
      return fallback;
    }

    const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        q: city,
        appid: apiKey,
        units: "metric",
        lang: "en"
      },
      timeout: 15000
    });

    const payload = {
      city: response.data.name,
      temp: response.data.main.temp,
      humidity: response.data.main.humidity,
      wind: response.data.wind.speed,
      desc: response.data.weather?.[0]?.description || "",
      icon: response.data.weather?.[0]?.icon || "",
      updatedAt: new Date().toISOString(),
      mock: false
    };

    cache.set(key, { value: payload, timestamp: now });
    return payload;
  }

  return { getWeather };
};
