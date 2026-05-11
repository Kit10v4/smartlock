"use client";

import { useEffect, useState } from "react";

export default function ClockDisplay() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="card">
      <div className="muted">Local Time</div>
      <div style={{ fontSize: 36, fontWeight: 700 }} suppressHydrationWarning>
        {now ? now.toLocaleTimeString() : "--:--:--"}
      </div>
      <div className="muted" suppressHydrationWarning>
        {now ? now.toLocaleDateString() : "--/--/----"}
      </div>
    </div>
  );
}
