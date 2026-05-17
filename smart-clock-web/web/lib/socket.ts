import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalhostEndpoint(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
}

function isBrowserHostedLocally() {
  if (typeof window === "undefined") {
    return false;
  }
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function resolveSocketUrl() {
  const explicitSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (explicitSocketUrl) {
    const normalized = normalizeBaseUrl(explicitSocketUrl);
    if (typeof window !== "undefined" && !isBrowserHostedLocally() && isLocalhostEndpoint(normalized)) {
      console.warn("[socket] ignoring localhost NEXT_PUBLIC_SOCKET_URL on remote host", {
        configured: normalized,
        browserHost: window.location.hostname
      });
    } else {
      return normalized;
    }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    const normalized = normalizeBaseUrl(apiUrl);
    if (typeof window !== "undefined" && !isBrowserHostedLocally() && isLocalhostEndpoint(normalized)) {
      console.warn("[socket] ignoring localhost NEXT_PUBLIC_API_URL on remote host", {
        configured: normalized,
        browserHost: window.location.hostname
      });
    } else {
      return normalized;
    }
  }

  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV === "development") {
      return "http://localhost:10000";
    }
    return window.location.origin;
  }

  return "http://localhost:10000";
}

let warmupPromise: Promise<void> | null = null;

function warmupServer(url: string): Promise<void> {
  if (warmupPromise) return warmupPromise;
  if (typeof window === "undefined") return Promise.resolve();
  // Free-tier hosts (Render) sleep after inactivity. Only HTTP requests wake them —
  // WebSocket upgrades do not. Poll /health until it responds (cold start: 30–90s).
  warmupPromise = (async () => {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}/health`, { method: "GET", cache: "no-store" });
        if (res.ok) return;
      } catch {
        /* server still waking up */
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  })();
  return warmupPromise;
}

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = resolveSocketUrl();
    // Polling first so the initial handshake is an HTTP request (which wakes Render),
    // then Socket.IO upgrades to websocket automatically.
    socket = io(socketUrl, {
      transports: ["polling", "websocket"],
      timeout: 60000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      autoConnect: false
    });
    if (typeof window !== "undefined") {
      console.info("[socket] warming up server", { socketUrl });
      warmupServer(socketUrl).finally(() => {
        console.info("[socket] connecting", { socketUrl });
        socket?.connect();
      });
    } else {
      socket.connect();
    }
  }
  return socket;
}
