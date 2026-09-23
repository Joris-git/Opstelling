import API from "./api.js";
import {
  saveLocalTeamRef,
  loadLocalTeamRef,
  clearLocalTeamRef,
  saveLocalAnswers,
  loadLocalAnswers,
} from "./storage.js";
import { createCountdown, formatTime } from "./timer.js";
import * as sound from "./sound.js";
import { debounce, countWords } from "./util.js";
import { roomDefs } from "./rooms.js";
import { renderKluisLoading, renderKluisResult, renderKluisError, downloadPosterAsPng } from "./kluis.js";

const state = {
  config: null,
  team: null,
  currentTimer: null,
  totalTimer: null,
  currentRoomNumber: null,
};

const ADJ = [
  "Nachtelijke", "Stille", "Vurige", "Scherpe", "Digitale", "Verborgen",
  "Snelle", "Wakkere", "Gedurfde", "Heldere", "Eigenwijze", "Nuchtere",
];
const NOUN = [
  "Signalen", "Architecten", "Sluiswachters", "Vonken", "Verkenners",
  "Codebrekers", "Pioniers", "Cowboys", "Navigators", "Grensverleggers",
];
function generateTeamName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${n}`;
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.hidden = el.dataset.screen !== name;
  });
}

function showTopbar(team) {
  document.getElementById("topbar-missie-info").hidden = false;
  document.getElementById("topbar-team").textContent = team.teamName;
  document.getElementById("topbar-code").textContent = team.resumeCode;
}

function stopCurrentTimer() {
  if (state.currentTimer) {
    state.currentTimer.stop();
    state.currentTimer = null;
  }
}

function startTotalTimer(team) {
  if (state.totalTimer) state.totalTimer.stop();
  const totalTimerEl = document.getElementById("topbar-timer");
  const t = createCountdown({
    startedAtIso: team.totalStartedAt,
    durationSec: state.config.totalDurationSec,
    onTick: (remaining) => {
      totalTimerEl.textContent = formatTime(remaining);
    },
  });
  t.start();
  state.totalTimer = t;
}

function transitionTo(done) {
  const overlay = document.getElementById("transition-overlay");
  overlay.classList.add("active");
  sound.playDoorOpen();
  setTimeout(() => {
    done();
    setTimeout(() => overlay.classList.remove("active"), 60);
  }, 550);
}

function wireMuteButton() {
  const btn = document.getElementById("mute-btn");
  const icon = document.getElementById("mute-icon");
  function reflect() {
    const m = sound.isMuted();
    btn.setAttribute("aria-pressed", String(m));
    icon.textContent = m ? "🔇" : "🔊";
  }
  btn.addEventListener("click", () => {
    sound.setMuted(!sound.isMuted());
    reflect();
  });
  reflect();
}

function wireIntro() {
  const cover = document.getElementById("launch-cover");
  const launchBtn = document.getElementById("launch-btn");
  let opened = false;

  function openCover() {
    if (opened) return;
    opened = true;
    sound.initAudio();
    cover.classList.add("open");
    launchBtn.disabled = false;
    sound.playSwitchFlip();
  }

  cover.addEventListener("click", openCover);
  cover.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openCover();
    }
  });
  cover.tabIndex = 0;

  launchBtn.addEventListener("click", () => {
    if (launchBtn.disabled) return;
    sound.initAudio();
    sound.playLaunchThud();
    launchBtn.disabled = true;
    runCountdown();
  });
}

function runCountdown() {
  const overlay = document.getElementById("countdown-overlay");
  const numEl = document.getElementById("countdown-number");
  overlay.hidden = false;
  let n = 3;
  numEl.textContent = String(n);
  sound.playCountdownBeep();
  const iv = setInterval(() => {
    n -= 1;
    if (n <= 0) {
      clearInterval(iv);
      overlay.hidden = true;
      runBootSequence();
      return;
    }
    numEl.textContent = String(n);
    sound.playCountdownBeep();
  }, 800);
}

const BOOT_LINES = [
  "> Verbinding met 2029 stabiliseren...",
  "> Protocollen laden...",
  "> Toegang verifiëren...",
  "> Systemen online.",
];

function runBootSequence() {
  const overlay = document.getElementById("boot-overlay");
  const linesEl = document.getElementById("boot-lines");
  overlay.hidden = false;
  linesEl.textContent = "";
  let i = 0;
  const iv = setInterval(() => {
    if (i >= BOOT_LINES.length) {
      clearInterval(iv);
      setTimeout(() => {
        overlay.hidden = true;
        showScreen("teamnaam");
      }, 500);
      return;
    }
    linesEl.textContent += (i > 0 ? "\n" : "") + BOOT_LINES[i];
    sound.playClick();
    i += 1;
  }, 450);
}

function wireTeamnaamScreen() {
  const input = document.getElementById("teamnaam-input");

  document.getElementById("btn-genereer-naam").addEventListener("click", () => {
    input.value = generateTeamName();
    sound.playClick();
  });

  document.getElementById("btn-start-missie").addEventListener("click", async () => {
    const naam = input.value.trim() || generateTeamName();
    const startBtn = document.getElementById("btn-start-missie");
    startBtn.disabled = true;
    try {
      const res = await API.startTeam(naam);
      state.team = res.team;
      saveLocalTeamRef(state.team);
      showTopbar(state.team);
      startTotalTimer(state.team);

      document.getElementById("hervat-code-weergave").textContent = state.team.resumeCode;
      document.getElementById("hervat-link-weergave").value =
        `${window.location.origin}/hervat/${state.team.resumeCode}`;
      document.getElementById("hervat-info").hidden = false;
      document.querySelector(".teamnaam-form").hidden = true;
      startBtn.hidden = true;
      sound.playSuccess();
    } catch (e) {
      alert("Er ging iets mis bij het starten. Probeer het nog eens.");
      startBtn.disabled = false;
    }
  });

  document.getElementById("btn-kopieer-link").addEventListener("click", async () => {
    const val = document.getElementById("hervat-link-weergave").value;
    try {
      await navigator.clipboard.writeText(val);
      sound.playClick();
    } catch (e) {
      /* klembord niet beschikbaar: gebruiker kan de tekst zelf selecteren */
    }
  });

  document.getElementById("btn-naar-kamer1").addEventListener("click", () => {
    transitionTo(() => enterRoom(1));
  });
}

async function enterRoom(n) {
  stopCurrentTimer();
  const def = roomDefs[n];
  state.currentRoomNumber = n;
  document.body.dataset.theme = def.theme;
  showScreen("kamer");

  const kamerSection = document.getElementById("screen-kamer");
  kamerSection.classList.remove("kamer--alarm", "kamer--tijdop");
  document.getElementById("kamer-titel").textContent = `Kamer ${n} — ${def.title}`;
  document.getElementById("kamer-hint").textContent = def.hint;

  const alarmBanner = document.getElementById("alarm-banner");
  const alarmTekst = document.getElementById("alarm-tekst");
  alarmBanner.hidden = true;

  const advanceBtn = document.getElementById("btn-kamer-verder");
  advanceBtn.textContent = def.advanceLabel;
  advanceBtn.disabled = true;

  let team = state.team;
  const roomKey = `room${n}`;
  if (!team[roomKey].startedAt) {
    const res = await API.startRoom(team.id, n);
    team = res.team;
    state.team = team;
  }

  const localCached = loadLocalAnswers(team.id, n);
  const initialAnswers = localCached || team[roomKey].answers;

  let roomComplete = def.isComplete(initialAnswers);
  let timeUp = false;

  function refreshAdvanceState() {
    advanceBtn.disabled = !(roomComplete || timeUp);
  }
  refreshAdvanceState();

  const debouncedSave = debounce((answers) => {
    API.saveRoom(team.id, n, answers)
      .then((res) => {
        state.team = res.team;
      })
      .catch(() => {
        /* server tijdelijk niet bereikbaar: lokale kopie blijft bewaard */
      });
  }, 500);

  function handleChange(answers) {
    saveLocalAnswers(team.id, n, answers);
    debouncedSave(answers);
    roomComplete = def.isComplete(answers);
    refreshAdvanceState();
  }

  const content = document.getElementById("kamer-inhoud");
  def.render(content, {
    initialAnswers,
    config: state.config,
    onChange: handleChange,
    sound,
    teamId: team.id,
  });

  const durationSec = state.config.roomDurationsSec[n];
  const timerEl = document.getElementById("kamer-timer");
  const timer = createCountdown({
    startedAtIso: team[roomKey].startedAt,
    durationSec,
    onTick: (remaining) => {
      timerEl.textContent = formatTime(remaining);
    },
    onAlarmStart: () => {
      kamerSection.classList.add("kamer--alarm");
      alarmBanner.hidden = false;
      alarmTekst.textContent = "Nog 1 minuut!";
      sound.startAlarm();
    },
    onTimeUp: () => {
      sound.stopAlarm();
      kamerSection.classList.add("kamer--tijdop");
      alarmTekst.textContent = "Tijd is om — jullie kunnen gewoon doorgaan";
      timeUp = true;
      refreshAdvanceState();
    },
  });
  timer.start();
  state.currentTimer = timer;

  advanceBtn.onclick = async () => {
    timer.stop();
    sound.stopAlarm();
    advanceBtn.disabled = true;
    try {
      const res = await API.completeRoom(team.id, n);
      state.team = res.team;
    } catch (e) {
      /* opslaan mislukt: toch doorgaan, lokale voortgang blijft bewaard */
    }
    if (n < 4) {
      transitionTo(() => enterRoom(n + 1));
    } else {
      transitionTo(() => enterTijdcapsule());
    }
  };
}

function updateTijdcapsuleCounter() {
  const input = document.getElementById("tijdcapsule-input");
  const counter = document.getElementById("tijdcapsule-counter");
  const n = countWords(input.value);
  counter.textContent = `${n} van 50 woorden`;
  counter.classList.toggle("over-limiet", n > 50);
}

function wireTijdcapsuleScreen() {
  const input = document.getElementById("tijdcapsule-input");
  input.addEventListener("input", updateTijdcapsuleCounter);

  document.getElementById("btn-tijdcapsule-verder").addEventListener("click", async () => {
    const btn = document.getElementById("btn-tijdcapsule-verder");
    btn.disabled = true;
    try {
      const res = await API.saveTijdcapsule(state.team.id, input.value.trim());
      state.team = res.team;
    } catch (e) {
      /* opslaan mislukt: toch doorgaan */
    }
    btn.disabled = false;
    transitionTo(() => enterKluis());
  });
}

function enterTijdcapsule() {
  stopCurrentTimer();
  document.body.dataset.theme = "tijdcapsule";
  showScreen("tijdcapsule");
  const input = document.getElementById("tijdcapsule-input");
  input.value = state.team.tijdcapsule || "";
  updateTijdcapsuleCounter();
}

async function enterKluis() {
  stopCurrentTimer();
  document.body.dataset.theme = "kluis";
  showScreen("kluis");
  const content = document.getElementById("kluis-inhoud");

  function renderResult() {
    renderKluisResult(content, state.team.futureImage, {
      source: state.team.futureSource,
      onFullscreen: () => {
        const poster = document.getElementById("kluis-poster");
        if (poster && poster.requestFullscreen) poster.requestFullscreen();
      },
      onDownloadPng: () => downloadPosterAsPng(state.team.futureImage, state.team.teamName),
      onPrint: () => window.print(),
      onRetry: doGenerate,
    });
  }

  async function doGenerate() {
    renderKluisLoading(content);
    try {
      const res = await API.genereerToekomstbeeld(state.team.id);
      state.team = res.team;
      sound.playSuccess();
      renderResult();
    } catch (e) {
      renderKluisError(content, { onRetry: doGenerate });
    }
  }

  if (state.team.futureImage) {
    renderResult();
  } else {
    await doGenerate();
  }
}

async function init() {
  state.config = await API.getConfig();
  wireMuteButton();
  wireTeamnaamScreen();
  wireTijdcapsuleScreen();

  const path = window.location.pathname;
  const hervatMatch = path.match(/^\/hervat\/(.+)$/);

  let team = null;
  if (hervatMatch) {
    try {
      const res = await API.resumeByCode(decodeURIComponent(hervatMatch[1]));
      team = res.team;
    } catch (e) {
      /* ongeldige hervatcode: gewoon bij het begin starten */
    }
  }
  if (!team) {
    const ref = loadLocalTeamRef();
    if (ref) {
      try {
        const res = await API.getTeam(ref.id);
        team = res.team;
      } catch (e) {
        clearLocalTeamRef();
      }
    }
  }

  if (team) {
    state.team = team;
    saveLocalTeamRef(team);
    window.history.replaceState({}, "", "/");
    showTopbar(team);
    startTotalTimer(team);
    if (team.currentRoom >= 1 && team.currentRoom <= 4) {
      enterRoom(team.currentRoom);
    } else if (!team.futureImage && (team.tijdcapsule === null || team.tijdcapsule === undefined)) {
      enterTijdcapsule();
    } else {
      enterKluis();
    }
    return;
  }

  showScreen("intro");
  wireIntro();
}

init();
