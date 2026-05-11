"use client";

import { useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { usePlayer } from "@/hooks/usePlayer";
import PlayerControls from "@/components/music/PlayerControls";
import VolumeSlider from "@/components/music/VolumeSlider";
import RadioTab from "@/components/music/RadioTab";
import YouTubeTab from "@/components/music/YouTubeTab";
import LibraryTab from "@/components/music/LibraryTab";

type Tab = "radio" | "youtube" | "library";

export default function MusicPage() {
  const [tab, setTab] = useState<Tab>("radio");
  const { send } = useSocket();
  const { nowPlaying, controls } = usePlayer();

  return (
    <main className="container">
      <h1 className="title">Music</h1>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <PlayerControls onPlay={controls.play} onStop={controls.stop} onPrev={controls.prev} onNext={controls.next} />
          <VolumeSlider value={nowPlaying.volume} onCommit={controls.volume} />
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "radio" ? "active" : ""} onClick={() => setTab("radio")}>
          Radio
        </button>
        <button className={tab === "youtube" ? "active" : ""} onClick={() => setTab("youtube")}>
          YouTube
        </button>
        <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>
          Library
        </button>
      </div>

      {tab === "radio" && <RadioTab onCommand={send} />}
      {tab === "youtube" && <YouTubeTab />}
      {tab === "library" && <LibraryTab />}
    </main>
  );
}
