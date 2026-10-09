// Shared helpers for the Pages Functions: D1 schema, validation, JSON responses.
// One trip = one row in `trips` plus its documents in `docs` (same paths the app uses,
// e.g. "ideas/abc123", "stops/xyz", "trip/main"). Every write bumps the trip's `rev`
// so clients can fetch only what changed since their last sync.

let schemaReady = false;

export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS trips (
      code TEXT PRIMARY KEY, name TEXT, rev INTEGER NOT NULL DEFAULT 0, created_at INTEGER,
      ai_day TEXT, ai_count INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS docs (
      trip TEXT NOT NULL, path TEXT NOT NULL, data TEXT, rev INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (trip, path))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS docs_rev ON docs (trip, rev)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presence (
      trip TEXT NOT NULL, uid TEXT NOT NULL, tab TEXT, seen INTEGER NOT NULL, PRIMARY KEY (trip, uid))`)
  ]);
  schemaReady = true;
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export const fail = (code, status = 400, message = "") => json({ error: code, message }, status);

const CODE_RE = /^[a-z0-9]{8,16}$/;
const SEG_RE = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;
export const UID_RE = /^u_[a-z0-9]{8,24}$/;

export const validCode = (c) => typeof c === "string" && CODE_RE.test(c);

export function validDocPath(p) {
  if (typeof p !== "string" || p.length > 400) return false;
  const segs = p.split("/");
  return segs.length % 2 === 0 && segs.length <= 8 && segs.every((s) => SEG_RE.test(s) && s !== "." && s !== "..");
}

export async function getTrip(db, code) {
  if (!validCode(code)) return null;
  return db.prepare("SELECT code, name, rev FROM trips WHERE code = ?").bind(code).first();
}

export function newCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const MAX_DOC_BYTES = 64 * 1024;
export const MAX_DOCS_PER_TRIP = 5000;
