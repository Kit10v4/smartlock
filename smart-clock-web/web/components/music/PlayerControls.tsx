"use client";

type Props = {
  onPlay: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function PlayerControls({ onPlay, onStop, onPrev, onNext }: Props) {
  return (
    <div className="row">
      <button onClick={onPrev}>⏮ Prev</button>
      <button className="primary" onClick={onPlay}>
        ▶ Play
      </button>
      <button onClick={onStop}>⏸ Stop</button>
      <button onClick={onNext}>⏭ Next</button>
    </div>
  );
}
