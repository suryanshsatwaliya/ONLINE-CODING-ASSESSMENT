export function isMobilePhone() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iPadWithDesktopUserAgent = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return navigator.userAgentData?.mobile === true || iPadWithDesktopUserAgent || /iPhone|iPod|Android.*Mobile/i.test(ua);
}

export function isGoogleChrome() {
  if (typeof navigator === "undefined") return true;
  if (isMobilePhone()) return false;
  const ua = navigator.userAgent || "";
  const chromeToken = /\bChrome\//.test(ua);
  const anotherBrowser = /\b(Edg|EdgA|EdgiOS|OPR|Opera|SamsungBrowser|Vivaldi|YaBrowser|Brave|CriOS|FxiOS|Firefox)\b/i.test(ua);
  return chromeToken && !anotherBrowser && !navigator.brave;
}

export const chromeOnlyMessage =
  "Student assessments are available only in desktop Google Chrome. Android and iOS phones are not supported.";
