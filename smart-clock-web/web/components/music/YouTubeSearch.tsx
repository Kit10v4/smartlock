"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type SearchItem = {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  url: string;
};

type Props = {
  onPlay: (url: string) => void;
};

export default function YouTubeSearch({ onPlay }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState("");

  async function onSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = (await api.youtubeSearch(query)) as SearchItem[];
      setResults(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <input
          placeholder="Search YouTube..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="primary" onClick={onSearch}>
          Search
        </button>
      </div>
      {loading && <div className="muted" style={{ marginTop: 10 }}>Searching...</div>}
      {error && <div style={{ color: "var(--error)", marginTop: 10 }}>{error}</div>}
      <div className="grid" style={{ marginTop: 10 }}>
        {results.map((item) => (
          <div key={item.id} className="row card" style={{ justifyContent: "space-between" }}>
            <div className="row">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} width={72} height={40} />
              ) : (
                <div style={{ width: 72, height: 40, background: "var(--card-hover)" }} />
              )}
              <div>
                <strong>{item.title}</strong>
                <div className="muted">{item.channel}</div>
              </div>
            </div>
            <button onClick={() => onPlay(item.url)}>▶ Play</button>
          </div>
        ))}
      </div>
    </div>
  );
}
