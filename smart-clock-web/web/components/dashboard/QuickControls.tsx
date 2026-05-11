"use client";

type Props = {
  onPlay: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onPage: (page: number) => void;
};

export default function QuickControls({ onPlay, onStop, onNext, onPrev, onPage }: Props) {
  return (
    <div className="card">
      <h3 className="title">Quick Controls</h3>
      <div className="row">
        <button className="primary" onClick={onPlay}>
          ▶ Play
        </button>
        <button onClick={onStop}>⏸ Stop</button>
        <button onClick={onPrev}>⏮ Prev</button>
        <button onClick={onNext}>⏭ Next</button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={() => onPage(0)}>Clock</button>
        <button onClick={() => onPage(1)}>Radio</button>
        <button onClick={() => onPage(2)}>Weather</button>
        <button onClick={() => onPage(3)}>GIF</button>
      </div>
    </div>
  );
}
