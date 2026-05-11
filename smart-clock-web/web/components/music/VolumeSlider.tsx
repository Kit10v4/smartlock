"use client";

import { useState } from "react";

type Props = {
  value: number;
  onCommit: (value: number) => void;
};

export default function VolumeSlider({ value, onCommit }: Props) {
  const [local, setLocal] = useState(value);

  return (
    <div className="row">
      <label htmlFor="volume">Volume</label>
      <input
        id="volume"
        type="range"
        min={0}
        max={21}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onMouseUp={() => onCommit(local)}
        onTouchEnd={() => onCommit(local)}
      />
      <strong>{local}</strong>
    </div>
  );
}
