async function errorFrom(response) {
  try {
    const data = await response.json();
    return new Error(data.error || `HTTP ${response.status}`);
  } catch (e) {
    return new Error(`HTTP ${response.status}`);
  }
}

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw await errorFrom(r);
  return r.json();
}

async function postJSON(url, body, opts = {}) {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs;
  let timeoutId = null;
  if (timeoutMs) timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    if (!r.ok) throw await errorFrom(r);
    return await r.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const API = {
  getConfig: () => getJSON("/api/config"),
  startTeam: (teamName, isTest = false) => postJSON("/api/team/start", { teamName, isTest }),
  resumeByCode: (code) => getJSON(`/api/team/resume/${encodeURIComponent(code)}`),
  getTeam: (id) => getJSON(`/api/team/${id}`),
  startRoom: (id, roomNumber) => postJSON(`/api/team/${id}/room/${roomNumber}/start`, {}),
  saveRoom: (id, roomNumber, answers) =>
    postJSON(`/api/team/${id}/room/${roomNumber}/save`, { answers }),
  completeRoom: (id, roomNumber) => postJSON(`/api/team/${id}/room/${roomNumber}/complete`, {}),
  saveTijdcapsule: (id, tekst) => postJSON(`/api/team/${id}/tijdcapsule`, { tekst }),
  genereerToekomstbeeld: (id, opts = {}) =>
    postJSON(`/api/ai/toekomstbeeld/${id}`, {}, { timeoutMs: opts.timeoutMs || 65000 }),
};

export default API;
