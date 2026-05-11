"use client";

type Props = {
  title: string;
  source: string;
  volume: number;
  playing: boolean;
  onPrev: () => void;
  onPlay: () => void;
  onStop: () => void;
  onNext: () => void;
};

export default function NowPlayingBar({ title, source, volume, playing, onPrev, onPlay, onStop, onNext }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        padding: "10px 14px",
        background: "rgba(24,24,38,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.08)"
      }}
    >
      <div className="container row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{playing ? "Now Playing" : "Player Idle"}</div>
          <div className="muted">
            {title} • {source} • Vol {volume}
          </div>
        </div>
        <div className="row">
          <button onClick={onPrev}>⏮</button>
          <button className="primary" onClick={onPlay}>
            ▶
          </button>
          <button onClick={onStop}>⏸</button>
          <button onClick={onNext}>⏭</button>
        </div>
      </div>
    </div>
  );
}
