"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "./useSocket";

type NowPlaying = {
  title: string;
  source: string;
  playing: boolean;
  volume: number;
};

const defaultNowPlaying: NowPlaying = {
  title: "Nothing is playing",
  source: "-",
  playing: false,
  volume: 10
};

export function usePlayer() {
  const { deviceStatus, lastMessage, send } = useSocket();
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(defaultNowPlaying);

  useEffect(() => {
    if (deviceStatus.title || deviceStatus.station) {
      setNowPlaying((prev) => ({
        ...prev,
        title: deviceStatus.title || deviceStatus.station || prev.title,
        source: deviceStatus.source || prev.source,
        playing: Boolean(deviceStatus.playing),
        volume: Number(deviceStatus.vol ?? prev.volume)
      }));
    }
  }, [deviceStatus]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "status") {
      setNowPlaying((prev) => ({
        ...prev,
        title: String(lastMessage.title || lastMessage.station || prev.title),
        source: String(lastMessage.source || prev.source),
        playing: Boolean(lastMessage.playing ?? prev.playing),
        volume: Number(lastMessage.vol ?? prev.volume)
      }));
    }
  }, [lastMessage]);

  const controls = useMemo(
    () => ({
      play: () => send({ type: "play" }),
      stop: () => send({ type: "stop" }),
      next: () => send({ type: "next" }),
      prev: () => send({ type: "prev" }),
      volume: (value: number) => send({ type: "volume", value })
    }),
    [send]
  );

  return {
    nowPlaying,
    controls
  };
}
