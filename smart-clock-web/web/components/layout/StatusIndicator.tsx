"use client";

import type { DeviceInfo } from "@/lib/types";

type Props = {
  online: boolean;
  info?: DeviceInfo;
};

export default function StatusIndicator({ online, info }: Props) {
  return (
    <div className="row">
      <span className={`pill ${online ? "ok" : "off"}`}>{online ? "ESP32 Online" : "ESP32 Offline"}</span>
      {info?.ip && <span className="muted">IP: {info.ip}</span>}
      {info?.version && <span className="muted">FW: {info.version}</span>}
    </div>
  );
}
