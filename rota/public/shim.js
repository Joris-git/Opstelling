/* Rota on Cloudflare: provides the small `claude.use(name)` surface the app was written
   against (db, user, room, sample), backed by this site's /api functions instead of claude.ai.
   - db:     documents synced via /api/sync (polling) and /api/write
   - user:   name picked on first visit, remembered per trip in this browser
   - room:   who is online, from the same sync call
   - sample: Claude via /api/claude (server-side API key) */
(function () {
  "use strict";
  window.ROTA_STANDALONE = true;

  /* ---------- trip code from the URL: /r/CODE ---------- */
  const m = location.pathname.match(/^\/r\/([a-z0-9]{8,16})\/?$/) || location.search.match(/[?&]r=([a-z0-9]{8,16})/);
  const TRIP = m ? m[1] : null;
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const uidKey = TRIP ? "rota:" + TRIP + ":uid" : null;
  let ME = uidKey ? LS.get(uidKey) : null;

  /* ---------- local document cache ---------- */
  const docs = new Map();          // path -> data
  const pending = new Map();       // path -> number of writes in flight
  let since = 0, tripName = "", online = [], lastPing = 0, myTab = "";
  let loaded = false, failed = null;
  const docListeners = new Set(), colListeners = new Set(), peerListeners = new Set();

  const clone = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
  function mergePatch(target, patch) {               // RFC 7396, same as the server's json_patch
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return clone(patch);
    const out = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete out[k];
      else out[k] = mergePatch(out[k], v);
    }
    return out;
  }
  const segs = (p) => p.split("/");
  const inCollection = (docPath, colPath) => {
    const a = segs(docPath), b = segs(colPath);
    return a.length === b.length + 1 && docPath.startsWith(colPath + "/");
  };
  function notify() {
    for (const l of docListeners) {
      const d = docs.get(l.path);
      const key = JSON.stringify(d ?? null);
      if (key === l.last) continue;
      l.last = key;
      try { l.cb({ id: segs(l.path).pop(), exists: d != null, data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } }); } catch (e) { console.error(e); }
    }
    for (const l of colListeners) {
      const list = [...docs.entries()].filter(([p]) => inCollection(p, l.path)).sort(([a], [b]) => a < b ? -1 : 1);
      const key = JSON.stringify(list);
      if (key === l.last) continue;
      l.last = key;
      const ds = list.map(([p, d]) => ({ id: segs(p).pop(), exists: true, data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } }));
      try { l.cb({ docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }); } catch (e) { console.error(e); }
    }
  }

  /* ---------- sync ---------- */
  async function sync() {
    if (!TRIP) return;
    const ping = ME && Date.now() - lastPing > 15000;
    const q = new URLSearchParams({ trip: TRIP, since: String(since) });
    if (ping) { q.set("uid", ME); q.set("tab", myTab || ""); q.set("ping", "1"); }
    let res;
    try { res = await fetch("/api/sync?" + q, { cache: "no-store" }); }
    catch (e) { setOffline(true); return; }
    if (res.status === 404) { failed = "not_found"; return; }
    if (!res.ok) { setOffline(true); if (!loaded) failed = "server"; return; }
    setOffline(false);
    if (ping) lastPing = Date.now();
    const body = await res.json();
    tripName = body.name || tripName;
    for (const d of body.docs) {
      if (pending.get(d.path)) continue;            // our own write is still on its way
      if (d.data == null) docs.delete(d.path); else docs.set(d.path, d.data);
    }
    since = Math.max(since, body.rev);
    online = body.online || [];
    loaded = true;
    notify();
    emitPeers();
  }
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (document.visibilityState !== "hidden") await sync(); schedule(); }, 4000);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && loaded) sync(); });
  window.addEventListener("focus", () => { if (loaded) sync(); });

  async function write(op, path, data) {
    const before = docs.get(path);
    if (op === "set") docs.set(path, clone(data));
    else if (op === "update") docs.set(path, mergePatch(before, data));
    else docs.delete(path);
    pending.set(path, (pending.get(path) || 0) + 1);
    notify();
    try {
      const res = await fetch("/api/write", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trip: TRIP, op, path, data }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw { code: body.error === "quota_exceeded" ? "quota_exceeded" : "unavailable", message: body.message || "" };
      pending.set(path, pending.get(path) - 1);
      if (!pending.get(path)) { if (body.data == null) docs.delete(path); else docs.set(path, body.data); }
      notify();
    } catch (e) {
      pending.set(path, pending.get(path) - 1);
      if (before === undefined) docs.delete(path); else docs.set(path, before);
      notify();
      sync();
      throw e && e.code ? e : { code: "unavailable", message: "Geen verbinding" };
    }
  }

  /* ---------- db namespace ---------- */
  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  function docRef(path) {
    return {
      id: segs(path).pop(), path,
      get: async () => { const d = docs.get(path); return { id: segs(path).pop(), exists: d != null, data: () => clone(d) }; },
      set: (data) => write("set", path, data),
      update: (data) => write("update", path, data),
      delete: () => write("delete", path),
      onSnapshot(cb) { const l = { path, cb, last: undefined }; docListeners.add(l); if (loaded) setTimeout(notify); return () => docListeners.delete(l); },
      collection: (sub) => colRef(path + "/" + sub)
    };
  }
  function colRef(path) {
    return {
      path,
      doc: (id) => docRef(path + "/" + (id || randomId())),
      add: async (data) => { const r = docRef(path + "/" + randomId()); await r.set(data); return r; },
      onSnapshot(cb) { const l = { path, cb, last: undefined }; colListeners.add(l); if (loaded) setTimeout(notify); return () => colListeners.delete(l); },
      get: async () => { const ds = [...docs.entries()].filter(([p]) => inCollection(p, path)).map(([p, d]) => ({ id: segs(p).pop(), exists: true, data: () => clone(d) })); return { docs: ds, size: ds.length, empty: !ds.length }; }
    };
  }
  const db = Object.freeze({ doc: docRef, collection: colRef });

  /* ---------- people ---------- */
  const PALETTE = ["#c2410c", "#0e7490", "#7c3aed", "#15803d", "#be185d", "#1d4ed8", "#a16207", "#0f766e", "#9333ea", "#b91c1c"];
  const person = (id) => docs.get("people/" + id) || null;
  const colorOf = (id) => person(id)?.color || PALETTE[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  const avatarOf = (id, name) => {
    const ini = (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${colorOf(id)}"/><text x="16" y="21" font-size="${ini.length > 1 ? 12 : 15}" font-family="system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#fff">${ini.replace(/[<&>]/g, "")}</text></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  };
  const profile = (id) => { const n = person(id)?.name || ""; return { id, name: n, avatarUrl: avatarOf(id, n), color: colorOf(id), email: null, isMe: id === ME, guest: false }; };
  const user = Object.freeze({
    id: async () => ME, isOwner: async () => false, canEdit: async () => true, can: async () => true,
    me: async () => ({ ...profile(ME), isOwner: false, canEdit: true }),
    name: async () => person(ME)?.name || "", avatarUrl: async () => profile(ME).avatarUrl, email: async () => null,
    profiles: async (ids) => Object.fromEntries([...new Set([].concat(ids))].map((id) => [id, profile(id)])),
    search: async () => []
  });

  /* ---------- room (who is online) ---------- */
  function emitPeers() {
    const ids = new Set(online.map((o) => o.uid));
    if (ME) ids.add(ME);
    const peers = [...ids].map((id) => ({ peer: id, by: id, isMe: id === ME, sameTab: id === ME, kind: "viewer", guest: false, presence: { tab: online.find((o) => o.uid === id)?.tab || "" }, updatedAt: Date.now() }));
    for (const cb of peerListeners) { try { cb({ peers, joined: [], left: [], updated: [] }); } catch (e) { console.error(e); } }
  }
  const room = Object.freeze({
    presence: async (patch) => { if (patch && typeof patch.tab === "string") myTab = patch.tab; },
    onPeers(cb) { peerListeners.add(cb); if (loaded) setTimeout(emitPeers); return () => peerListeners.delete(cb); },
    emit() {}, on() { return () => {}; }
  });

  /* ---------- sample (Claude) ---------- */
  function parseJSONTolerant(text) {
    const tryParse = (s) => { try { return { ok: true, v: JSON.parse(s) }; } catch (e) { return { ok: false }; } };
    let r = tryParse(text.trim()); if (r.ok) return r.v;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) { r = tryParse(fence[1].trim()); if (r.ok) return r.v; }
    const a = text.search(/[\[{]/), b = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
    if (a >= 0 && b > a) { r = tryParse(text.slice(a, b + 1)); if (r.ok) return r.v; }
    throw { code: "invalid_json", message: "Geen JSON in het antwoord", text };
  }
  const ERR = { limit: "rate_limited", rate_limited: "rate_limited", no_key: "sampling_disabled", refused: "refused", prompt_too_large: "prompt_too_large", invalid_request: "invalid_request", not_found: "sampling_disabled", cancelled: "cancelled" };
  async function ask(input, opts = {}) {
    const onText = typeof opts.onText === "function" ? opts.onText : null;
    let text = "";
    let res;
    try {
      res = await fetch("/api/claude", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trip: TRIP, input, tier: opts.modelTier || "default" }), signal: opts.signal });
    } catch (e) {
      throw { code: e && e.name === "AbortError" ? "cancelled" : "upstream_error", message: String(e) };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw { code: ERR[body.error] || "upstream_error", message: body.message || "" };
    }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", stop = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.d) { text += msg.d; if (onText) { try { onText({ text, delta: msg.d }); } catch (e) { console.error(e); } } }
          else if (msg.error) throw { code: ERR[msg.error] || "upstream_error", message: msg.error, text: msg.error === "refused" ? undefined : text || undefined };
          else if (msg.done) stop = msg.stop;
        }
      }
    } catch (e) {
      if (e && e.name === "AbortError") throw { code: "cancelled", message: "Gestopt", text: text || undefined };
      throw e && e.code ? e : { code: "upstream_error", message: String(e), text: text || undefined };
    }
    if (!stop) throw { code: "upstream_error", message: "Verbinding verbroken", text: text || undefined };
    if (!text.trim()) throw { code: "empty_completion", message: "Leeg antwoord" };
    return { text, truncated: stop === "max_tokens", modelTierApplied: opts.modelTier || "default" };
  }
  const sample = Object.assign((input, opts) => ask(input, opts), {
    json: async (input, opts) => parseJSONTolerant((await ask(input, opts)).text),
    limits: async () => ({ maxPromptBytes: 120000 })
  });

  /* ---------- claude.use ---------- */
  let resolveReady; const ready = new Promise((r) => { resolveReady = r; });
  const NS = { db, user, room, sample };
  window.claude = Object.freeze({ use: (name) => name in NS ? ready.then((ok) => ok ? NS[name] : null) : Promise.resolve(null) });

  /* ---------- small UI: landing, join, share ---------- */
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((k) => k != null && e.append(k.nodeType ? k : document.createTextNode(String(k))));
    return e;
  };
  function standalonePage() { document.body.classList.add("rota-solo"); }
  function screen(title, ...content) {
    const box = el("div", { class: "scrim rota-gate", role: "dialog", "aria-modal": "true" },
      el("div", { class: "sheet rota-gate-sheet" }, el("div", { class: "sheet-h" }, el("h2", {}, title)), el("div", { class: "sheet-b" }, ...content)));
    document.body.append(box);
    return box;
  }
  const recent = () => { try { return JSON.parse(LS.get("rota:recent") || "[]"); } catch (e) { return []; } };
  function remember(code, name) {
    const list = recent().filter((r) => r.code !== code);
    list.unshift({ code, name, at: Date.now() });
    LS.set("rota:recent", JSON.stringify(list.slice(0, 8)));
  }

  function landing() {
    const err = el("div", { class: "small", style: "color:var(--no)" });
    const form = el("form", { class: "f" },
      el("div", { class: "field" }, el("label", { for: "g-trip" }, "Naam van de reis"), el("input", { id: "g-trip", name: "trip", maxlength: "60", required: true, placeholder: "Bijv. Algarve met de jaarclub" })),
      el("div", { class: "field" }, el("label", { for: "g-me" }, "Jouw naam"), el("input", { id: "g-me", name: "me", maxlength: "40", required: true, placeholder: "Zoals je vrienden je kennen" })),
      el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit" }, "Nieuwe reis starten")), err);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form); err.textContent = "";
      form.querySelector("button").disabled = true;
      try {
        const res = await fetch("/api/trips", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("trip") }) });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || "Aanmaken lukte niet");
        LS.set("rota:pendingName:" + body.code, String(fd.get("me")).trim());
        remember(body.code, body.name);
        location.href = "/r/" + body.code;
      } catch (x) { err.textContent = x.message + ". Probeer het opnieuw."; form.querySelector("button").disabled = false; }
    };
    const rec = recent();
    screen("Rota",
      el("p", { class: "muted", style: "margin:0" }, "Plan samen een reis zonder eindeloze groepsapp: route, verblijf, activiteiten en dagplanning, met stemmen en Claude als reisassistent."),
      form,
      rec.length ? el("section", {}, el("div", { class: "label", style: "margin-bottom:8px" }, "Eerder geopend"),
        el("div", { class: "stack" }, rec.map((r) => el("a", { class: "mini", href: "/r/" + r.code }, el("b", {}, r.name || r.code))))) : null);
  }

  function join() {
    return new Promise((resolve) => {
      let gate = null;
      const people = [...docs.entries()].filter(([p]) => inCollection(p, "people")).map(([p, d]) => ({ id: segs(p).pop(), ...d })).filter((p) => p.name);
      const pendingName = LS.get("rota:pendingName:" + TRIP);
      const done = async (id, name) => {
        ME = id; LS.set(uidKey, id);
        remember(TRIP, tripName);
        if (name) await write("set", "people/" + id, { name: name.slice(0, 40), color: PALETTE[people.length % PALETTE.length], joinedAt: Date.now() }).catch(() => {});
        gate?.remove(); resolve();
      };
      if (pendingName) { LS.set("rota:pendingName:" + TRIP, ""); done("u_" + randomId(), pendingName); return; }
      const input = el("input", { id: "g-name", maxlength: "40", required: true, placeholder: "Je voornaam" });
      const form = el("form", { class: "f" }, el("div", { class: "field" }, el("label", { for: "g-name" }, people.length ? "Of je bent nieuw:" : "Hoe heet je?"), input),
        el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit" }, "Doe mee")));
      form.onsubmit = (e) => { e.preventDefault(); const n = input.value.trim(); if (n) done("u_" + randomId(), n); };
      gate = screen(tripName || "Doe mee",
        el("p", { class: "muted", style: "margin:0" }, "Je bent uitgenodigd om mee te plannen. Kies wie je bent, dan zien de anderen jouw stemmen en voorstellen."),
        people.length ? el("section", {}, el("div", { class: "label", style: "margin-bottom:8px" }, "Ik ben…"),
          el("div", { class: "row" }, people.map((p) => el("button", { class: "btn", type: "button", onclick: () => done(p.id) }, el("img", { src: avatarOf(p.id, p.name), alt: "", style: "width:20px;height:20px;border-radius:50%" }), p.name)))) : null,
        form);
    });
  }

  function message(title, text, linkText) {
    screen(title, el("p", { style: "margin:0" }, text), el("div", { class: "row" }, el("a", { class: "btn primary", href: "/" }, linkText || "Naar de startpagina")));
  }

  /* exposed to the app: share + switch person */
  window.rotaShare = async function () {
    const url = location.origin + "/r/" + TRIP;
    const text = `Plan mee aan ${tripName || "onze reis"}: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: tripName || "Rota", text: `Plan mee aan ${tripName || "onze reis"}`, url }); return "shared"; } catch (e) { if (e && e.name === "AbortError") return "cancelled"; } }
    try { await navigator.clipboard.writeText(text); return "copied"; } catch (e) { return url; }
  };
  window.rotaWhatsApp = () => "https://wa.me/?text=" + encodeURIComponent(`Plan mee aan ${tripName || "onze reis"}: ${location.origin}/r/${TRIP}`);
  window.rotaTripUrl = () => location.origin + "/r/" + TRIP;
  window.rotaSwitchPerson = () => { try { localStorage.removeItem(uidKey); } catch (e) {} location.reload(); };

  /* ---------- boot ---------- */
  async function boot() {
    if (!TRIP) { resolveReady(false); standalonePage(); landing(); return; }
    await sync();
    if (failed === "not_found") { resolveReady(false); standalonePage(); message("Reis niet gevonden", "Deze link klopt niet (meer). Vraag de organisator om de juiste link."); return; }
    if (failed) { resolveReady(false); standalonePage(); message("Server niet bereikbaar", "De app kan de reis nu niet laden. Probeer het over een minuut opnieuw.", "Opnieuw proberen"); return; }
    if (!ME || !person(ME)) await join();
    document.title = (tripName ? tripName + " · " : "") + "Rota";
    lastPing = 0;
    resolveReady(true);
    sync().then(schedule);
  }
  let offline = false;
  function setOffline(v) {
    if (v === offline) return; offline = v;
    let bar = document.getElementById("rota-offline");
    if (v && !bar) { bar = el("div", { id: "rota-offline", class: "toast", role: "status" }, "Geen verbinding met de server. Wat je nu wijzigt, wordt niet bewaard."); document.body.append(bar); }
    if (!v && bar) bar.remove();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
