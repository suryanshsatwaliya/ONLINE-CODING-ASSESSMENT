import { useState, useEffect } from "react";
export function useFullscreen() {
  const [fullscreen, set] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const f = () => set(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  return {
    fullscreen,
    enter: () => document.documentElement.requestFullscreen(),
    exit: () =>
      document.fullscreenElement
        ? document.exitFullscreen()
        : Promise.resolve(),
  };
}
