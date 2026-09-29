import { useEffect, useState } from "react";
import { io } from "socket.io-client";
export function useSocket(onEvent) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
      { auth: { token: sessionStorage.getItem("token") } },
    );
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.onAny((name, data) => onEvent?.(name, data));
    return () => socket.disconnect();
  }, [onEvent]);
  return connected;
}
