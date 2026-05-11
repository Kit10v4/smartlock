"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import YouTubeSearch from "./YouTubeSearch";

type Props = {
  onPlayDone?: (title: string) => void;
};

export default function YouTubeTab({ onPlayDone }: Props) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function play(rawUrl: string) {
    if (!rawUrl.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      const result = (await api.youtubePlay(rawUrl)) as { title: string };
      setMessage(`Playing: ${result.title}`);
      onPlayDone?.(result.title);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL..."
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={() => play(url)} disabled={loading}>
            {loading ? "Processing..." : "Play"}
          </button>
        </div>
        {message && <div className="muted" style={{ marginTop: 10 }}>{message}</div>}
      </div>
      <YouTubeSearch onPlay={play} />
    </div>
  );
}
