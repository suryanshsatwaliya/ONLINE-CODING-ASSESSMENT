import { useEffect, useRef } from "react";
import { proctorService } from "../services/proctorService";
export function useProctoring({
  attemptId,
  active,
  settings,
  onWarning,
  onImmediateWarning,
  onWarningResolved,
  onClosed,
}) {
  const callbacks = useRef({ onWarning, onImmediateWarning, onWarningResolved, onClosed });
  callbacks.current = { onWarning, onImmediateWarning, onWarningResolved, onClosed };
  useEffect(() => {
    if (!active || !settings) return;
    let stopped = false,
      busy = false,
      windowBlurTimer,
      escapeResetTimer,
      rightClickAt = 0,
      fullscreenExitFromEscape = false;
    const queue = [];
    const send = async () => {
      if (busy || stopped) return;
      busy = true;
      while (queue.length && !stopped) {
        try {
          const sentEvent = queue[0];
          const { data } = await proctorService.send(sentEvent);
          queue.shift();
          if (data.warningIssued) callbacks.current.onWarning(data);
          else callbacks.current.onWarningResolved?.(sentEvent.eventType);
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
      const defaultWarningEvents = new Set([
        "FULLSCREEN_EXIT", "TAB_HIDDEN", "WINDOW_BLUR", "COPY_ATTEMPT",
        "PASTE_ATTEMPT", "CUT_ATTEMPT", "CONTEXT_MENU_ATTEMPT", "PAGE_EXIT_ATTEMPT",
      ]);
      const configuredRule = settings.eventRules?.[eventType];
      if (configuredRule === "WARNING" || (!configuredRule && defaultWarningEvents.has(eventType))) {
        callbacks.current.onImmediateWarning?.(eventType);
      }
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
        if (!document.fullscreenElement) {
          if (fullscreenExitFromEscape) {
            fullscreenExitFromEscape = false;
            clearTimeout(escapeResetTimer);
          } else log("FULLSCREEN_EXIT");
        }
      });
    if (settings.requireFullscreen)
      listen(document, "keydown", (event) => {
        if (event.key !== "Escape" || !document.fullscreenElement) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        fullscreenExitFromEscape = true;
        clearTimeout(escapeResetTimer);
        escapeResetTimer = setTimeout(() => { fullscreenExitFromEscape = false; }, 2500);
        log("FULLSCREEN_EXIT");
      });
    if (settings.monitorTabSwitching)
      listen(document, "visibilitychange", () => {
        if (document.hidden) log("TAB_HIDDEN");
      });
    if (settings.monitorWindowFocus) {
      listen(window, "blur", () => {
        clearTimeout(windowBlurTimer);
        // Browsers can briefly blur the page for native UI and focus changes.
        // Only count a sustained loss of focus; hidden tabs are handled separately.
        windowBlurTimer = setTimeout(() => {
          if (!stopped && !document.hidden && !document.hasFocus())
            log("WINDOW_BLUR");
        }, 1800);
      });
      listen(window, "focus", () => {
        clearTimeout(windowBlurTimer);
        log("WINDOW_FOCUS");
      });
    }
    for (const [event, key, type] of [
      ["copy", "blockCopy", "COPY_ATTEMPT"],
      ["paste", "blockPaste", "PASTE_ATTEMPT"],
      ["cut", "blockCut", "CUT_ATTEMPT"],
    ])
      if (settings[key])
        listen(document, event, (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          log(type);
        });
    if (settings.blockContextMenu) {
      listen(window, "mousedown", (event) => {
        if (event.button !== 2) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        rightClickAt = performance.now();
        log("CONTEXT_MENU_ATTEMPT");
      });
      listen(window, "contextmenu", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        // The right-button press already recorded this interaction. Keep this
        // fallback for keyboard-triggered context menus such as Shift+F10.
        if (performance.now() - rightClickAt > 800)
          log("CONTEXT_MENU_ATTEMPT");
      });
    }
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
      clearTimeout(windowBlurTimer);
      clearTimeout(escapeResetTimer);
      clearInterval(retry);
      listeners.forEach((f) => f());
    };
  }, [attemptId, active, settings]);
}
