"use client";

import { ReactNode } from "react";
import NavBar from "./NavBar";
import NowPlayingBar from "./NowPlayingBar";
import { usePlayer } from "@/hooks/usePlayer";

type Props = {
  children: ReactNode;
};

export default function AppShell({ children }: Props) {
  const { nowPlaying, controls } = usePlayer();

  return (
    <div className="app-shell">
      <NavBar />
      {children}
      <NowPlayingBar
        title={nowPlaying.title}
        source={nowPlaying.source}
        volume={nowPlaying.volume}
        playing={nowPlaying.playing}
        onPlay={controls.play}
        onStop={controls.stop}
        onPrev={controls.prev}
        onNext={controls.next}
      />
    </div>
  );
}
