// POST /api/trips  {name}  -> {code}
// Creates a new trip with a hard-to-guess code. Whoever has the link can join.
import { ensureSchema, json, fail, newCode } from "../../lib/store.js";

const STARTERS = [
  ["start-benagil", { title: "Bootje naar de Benagil-grot", category: "activiteit", place: "Benagil", cost: 30, description: "De grot zelf mag je niet meer in zwemmen of peddelen; je bekijkt hem vanaf een boottour. Boek vooraf." }],
  ["start-piedade", { title: "Kajakken langs Ponta da Piedade", category: "activiteit", place: "Lagos", cost: 35, description: "Peddelen door grotten en bogen in de goudkleurige kliffen. Ochtend is het rustigst op het water." }],
  ["start-vicente", { title: "Zonsondergang bij Cabo de São Vicente", category: "natuur", place: "Sagres", cost: 0, description: "Het meest zuidwestelijke punt van Europa. Neem een trui mee, het waait altijd." }],
  ["start-tavira", { title: "Pontje naar Ilha de Tavira", category: "strand", place: "Tavira", cost: 3, description: "Lang zandstrand op een eiland in de Ria Formosa. Pontje vertrekt uit Tavira of Quatro Águas." }],
  ["start-guia", { title: "Piri-piri-kip in Guia", category: "eten", place: "Guia", cost: 15, description: "Guia staat bekend om frango piri-piri. Simpel, goedkoop, groepsproof." }]
];

export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail("no_db", 500, "D1-database is niet gekoppeld (binding DB).");
  await ensureSchema(env.DB);
  let body = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }
  const name = String(body.name || "").trim().slice(0, 60) || "Onze reis";
  const now = Date.now();

  let code = "";
  for (let i = 0; i < 5 && !code; i++) {
    const c = newCode();
    const r = await env.DB.prepare("INSERT OR IGNORE INTO trips (code, name, rev, created_at) VALUES (?, ?, 1, ?)").bind(c, name, now).run();
    if (r.meta.changes === 1) code = c;
  }
  if (!code) return fail("unavailable", 503);

  const stmts = [
    env.DB.prepare("INSERT INTO docs (trip, path, data, rev) VALUES (?, ?, ?, 1)").bind(code, "trip/main", JSON.stringify({ name, from: "AMS", createdAt: now }))
  ];
  STARTERS.forEach(([id, d], k) => stmts.push(
    env.DB.prepare("INSERT INTO docs (trip, path, data, rev) VALUES (?, ?, ?, 1)").bind(code, "ideas/" + id,
      JSON.stringify({ ...d, link: "", day: "", time: "", stopId: "", status: "voorstel", author: null, createdAt: now + k, updatedAt: now + k, votes: {} }))
  ));
  await env.DB.batch(stmts);
  return json({ code, name }, 201);
}
