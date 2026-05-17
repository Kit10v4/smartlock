"use client";

import type { DeviceInfo } from "@/lib/types";

type Props = {
  serverConnected: boolean;
  online: boolean;
  info?: DeviceInfo;
  error?: string | null;
};

export default function StatusIndicator({ serverConnected, online, info, error }: Props) {
  const statusClass = !serverConnected ? "off" : online ? "ok" : "off";
  const statusText = !serverConnected
    ? "Server Disconnected"
    : online
      ? "ESP32 Online"
      : "ESP32 Offline";

  return (
    <div className="row">
      <span className={`pill ${statusClass}`}>{statusText}</span>
      {info?.ip && <span className="muted">IP: {info.ip}</span>}
      {info?.version && <span className="muted">FW: {info.version}</span>}
      {error && <span className="muted">Socket: {error}</span>}
    </div>
  );
}
