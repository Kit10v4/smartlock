"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Track } from "@/lib/types";
import TrackItem from "./TrackItem";
import MP3Uploader from "./MP3Uploader";

export default function LibraryTab() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const data = (await api.getPlaylist()) as Track[];
    setTracks(data);
  }

  useEffect(() => {
    load().catch((e: Error) => setMessage(e.message));
  }, []);

  return (
    <div className="grid">
      <MP3Uploader onDone={() => load().catch(() => null)} />
      {message && <div style={{ color: "var(--error)" }}>{message}</div>}
      {tracks.map((track) => (
        <TrackItem
          key={track.id}
          track={track}
          onPlay={(id) => api.playTrack(id).catch((e: Error) => setMessage(e.message))}
          onDelete={(id) =>
            api
              .deleteTrack(id)
              .then(() => load())
              .catch((e: Error) => setMessage(e.message))
          }
        />
      ))}
      {tracks.length > 0 && (
        <button className="primary" onClick={() => api.queuePlaylist().catch((e: Error) => setMessage(e.message))}>
          Play Queue
        </button>
      )}
    </div>
  );
}
