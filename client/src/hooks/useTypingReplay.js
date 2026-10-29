import { useEffect, useState } from "react";

export function useTypingReplay(cycleMs) {
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setReplayKey((key) => key + 1), cycleMs);
    return () => window.clearInterval(timer);
  }, [cycleMs]);

  return replayKey;
}
