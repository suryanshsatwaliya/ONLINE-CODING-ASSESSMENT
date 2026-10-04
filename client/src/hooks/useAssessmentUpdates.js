import { useCallback, useEffect } from "react";
import { useSocket } from "./useSocket";

export function useAssessmentUpdates(refresh) {
  useSocket(useCallback((event) => {
    if (event === "ASSESSMENT_STARTED" || event === "ASSESSMENT_ENDED") refresh();
  }, [refresh]));
  useEffect(() => {
    // Also recover missed events after temporary connection loss.
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
}
