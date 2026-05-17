"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { DeviceInfo, DeviceStatus } from "@/lib/types";

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ online: false });
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({});
  const [lastMessage, setLastMessage] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setConnected(true);
      setSocketError(null);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onConnectError(error: Error) {
      setConnected(false);
      setSocketError(error.message || "Socket connection error");
      console.error("[socket] connect_error", error.message || error);
    }
    function onBootstrap(payload: { status?: DeviceStatus; info?: DeviceInfo }) {
      if (payload?.status) setDeviceStatus(payload.status);
      if (payload?.info) setDeviceInfo(payload.info);
    }
    function onDeviceStatus(payload: { status?: DeviceStatus; info?: DeviceInfo }) {
      if (payload?.status) setDeviceStatus(payload.status);
      if (payload?.info) setDeviceInfo(payload.info);
    }
    function onDeviceMessage(payload: Record<string, unknown>) {
      setLastMessage(payload);
      if (payload.type === "status" || payload.type === "heartbeat") {
        setDeviceStatus((prev) => ({ ...prev, ...payload } as DeviceStatus));
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("bootstrap", onBootstrap);
    socket.on("device_status", onDeviceStatus);
    socket.on("device_message", onDeviceMessage);

    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("bootstrap", onBootstrap);
      socket.off("device_status", onDeviceStatus);
      socket.off("device_message", onDeviceMessage);
    };
  }, []);

  function send(payload: unknown) {
    const socket = getSocket();
    socket.emit("to_device", payload);
  }

  function sendBinary(payload: ArrayBuffer) {
    const socket = getSocket();
    socket.emit(
      "to_device_binary",
      payload,
      (ack?: { ok?: boolean; message?: string; bytes?: number }) => {
        if (ack?.ok) {
          console.info("[socket] Binary relayed to device", { bytes: ack.bytes ?? payload.byteLength });
          return;
        }
        console.error("[socket] Binary relay failed", { message: ack?.message || "Unknown relay error" });
      }
    );
  }

  return {
    connected,
    socketError,
    deviceStatus,
    deviceInfo,
    lastMessage,
    send,
    sendBinary
  };
}
