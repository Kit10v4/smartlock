"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

type Settings = {
  brightness: number;
  blinkColon: boolean;
  ampm: boolean;
  format24h: boolean;
  theme: string;
  city: string;
};

const defaultSettings: Settings = {
  brightness: 180,
  blinkColon: true,
  ampm: false,
  format24h: true,
  theme: "cyan",
  city: "Ho Chi Minh"
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [message, setMessage] = useState("");
  const { send } = useSocket();

  useEffect(() => {
    api
      .getSettings()
      .then((data) => setSettings((prev) => ({ ...prev, ...(data as Partial<Settings>) })))
      .catch((e: Error) => setMessage(e.message));
  }, []);

  return (
    <main className="container">
      <h1 className="title">Settings</h1>

      <div className="card grid">
        <label>
          Brightness: {settings.brightness}
          <input
            type="range"
            min={0}
            max={255}
            value={settings.brightness}
            onChange={(e) => setSettings({ ...settings, brightness: Number(e.target.value) })}
          />
        </label>

        <label className="row">
          <input
            type="checkbox"
            checked={settings.blinkColon}
            onChange={(e) => setSettings({ ...settings, blinkColon: e.target.checked })}
          />
          Blink colon
        </label>
        <label className="row">
          <input type="checkbox" checked={settings.ampm} onChange={(e) => setSettings({ ...settings, ampm: e.target.checked })} />
          Show AM/PM
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.format24h}
            onChange={(e) => setSettings({ ...settings, format24h: e.target.checked })}
          />
          24h format
        </label>

        <label>
          Theme
          <select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })}>
            <option value="cyan">Cyan</option>
            <option value="orange">Orange</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <div className="row">
          <button
            className="primary"
            onClick={() =>
              api
                .saveSettings(settings)
                .then(() => {
                  setMessage("Settings saved");
                  send({ type: "set_brightness", value: settings.brightness });
                })
                .catch((e: Error) => setMessage(e.message))
            }
          >
            Save
          </button>
          <button onClick={() => send({ type: "set_time", timestamp: Math.floor(Date.now() / 1000) })}>Sync time now</button>
          <button className="danger" onClick={() => send({ type: "restart" })}>
            Restart ESP32
          </button>
        </div>
      </div>

      {message && <div className="muted" style={{ marginTop: 10 }}>{message}</div>}
    </main>
  );
}
