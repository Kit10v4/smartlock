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

let warmupStarted = false;

function warmupServer(url: string) {
  if (warmupStarted || typeof window === "undefined") return;
  warmupStarted = true;
  // Wake up free-tier hosts (e.g. Render) that sleep after inactivity.
  // Cold starts can take 30–60s, longer than the socket handshake timeout.
  fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
    method: "GET",
    cache: "no-store",
    keepalive: true
  }).catch(() => {
    /* ignore — warmup is best-effort */
  });
}

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = resolveSocketUrl();
    warmupServer(socketUrl);
    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      timeout: 60000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000
    });
    if (typeof window !== "undefined") {
      console.info("[socket] connecting", { socketUrl });
    }
  }
  return socket;
}
