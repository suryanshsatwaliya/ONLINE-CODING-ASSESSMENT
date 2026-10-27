export function isGoogleChrome() {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  const chromeToken = /\bChrome\//.test(ua);
  const anotherBrowser = /\b(Edg|EdgA|EdgiOS|OPR|Opera|SamsungBrowser|Vivaldi|YaBrowser|Brave|CriOS|FxiOS|Firefox)\b/i.test(ua);
  return chromeToken && !anotherBrowser && !navigator.brave;
}

export const chromeOnlyMessage =
  "This assessment requires Google Chrome. Open the assessment in Chrome to continue.";
