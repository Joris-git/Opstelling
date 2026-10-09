// POST /api/write  {trip, op: "set"|"update"|"delete", path, data}
// set replaces a document, update merges into it (JSON merge patch: nested objects
// merge, null removes a field), delete removes it. Each write bumps the trip rev
// in the same transaction, so concurrent votes on one document never get lost.
import { ensureSchema, json, fail, getTrip, validDocPath, MAX_DOC_BYTES, MAX_DOCS_PER_TRIP } from "../../lib/store.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail("no_db", 500, "D1-database is niet gekoppeld (binding DB).");
  await ensureSchema(env.DB);
  let body;
  try { body = await request.json(); } catch { return fail("invalid_argument", 400, "Geen geldige JSON."); }
  const { op, path } = body || {};
  const trip = await getTrip(env.DB, body?.trip);
  if (!trip) return fail("not_found", 404);
  if (!validDocPath(path)) return fail("invalid_argument", 400, "Ongeldig pad.");
  if (!["set", "update", "delete"].includes(op)) return fail("invalid_argument", 400, "Onbekende bewerking.");

  let payload = null;
  if (op !== "delete") {
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return fail("invalid_argument", 400, "Een document moet een object zijn.");
    payload = JSON.stringify(body.data);
    if (payload.length > MAX_DOC_BYTES) return fail("invalid_argument", 413, "Document is te groot.");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE trip = ? AND deleted = 0").bind(trip.code).first();
    if (count.n >= MAX_DOCS_PER_TRIP) {
      const exists = await env.DB.prepare("SELECT 1 FROM docs WHERE trip = ? AND path = ? AND deleted = 0").bind(trip.code, path).first();
      if (!exists) return fail("quota_exceeded", 413, "Deze reis zit vol.");
    }
  }

  const DB = env.DB, code = trip.code;
  const bump = DB.prepare("UPDATE trips SET rev = rev + 1 WHERE code = ?").bind(code);
  const curRev = "(SELECT rev FROM trips WHERE code = ?1)";
  let write;
  if (op === "set") {
    write = DB.prepare(`INSERT INTO docs (trip, path, data, rev, deleted) VALUES (?1, ?2, ?3, ${curRev}, 0)
      ON CONFLICT (trip, path) DO UPDATE SET data = excluded.data, rev = excluded.rev, deleted = 0`).bind(code, path, payload);
  } else if (op === "update") {
    write = DB.prepare(`INSERT INTO docs (trip, path, data, rev, deleted) VALUES (?1, ?2, json_patch('{}', ?3), ${curRev}, 0)
      ON CONFLICT (trip, path) DO UPDATE SET
        data = json_patch(CASE WHEN docs.deleted = 1 OR docs.data IS NULL THEN '{}' ELSE docs.data END, ?3),
        rev = excluded.rev, deleted = 0`).bind(code, path, payload);
  } else {
    write = DB.prepare(`UPDATE docs SET deleted = 1, data = NULL, rev = ${curRev} WHERE trip = ?1 AND path = ?2`).bind(code, path);
  }
  const read = DB.prepare("SELECT data, rev, deleted FROM docs WHERE trip = ? AND path = ?").bind(code, path);
  const [, , after] = await DB.batch([bump, write, read]);
  const row = after.results[0];
  return json({ path, rev: row?.rev ?? null, data: !row || row.deleted ? null : JSON.parse(row.data) });
}
