"use client";

import StatusIndicator from "@/components/layout/StatusIndicator";
import ClockDisplay from "@/components/dashboard/ClockDisplay";
import WeatherMini from "@/components/dashboard/WeatherMini";
import QuickControls from "@/components/dashboard/QuickControls";
import { useSocket } from "@/hooks/useSocket";

export default function DashboardPage() {
  const { connected, deviceInfo, deviceStatus, send } = useSocket();

  return (
    <main className="container">
      <h1 className="title">Dashboard</h1>
      <StatusIndicator online={connected && deviceStatus.online} info={deviceInfo} />

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <ClockDisplay />
        <WeatherMini />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div>
          Current page: <strong>{deviceStatus.page ?? 0}</strong> • Source: <strong>{deviceStatus.source || "-"}</strong>
        </div>
        <div>
          Playing: <strong>{deviceStatus.playing ? "Yes" : "No"}</strong> • Volume:{" "}
          <strong>{deviceStatus.vol ?? 10}</strong>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <QuickControls
          onPlay={() => send({ type: "play" })}
          onStop={() => send({ type: "stop" })}
          onPrev={() => send({ type: "prev" })}
          onNext={() => send({ type: "next" })}
          onPage={(page) => send({ type: "page", page })}
        />
      </div>
    </main>
  );
}
