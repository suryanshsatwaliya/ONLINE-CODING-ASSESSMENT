import { useEffect, useState } from "react";
export function useTimer(expiresAt, serverTime) {
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (serverTime) setOffset(new Date(serverTime).getTime() - Date.now());
  }, [serverTime]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return (
    Math.max(
      0,
      Math.ceil((new Date(expiresAt).getTime() - now - offset) / 1000),
    ) || 0
  );
}
