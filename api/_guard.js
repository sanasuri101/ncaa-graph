/**
 * api/_guard.js — abuse guard for the endpoints that spend the Groq key.
 * (The leading underscore keeps Vercel from exposing this file as a route.)
 *
 *   1. Same-origin only: a browser sends an Origin header on every POST; it must
 *      match the host serving the request, so other sites cannot call the API.
 *   2. Rate limit per IP. Counters live in this function instance's memory, so
 *      the limit is per warm instance, not global — it slows a flood, it does
 *      not make one impossible. A shared store would be needed for that.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map(); // ip -> timestamps of recent requests

function deny(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message } }));
  return false;
}

/** Returns true if the request may proceed; otherwise it has been answered. */
export function guard(req, res) {
  let originHost = null;
  try {
    originHost = new URL(req.headers.origin).host;
  } catch {}
  if (originHost !== req.headers.host)
    return deny(res, 403, "This endpoint only accepts requests from the app");

  const ip =
    String(req.headers["x-forwarded-for"] ?? "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW)
    return deny(res, 429, "Too many requests — try again in a minute");
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // bound memory
  return true;
}
