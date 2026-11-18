const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function requestHeaders(source) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source || {})) {
    if (value == null || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
  }
  return headers;
}

function responseHeaders(source, res) {
  for (const [name, value] of source.entries()) {
    if (name.toLowerCase() === "set-cookie" || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    res.setHeader(name, value);
  }

  // Node's Headers.getSetCookie() preserves multiple Set-Cookie headers.
  const cookies = source.getSetCookie?.() || [];
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
}

export default async function handler(req, res) {
  const apiRoot = process.env.VITE_API_URL?.trim().replace(/\/+$/, "");
  if (!apiRoot) {
    return res.status(503).json({ message: "Master Admin API proxy is not configured." });
  }

  let targetRoot;
  try {
    targetRoot = new URL(apiRoot);
    if (targetRoot.protocol !== "https:" && targetRoot.hostname !== "localhost") {
      throw new Error("The Master Admin API must use HTTPS.");
    }
  } catch {
    return res.status(503).json({ message: "Master Admin API proxy URL is invalid." });
  }

  const incoming = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  if (!incoming.pathname.startsWith("/api/master-admin/")) {
    return res.status(404).json({ message: "Route not found." });
  }

  // VITE_API_URL is the Render API root, including /api. The browser always
  // talks to this Vercel origin, while Cookie and Origin headers are forwarded.
  const suffix = incoming.pathname.slice("/api".length);
  const destination = new URL(`${targetRoot.href.replace(/\/+$/, "")}${suffix}${incoming.search}`);
  const headers = requestHeaders(req.headers);
  const method = req.method || "GET";
  const body = ["GET", "HEAD"].includes(method) || req.body == null
    ? undefined
    : typeof req.body === "string" || Buffer.isBuffer(req.body)
      ? req.body
      : JSON.stringify(req.body);

  try {
    const upstream = await fetch(destination, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    responseHeaders(upstream.headers, res);
    res.statusCode = upstream.status;

    // Preserve the current frontend host when the API redirects an unknown
    // admin path back to the configured entry URL. This avoids switching from
    // a custom domain to a Vercel alias (or vice versa) mid-login.
    if (incoming.pathname === "/api/master-admin/auth/entry-redirect") {
      const location = upstream.headers.get("location");
      if (location) {
        const redirect = new URL(location, destination);
        res.setHeader("Location", `${redirect.pathname}${redirect.search}${redirect.hash}`);
      }
    }

    if (method === "HEAD" || upstream.status === 204 || upstream.status === 304) {
      return res.end();
    }
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    return res.end(responseBody);
  } catch {
    return res.status(502).json({ message: "Master Admin API is temporarily unavailable." });
  }
}
