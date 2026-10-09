// POST /api/claude  {trip, input, tier}
// Streams Claude's answer back as NDJSON lines: {"d": "text"} per chunk, then
// {"done": true, "stop": "..."} or {"error": "code"}.
// The API key stays on the server (env ANTHROPIC_API_KEY); a daily limit per trip
// (env AI_DAILY_LIMIT, default 60) keeps costs predictable.
import Anthropic from "@anthropic-ai/sdk";
import { ensureSchema, json, fail, getTrip } from "../../lib/store.js";

const SYSTEM = "Je bent de reisassistent in Rota, een app waarin een vriendengroep samen een reis plant: route, verblijven, activiteiten en dagplanning. "
  + "Antwoord in het Nederlands, tenzij de vraag in een andere taal is. Wees kort en praktisch, noem echte plekken en realistische prijzen, en volg het gevraagde antwoordformaat precies.";

function toMessages(input) {
  if (typeof input === "string") return input.trim() ? [{ role: "user", content: input }] : null;
  if (!Array.isArray(input)) return null;
  const turns = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content }));
  // the API expects alternating turns that start and end with the user: merge neighbours
  const merged = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.content += "\n\n" + t.content;
    else merged.push({ ...t });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return merged.length && merged[merged.length - 1].role === "user" ? merged : null;
}

function errorCode(err) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "no_key";
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.BadRequestError) return "invalid_request";
  if (err instanceof Anthropic.APIUserAbortError) return "cancelled";
  return "upstream_error";
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail("no_db", 500, "D1-database is niet gekoppeld (binding DB).");
  if (!env.ANTHROPIC_API_KEY) return fail("no_key", 503, "ANTHROPIC_API_KEY is niet ingesteld.");
  await ensureSchema(env.DB);

  let body;
  try { body = await request.json(); } catch { return fail("invalid_request", 400); }
  const trip = await getTrip(env.DB, body?.trip);
  if (!trip) return fail("not_found", 404);
  if (JSON.stringify(body.input ?? "").length > 120000) return fail("prompt_too_large", 413);
  const messages = toMessages(body.input);
  if (!messages) return fail("invalid_request", 400);

  const limit = Number(env.AI_DAILY_LIMIT) || 60;
  const day = new Date().toISOString().slice(0, 10);
  const used = await env.DB.prepare(`UPDATE trips SET ai_count = CASE WHEN ai_day = ?1 THEN ai_count + 1 ELSE 1 END, ai_day = ?1
    WHERE code = ?2 RETURNING ai_count`).bind(day, trip.code).first();
  if (used && used.ai_count > limit) return fail("limit", 429, `Daglimiet van ${limit} Claude-vragen bereikt.`);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.beta.messages.stream({
    model: env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: body.tier === "quick" ? "low" : "medium" },
    system: SYSTEM,
    messages
  }, { signal: request.signal });

  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const out = writable.getWriter();
  const send = (obj) => out.write(enc.encode(JSON.stringify(obj) + "\n"));

  (async () => {
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") await send({ d: event.delta.text });
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") await send({ error: "refused" });
      else await send({ done: true, stop: final.stop_reason });
    } catch (err) {
      try { await send({ error: errorCode(err) }); } catch { /* client went away */ }
    } finally {
      try { await out.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
