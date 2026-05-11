"use client";

import type { Track } from "@/lib/types";

type Props = {
  track: Track;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function TrackItem({ track, onPlay, onDelete }: Props) {
  return (
    <div className="card row" style={{ justifyContent: "space-between" }}>
      <div>
        <strong>{track.title}</strong>
        <div className="muted">
          {track.artist || "Unknown"} • {track.source || "upload"}
        </div>
      </div>
      <div className="row">
        <button onClick={() => onPlay(track.id)}>▶</button>
        <button className="danger" onClick={() => onDelete(track.id)}>
          🗑
        </button>
      </div>
    </div>
  );
}
