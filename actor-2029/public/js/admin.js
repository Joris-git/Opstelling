import API, { AdminAPI } from "./api.js";
import { formatTime } from "./timer.js";
import { escapeHtml } from "./util.js";
import { posterHtml } from "./poster.js";
import { downloadPosterAsPng } from "./kluis.js";

let config = null;
let teams = [];
let pollTimer = null;

function teamColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 70%, 60%)`;
}

function roomLabel(n) {
  if (n >= 1 && n <= 4) return `Kamer ${n}`;
  if (n >= 5) return "Kluis";
  return "—";
}

function showLogin(message) {
  document.getElementById("login-scherm").hidden = false;
  document.getElementById("regie-app").hidden = true;
  const fout = document.getElementById("login-fout");
  if (message) {
    fout.textContent = message;
    fout.hidden = false;
  } else {
    fout.hidden = true;
  }
}

function showApp() {
  document.getElementById("login-scherm").hidden = true;
  document.getElementById("regie-app").hidden = false;
}

function wireLogin() {
  const input = document.getElementById("login-wachtwoord");
  async function probeerLogin() {
    try {
      await AdminAPI.login(input.value);
      input.value = "";
      showApp();
      startApp();
    } catch (e) {
      showLogin("Onjuist wachtwoord. Probeer het opnieuw.");
    }
  }
  document.getElementById("btn-login").addEventListener("click", probeerLogin);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") probeerLogin();
  });

  document.getElementById("btn-logout").addEventListener("click", async () => {
    stopPolling();
    try {
      await AdminAPI.logout();
    } catch (e) {
      /* negeren */
    }
    showLogin();
  });
}

function wireTabs() {
  document.querySelectorAll(".regie-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".regie-tab").forEach((t) => t.classList.remove("is-actief"));
      tab.classList.add("is-actief");
      const naam = tab.dataset.tab;
      document.querySelectorAll(".regie-paneel").forEach((p) => {
        p.hidden = p.dataset.paneel !== naam;
      });
      if (naam === "vergelijking") renderVergelijking();
      if (naam === "gezamenlijk") laadGezamenlijk();
    });
  });
}

function wireBeamer() {
  document.getElementById("beamer-sluiten").addEventListener("click", () => {
    document.getElementById("beamer-overlay").hidden = true;
  });
  document.getElementById("beamer-fullscreen").addEventListener("click", () => {
    const el = document.getElementById("beamer-overlay");
    if (el.requestFullscreen) el.requestFullscreen();
  });
}

function openBeamer(image) {
  document.getElementById("beamer-poster").innerHTML = posterHtml(image);
  document.getElementById("beamer-overlay").hidden = false;
}

function renderTeamsTable() {
  const tbody = document.getElementById("teams-tbody");
  const leeg = document.getElementById("teams-leeg");
  tbody.innerHTML = "";
  leeg.hidden = teams.length > 0;

  teams.forEach((team) => {
    const tr = document.createElement("tr");
    const bezigSinds = team.totalStartedAt
      ? formatTime((Date.now() - new Date(team.totalStartedAt).getTime()) / 1000)
      : "—";
    const heeftBeeld = !!team.futureImage;

    tr.innerHTML = `
      <td>${escapeHtml(team.teamName)}${team.isTest ? ' <span class="regie-badge">test</span>' : ""}</td>
      <td class="regie-code">${escapeHtml(team.resumeCode)}</td>
      <td>${roomLabel(team.currentRoom)}</td>
      <td>${bezigSinds}</td>
      <td>${heeftBeeld ? "✓ klaar" : "nog niet"}</td>
      <td></td>
    `;

    const actieTd = tr.querySelector("td:last-child");
    if (heeftBeeld) {
      const beamerBtn = document.createElement("button");
      beamerBtn.type = "button";
      beamerBtn.className = "btn-secondary";
      beamerBtn.textContent = "Beamer";
      beamerBtn.addEventListener("click", () => openBeamer(team.futureImage));
      actieTd.appendChild(beamerBtn);
    }
    const verwijderBtn = document.createElement("button");
    verwijderBtn.type = "button";
    verwijderBtn.className = "btn-secondary";
    verwijderBtn.textContent = "Verwijder";
    verwijderBtn.addEventListener("click", async () => {
      if (!window.confirm(`Team "${team.teamName}" definitief verwijderen?`)) return;
      await AdminAPI.deleteTeam(team.id);
      await ververs();
    });
    actieTd.appendChild(verwijderBtn);

    tbody.appendChild(tr);
  });
}

function renderLegenda() {
  return `
    <div class="vergelijking-legenda">
      ${teams
        .map(
          (t) => `
        <span class="legenda-item">
          <span class="legenda-kleur" style="background:${teamColor(t.id)}"></span>
          ${escapeHtml(t.teamName)}
        </span>`
        )
        .join("")}
    </div>
  `;
}

function renderAs(titel, labels, getIndex) {
  const posities = {};
  const dots = teams
    .map((t) => {
      const idx = getIndex(t);
      if (idx === null || idx === undefined || idx < 0) return "";
      const key = idx;
      posities[key] = (posities[key] || 0) + 1;
      const stackOffset = (posities[key] - 1) * 14;
      const left = (idx / (labels.length - 1)) * 100;
      return `<span class="as-dot" title="${escapeHtml(t.teamName)}" style="left:${left}%; top:calc(50% + ${stackOffset}px); background:${teamColor(t.id)}"></span>`;
    })
    .join("");

  return `
    <div class="as-blok">
      <p class="as-titel">${escapeHtml(titel)}</p>
      <div class="as-track">${dots}</div>
      <div class="as-labels">${labels.map((l) => `<span>${escapeHtml(l)}</span>`).join("")}</div>
    </div>
  `;
}

function renderVergelijking() {
  const el = document.getElementById("vergelijking-inhoud");
  if (!config) {
    el.innerHTML = "<p>Bezig met laden…</p>";
    return;
  }

  const standLabels = config.knobStanden.map((s) => config.knobLabels[s]);
  const stellingenHtml = config.stellingen
    .map((stelling, idx) =>
      renderAs(`${idx + 1}. ${stelling}`, standLabels, (t) => {
        const v = t.room1.answers && t.room1.answers[`knop${idx + 1}`];
        return v ? config.knobStanden.indexOf(v) : null;
      })
    )
    .join("");

  const liftLabels = config.liftVerdiepingen.map((f) => config.liftLabels[f]);
  const liftNuHtml = renderAs("Waar staan we nu?", liftLabels, (t) => {
    const v = t.room2.answers && t.room2.answers.nu;
    return v ? config.liftVerdiepingen.indexOf(v) : null;
  });
  const liftToekomstHtml = renderAs("Waar staan we in 2029?", liftLabels, (t) => {
    const v = t.room2.answers && t.room2.answers.toekomst;
    return v ? config.liftVerdiepingen.indexOf(v) : null;
  });

  el.innerHTML = `
    ${renderLegenda()}
    <h2>Stellingen (kamer 1)</h2>
    ${stellingenHtml}
    <h2>Positie in de lift (kamer 2)</h2>
    ${liftNuHtml}
    ${liftToekomstHtml}
  `;
}

function renderGezamenlijkResultaat(gezamenlijk) {
  const el = document.getElementById("gezamenlijk-inhoud");
  if (!gezamenlijk) {
    el.innerHTML = '<p class="gezamenlijk-leeg">Nog niet gemaakt. Klik op de knop hierboven zodra alle (of genoeg) teams klaar zijn.</p>';
    return;
  }
  el.innerHTML = `
    <div class="gezamenlijk-poster-wrap">
      <div class="kluis-poster" id="gezamenlijk-poster">${posterHtml(gezamenlijk.image)}</div>
      <div class="gezamenlijk-acties">
        <button type="button" class="btn-secondary" id="btn-gezamenlijk-beamer">Beamerformaat</button>
        <button type="button" class="btn-secondary" id="btn-gezamenlijk-download">Download als PNG</button>
      </div>
      <p class="gezamenlijk-bron">${gezamenlijk.source === "fallback" ? "Automatisch opgebouwd uit alle antwoorden." : "Gegenereerd door AI."} — ${new Date(gezamenlijk.generatedAt).toLocaleString("nl-NL")}</p>
    </div>
  `;
  document.getElementById("btn-gezamenlijk-beamer").addEventListener("click", () => openBeamer(gezamenlijk.image));
  document.getElementById("btn-gezamenlijk-download").addEventListener("click", () => downloadPosterAsPng(gezamenlijk.image, "gezamenlijk"));
}

async function laadGezamenlijk() {
  const el = document.getElementById("gezamenlijk-inhoud");
  el.innerHTML = "<p>Bezig met laden…</p>";
  try {
    const res = await AdminAPI.getGezamenlijk();
    renderGezamenlijkResultaat(res.gezamenlijk);
  } catch (e) {
    el.innerHTML = '<p class="gezamenlijk-leeg">Kon niet laden.</p>';
  }
}

function wireGezamenlijkKnop() {
  document.getElementById("btn-gezamenlijk-maken").addEventListener("click", async () => {
    const btn = document.getElementById("btn-gezamenlijk-maken");
    const el = document.getElementById("gezamenlijk-inhoud");
    btn.disabled = true;
    el.innerHTML = "<p>De teams worden samengevoegd tot één toekomstbeeld…</p>";
    try {
      const res = await AdminAPI.maakGezamenlijk();
      renderGezamenlijkResultaat(res.gezamenlijk);
    } catch (e) {
      el.innerHTML = '<p class="gezamenlijk-leeg">Het maken van het gezamenlijke beeld is mislukt. Probeer het opnieuw.</p>';
    } finally {
      btn.disabled = false;
    }
  });
}

async function ververs() {
  try {
    const res = await AdminAPI.getTeams();
    teams = res.teams;
    renderTeamsTable();
    if (!document.querySelector('.regie-paneel[data-paneel="vergelijking"]').hidden) {
      renderVergelijking();
    }
  } catch (e) {
    if (e.message && e.message.includes("401")) {
      stopPolling();
      showLogin();
    }
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(ververs, 4000);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function startApp() {
  if (!config) {
    config = await API.getConfig();
  }
  await ververs();
  startPolling();
}

async function init() {
  wireLogin();
  wireTabs();
  wireBeamer();
  wireGezamenlijkKnop();

  try {
    await AdminAPI.check();
    showApp();
    startApp();
  } catch (e) {
    showLogin();
  }
}

init();
