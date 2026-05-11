"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Station } from "@/lib/types";

type Props = {
  onCommand: (payload: unknown) => void;
};

export default function RadioTab({ onCommand }: Props) {
  const [stations, setStations] = useState<Station[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  async function loadStations() {
    const data = (await api.getStations()) as Station[];
    setStations(data);
  }

  useEffect(() => {
    loadStations().catch((e: Error) => setMessage(e.message));
  }, []);

  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <input placeholder="Station name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Stream URL" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
          <button
            className="primary"
            onClick={() =>
              api
                .saveStation({ name, url })
                .then(() => {
                  setName("");
                  setUrl("");
                  loadStations();
                })
                .catch((e: Error) => setMessage(e.message))
            }
          >
            Add
          </button>
        </div>
      </div>

      {message && <div style={{ color: "var(--error)" }}>{message}</div>}

      {stations.map((station, index) => (
        <div key={station.id} className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>{station.name}</strong>
            <div className="muted">{station.url}</div>
          </div>
          <div className="row">
            <button onClick={() => onCommand({ type: "station", index })}>▶</button>
            <button
              className="danger"
              onClick={() =>
                api
                  .deleteStation(station.id)
                  .then(() => loadStations())
                  .catch((e: Error) => setMessage(e.message))
              }
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
