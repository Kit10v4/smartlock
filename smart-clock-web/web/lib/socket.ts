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

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = resolveSocketUrl();
    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity
    });
    if (typeof window !== "undefined") {
      console.info("[socket] connecting", { socketUrl });
    }
  }
  return socket;
}
