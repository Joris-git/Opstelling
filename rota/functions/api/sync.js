// GET /api/sync?trip=CODE&since=REV[&uid=u_..&tab=route&ping=1]
// Returns every document changed after `since` (deleted ones with data: null),
// the trip's current rev, and who has been active in the last 30 seconds.
import { ensureSchema, json, fail, getTrip, UID_RE } from "../../lib/store.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return fail("no_db", 500, "D1-database is niet gekoppeld (binding DB).");
  await ensureSchema(env.DB);
  const url = new URL(request.url);
  const trip = await getTrip(env.DB, url.searchParams.get("trip"));
  if (!trip) return fail("not_found", 404);

  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
  const rows = await env.DB.prepare("SELECT path, data, deleted, rev FROM docs WHERE trip = ? AND rev > ? ORDER BY rev")
    .bind(trip.code, since).all();

  const now = Date.now();
  const uid = url.searchParams.get("uid");
  if (uid && UID_RE.test(uid) && url.searchParams.get("ping")) {
    const tab = String(url.searchParams.get("tab") || "").slice(0, 20);
    await env.DB.prepare(`INSERT INTO presence (trip, uid, tab, seen) VALUES (?, ?, ?, ?)
      ON CONFLICT (trip, uid) DO UPDATE SET tab = excluded.tab, seen = excluded.seen`).bind(trip.code, uid, tab, now).run();
  }
  const online = await env.DB.prepare("SELECT uid, tab FROM presence WHERE trip = ? AND seen > ?").bind(trip.code, now - 30000).all();

  return json({
    rev: trip.rev,
    name: trip.name,
    docs: rows.results.map((r) => ({ path: r.path, rev: r.rev, data: r.deleted ? null : JSON.parse(r.data) })),
    online: online.results
  });
}
