import { useEffect, useState } from "react";
import { io } from "socket.io-client";
export function useSocket(onEvent) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
    const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
    const socketUrl = configuredSocketUrl || (configuredApiUrl
      ? new URL(configuredApiUrl, window.location.origin).origin
      : "http://localhost:5000");
    const socket = io(socketUrl, {
      auth: { token: sessionStorage.getItem("token") },
      reconnection: true,
    });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.onAny((name, data) => onEvent?.(name, data));
    return () => socket.disconnect();
  }, [onEvent]);
  return connected;
}
