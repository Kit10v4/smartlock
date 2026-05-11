"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Weather = {
  city: string;
  temp: number;
  humidity: number;
  desc: string;
  wind: number;
};

export default function WeatherMini() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getWeather()
      .then((result) => setWeather(result as Weather))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="card">
      <div className="muted">Weather</div>
      {error && <div style={{ color: "var(--error)" }}>{error}</div>}
      {!weather && !error && <div className="muted">Loading...</div>}
      {weather && (
        <div>
          <strong>{weather.city}</strong>
          <div>
            {weather.temp}°C • {weather.desc}
          </div>
          <div className="muted">
            Humidity {weather.humidity}% • Wind {weather.wind}m/s
          </div>
        </div>
      )}
    </div>
  );
}
