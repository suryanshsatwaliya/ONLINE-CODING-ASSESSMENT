import { useEffect, useRef } from "react";
import { proctorService } from "../services/proctorService";
export function useProctoring({
  attemptId,
  active,
  settings,
  onWarning,
  onClosed,
}) {
  const callbacks = useRef({ onWarning, onClosed });
  callbacks.current = { onWarning, onClosed };
  useEffect(() => {
    if (!active || !settings) return;
    let stopped = false,
      busy = false;
    const queue = [];
    const send = async () => {
      if (busy || stopped) return;
      busy = true;
      while (queue.length && !stopped) {
        try {
          const { data } = await proctorService.send(queue[0]);
          queue.shift();
          if (data.warningIssued) callbacks.current.onWarning(data);
          if (data.status !== "ACTIVE") {
            callbacks.current.onClosed();
            queue.length = 0;
          }
        } catch (e) {
          if ([401, 403, 409].includes(e.response?.status)) {
            queue.length = 0;
            callbacks.current.onClosed();
          }
          break;
        }
      }
      busy = false;
    };
    const log = (eventType) => {
      if (queue.length < 100)
        queue.push({ attemptId, eventId: crypto.randomUUID(), eventType });
      send();
    };
    const listeners = [];
    const listen = (target, event, handler) => {
      target.addEventListener(event, handler, true);
      listeners.push(() => target.removeEventListener(event, handler, true));
    };
    if (settings.requireFullscreen)
      listen(document, "fullscreenchange", () => {
        if (!document.fullscreenElement) log("FULLSCREEN_EXIT");
      });
    if (settings.monitorTabSwitching)
      listen(document, "visibilitychange", () => {
        if (document.hidden) log("TAB_HIDDEN");
      });
    if (settings.monitorWindowFocus) {
      listen(window, "blur", () => log("WINDOW_BLUR"));
      listen(window, "focus", () => log("WINDOW_FOCUS"));
    }
    for (const [event, key, type] of [
      ["copy", "blockCopy", "COPY_ATTEMPT"],
      ["paste", "blockPaste", "PASTE_ATTEMPT"],
      ["cut", "blockCut", "CUT_ATTEMPT"],
      ["contextmenu", "blockContextMenu", "CONTEXT_MENU_ATTEMPT"],
    ])
      if (settings[key])
        listen(document, event, (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          log(type);
        });
    if (settings.monitorPageExit) {
      listen(window, "beforeunload", (e) => {
        log("PAGE_EXIT_ATTEMPT");
        e.preventDefault();
        e.returnValue = "";
      });
      listen(window, "pagehide", () => log("PAGE_EXIT_ATTEMPT"));
    }
    const retry = setInterval(send, 3000);
    listen(window, "online", send);
    return () => {
      stopped = true;
      clearInterval(retry);
      listeners.forEach((f) => f());
    };
  }, [attemptId, active, settings]);
}
