import { useState, useEffect } from "react";

async function lockFullscreenEscape() {
  try {
    if (navigator.keyboard?.lock) await navigator.keyboard.lock(["Escape"]);
  } catch {
    // Keyboard Lock is an optional browser feature and may be denied or unsupported.
  }
}

export function useFullscreen() {
  const [fullscreen, set] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const f = () => {
      const active = Boolean(document.fullscreenElement);
      set(active);
      if (active) void lockFullscreenEscape();
      else navigator.keyboard?.unlock?.();
    };
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  return {
    fullscreen,
    enter: () => document.documentElement.requestFullscreen(),
    exit: async () => {
      navigator.keyboard?.unlock?.();
      if (document.fullscreenElement) await document.exitFullscreen();
    },
  };
}
