import { useCallback, useEffect, useRef, useState } from "react";
import { attemptService } from "../services/attemptService";
import { errorMessage } from "../services/api";
export function useAutosave(id, active) {
  const pending = useRef(new Map()),
    timer = useRef(),
    chain = useRef(Promise.resolve()),
    enabled = useRef(active);
  enabled.current = active;
  const [status, setStatus] = useState("Saved");
  const flush = useCallback(() => {
    const run = async () => {
      if (!enabled.current) return;
      for (const [key, item] of [...pending.current]) {
        try {
          setStatus("Saving…");
          await attemptService.save(id, item);
          if (pending.current.get(key) === item) pending.current.delete(key);
        } catch (e) {
          setStatus(
            e.response?.status === 409
              ? "Assessment closed"
              : navigator.onLine
                ? errorMessage(e)
                : "Connection lost — retrying",
          );
          throw e;
        }
      }
      setStatus(pending.current.size ? "Saving…" : "Saved");
    };
    chain.current = chain.current.catch(() => {}).then(run);
    return chain.current;
  }, [id]);
  const save = useCallback(
    (item) => {
      pending.current.set(item.questionId, item);
      setStatus("Saving…");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush().catch(() => {}), 500);
    },
    [flush],
  );
  useEffect(() => {
    const retry = () => flush().catch(() => {});
    window.addEventListener("online", retry);
    const t = setInterval(retry, 4000);
    return () => {
      clearInterval(t);
      clearTimeout(timer.current);
      window.removeEventListener("online", retry);
    };
  }, [flush]);
  return { save, flush, status };
}
