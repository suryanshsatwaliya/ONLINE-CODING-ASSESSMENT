const storageKey = (assessmentId) => `assessment-access-code:${assessmentId}`;

export function readCachedAssessmentCode(assessmentId) {
  try { return window.sessionStorage.getItem(storageKey(assessmentId)) || ""; }
  catch { return ""; }
}

export function cacheAssessmentCode(assessmentId, code) {
  if (!assessmentId || !code) return;
  try { window.sessionStorage.setItem(storageKey(assessmentId), code); }
  catch { /* Server persistence remains available if browser storage is disabled. */ }
}
