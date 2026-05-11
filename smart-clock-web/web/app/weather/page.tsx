"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import WeatherCard from "@/components/weather/WeatherCard";

type Weather = {
  city: string;
  temp: number;
  humidity: number;
  wind: number;
  desc: string;
  icon?: string;
};

export default function WeatherPage() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const data = (await api.getWeather()) as Weather;
    setWeather(data);
    setCity(data.city);
  }

  useEffect(() => {
    load().catch((e: Error) => setMessage(e.message));
  }, []);

  return (
    <main className="container">
      <h1 className="title">Weather</h1>
      <div className="card row">
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        <button
          className="primary"
          onClick={() =>
            api
              .setCity(city)
              .then((result) => setWeather(result as Weather))
              .catch((e: Error) => setMessage(e.message))
          }
        >
          Update City
        </button>
      </div>
      {message && <div style={{ color: "var(--error)", marginTop: 10 }}>{message}</div>}
      {weather && (
        <div style={{ marginTop: 12 }}>
          <WeatherCard {...weather} />
        </div>
      )}
    </main>
  );
}
