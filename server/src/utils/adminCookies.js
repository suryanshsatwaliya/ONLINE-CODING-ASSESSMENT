function decodeCookie(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function readCookie(header, name) {
  if (typeof header !== "string" || !header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    let value = item.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    return decodeCookie(value);
  }
  return undefined;
}
