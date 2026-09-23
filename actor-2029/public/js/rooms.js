import { escapeHtml, countWords, digitForQuestion } from "./util.js";

const ANGLES = [-70, -35, 0, 35, 70];

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function createDial({ label, value, knobStanden, knobLabels, onChange, sound }) {
  const wrap = document.createElement("div");
  wrap.className = "dial-unit";

  let index = knobStanden.indexOf(value);
  if (index < 0) index = -1;

  wrap.innerHTML = `
    <div class="lamp" data-lamp aria-hidden="true"></div>
    <div class="dial" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="4"
         aria-label="${escapeHtml(label)}" aria-valuetext="Nog niet gezet">
      <div class="dial-face">
        <div class="dial-pointer"></div>
        <div class="dial-hub"></div>
      </div>
      <div class="dial-ticks"></div>
    </div>
    <div class="dial-value">Nog niet gezet</div>
  `;

  const dialEl = wrap.querySelector(".dial");
  const pointerEl = wrap.querySelector(".dial-pointer");
  const valueEl = wrap.querySelector(".dial-value");
  const lampEl = wrap.querySelector("[data-lamp]");
  const ticksEl = wrap.querySelector(".dial-ticks");
  const faceEl = wrap.querySelector(".dial-face");

  knobStanden.forEach((stand, i) => {
    const p = polar(48, 48, 46, ANGLES[i]);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dial-tick";
    btn.style.left = `${p.x}px`;
    btn.style.top = `${p.y}px`;
    btn.title = knobLabels[stand];
    btn.setAttribute("aria-label", knobLabels[stand]);
    btn.addEventListener("click", () => setIndex(i, true));
    ticksEl.appendChild(btn);
  });

  function render() {
    const set = index >= 0;
    dialEl.classList.toggle("is-set", set);
    lampEl.classList.toggle("is-on", set);
    const angle = set ? ANGLES[index] : 0;
    pointerEl.style.transform = `rotate(${angle}deg)`;
    const labelTxt = set ? knobLabels[knobStanden[index]] : "Nog niet gezet";
    valueEl.textContent = labelTxt;
    dialEl.setAttribute("aria-valuetext", labelTxt);
    if (set) dialEl.setAttribute("aria-valuenow", String(index));
  }

  function setIndex(i, userAction) {
    const clamped = Math.max(0, Math.min(4, i));
    if (clamped === index) return;
    index = clamped;
    render();
    if (userAction) {
      if (sound) sound.playLampOn();
      onChange(knobStanden[index]);
    }
  }

  dialEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex(index < 0 ? 0 : index + 1, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setIndex(index < 0 ? 0 : index - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      setIndex(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      setIndex(4, true);
    }
  });

  let dragging = false;
  function angleFromEvent(clientX, clientY) {
    const rect = faceEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }
  function nearestIndexForAngle(deg) {
    let best = 0;
    let bestDiff = Infinity;
    ANGLES.forEach((a, i) => {
      const diff = Math.abs(a - deg);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    });
    return best;
  }
  faceEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    try { faceEl.setPointerCapture(e.pointerId); } catch (err) { /* negeren */ }
    dialEl.focus();
    setIndex(nearestIndexForAngle(angleFromEvent(e.clientX, e.clientY)), true);
  });
  faceEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setIndex(nearestIndexForAngle(angleFromEvent(e.clientX, e.clientY)), true);
  });
  faceEl.addEventListener("pointerup", (e) => {
    dragging = false;
    try { faceEl.releasePointerCapture(e.pointerId); } catch (err) { /* negeren */ }
  });

  render();
  return wrap;
}

export function renderKamer1(container, { initialAnswers, config, onChange, sound }) {
  const answers = Object.assign(
    { knop1: null, knop2: null, knop3: null, knop4: null, knop5: null, knop6: null },
    initialAnswers || {}
  );

  container.innerHTML = `
    <p class="kamer-intro">Zet elke knop op de stand die past bij hoe jullie erover denken. Slepen, klikken op een stand, of pijltjestoetsen — het werkt allemaal.</p>
    <div class="dial-grid" id="dial-grid"></div>
  `;
  const grid = container.querySelector("#dial-grid");

  config.stellingen.forEach((stelling, idx) => {
    const n = idx + 1;
    const key = `knop${n}`;
    const item = document.createElement("div");
    item.className = "dial-item";
    const p = document.createElement("p");
    p.className = "dial-stelling";
    p.textContent = `${n}. ${stelling}`;
    item.appendChild(p);
    const dial = createDial({
      label: stelling,
      value: answers[key],
      knobStanden: config.knobStanden,
      knobLabels: config.knobLabels,
      sound,
      onChange: (val) => {
        answers[key] = val;
        onChange({ ...answers });
      },
    });
    item.appendChild(dial);
    grid.appendChild(item);
  });
}

export function isKamer1Compleet(answers) {
  if (!answers) return false;
  return [1, 2, 3, 4, 5, 6].every((n) => !!answers[`knop${n}`]);
}

export function renderKamer2(container, { initialAnswers, config, onChange, sound }) {
  const answers = Object.assign({ nu: null, toekomst: null }, initialAnswers || {});
  const floors = config.liftVerdiepingen;

  container.innerHTML = `
    <p class="kamer-intro">Kies waar Actor nu staat, en waar we in 2029 willen staan.</p>
    <div class="lift-wrap">
      <div class="lift-choices">
        <div class="lift-choice-col">
          <h3>Nu</h3>
          <div class="lift-buttons" data-target="nu"></div>
        </div>
        <div class="lift-choice-col">
          <h3>2029</h3>
          <div class="lift-buttons" data-target="toekomst"></div>
        </div>
      </div>
      <div class="lift-shaft" aria-hidden="true">
        <div class="lift-floors"></div>
        <div class="lift-car" id="lift-car"><span>2029</span></div>
      </div>
      <p class="lift-resultaat" id="lift-resultaat" aria-live="polite"></p>
    </div>
  `;

  const floorsEl = container.querySelector(".lift-floors");
  [...floors].reverse().forEach((f) => {
    const d = document.createElement("div");
    d.className = "lift-floor";
    d.textContent = config.liftLabels[f];
    floorsEl.appendChild(d);
  });

  function buildButtons(target) {
    const holder = container.querySelector(`.lift-buttons[data-target="${target}"]`);
    floors.forEach((f) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lift-btn";
      btn.textContent = config.liftLabels[f];
      btn.dataset.floor = f;
      btn.setAttribute("aria-pressed", String(answers[target] === f));
      if (answers[target] === f) btn.classList.add("is-selected");
      btn.addEventListener("click", () => {
        answers[target] = f;
        holder.querySelectorAll(".lift-btn").forEach((b) => {
          b.classList.toggle("is-selected", b.dataset.floor === f);
          b.setAttribute("aria-pressed", String(b.dataset.floor === f));
        });
        if (sound) sound.playClick();
        updateRide();
        onChange({ ...answers });
      });
      holder.appendChild(btn);
    });
  }
  buildButtons("nu");
  buildButtons("toekomst");

  const car = container.querySelector("#lift-car");
  const resultaatEl = container.querySelector("#lift-resultaat");

  function floorPositionPct(floor) {
    const idx = floors.indexOf(floor);
    if (idx < 0) return 100;
    return ((floors.length - 1 - idx) / (floors.length - 1)) * 100;
  }

  function updateRide() {
    if (!answers.nu || !answers.toekomst) {
      resultaatEl.textContent = "";
      return;
    }
    const nuIdx = floors.indexOf(answers.nu);
    const toekomstIdx = floors.indexOf(answers.toekomst);
    const diff = toekomstIdx - nuIdx;

    car.style.top = `${floorPositionPct(answers.nu)}%`;
    car.getBoundingClientRect();
    requestAnimationFrame(() => {
      car.style.transition = "top 1.6s cubic-bezier(.2,.7,.2,1)";
      car.style.top = `${floorPositionPct(answers.toekomst)}%`;
    });

    if (sound) sound.playDoorOpen();

    window.setTimeout(() => {
      if (diff > 0) {
        resultaatEl.textContent = `${diff} verdieping${diff === 1 ? "" : "en"} omhoog — van ${config.liftLabels[answers.nu]} naar ${config.liftLabels[answers.toekomst]}.`;
      } else if (diff < 0) {
        resultaatEl.textContent = `${Math.abs(diff)} verdieping${Math.abs(diff) === 1 ? "" : "en"} omlaag — van ${config.liftLabels[answers.nu]} naar ${config.liftLabels[answers.toekomst]}.`;
      } else {
        resultaatEl.textContent = `Jullie blijven op hetzelfde niveau: ${config.liftLabels[answers.nu]}.`;
      }
      if (sound) sound.playSuccess();
    }, 1700);
  }

  if (answers.nu) car.style.top = `${floorPositionPct(answers.nu)}%`;
  updateRide();
}

export function isKamer2Compleet(answers) {
  return !!(answers && answers.nu && answers.toekomst);
}

const ARCHIEF_VRAGEN = [
  { key: "q1", label: "Welk werk laten we AI als eerste structureel doen?", type: "textarea", maxLen: 300 },
  { key: "q2", label: "Wat doen we nooit met AI?", type: "textarea", maxLen: 300 },
  { key: "q3", label: "Wat houdt ons nu het meest tegen?", type: "keuze" },
  { key: "q4", label: "Welk experiment wordt binnen drie maanden onze standaard werkwijze?", type: "textarea", maxLen: 300 },
  { key: "q5", label: "De krantenkop over Actor in 2029 (max. 12 woorden)", type: "kop", maxLen: 120 },
];

function archiefAnswerFilled(answers, key) {
  if (key === "q3") return !!(answers.q3 && answers.q3.keuze);
  const v = answers[key];
  return typeof v === "string" && v.trim().length > 0;
}

export function renderKamer3(container, { initialAnswers, config, onChange, teamId }) {
  const answers = Object.assign(
    { q1: "", q2: "", q3: { keuze: null, toelichting: "" }, q4: "", q5: "" },
    initialAnswers || {}
  );
  if (!answers.q3) answers.q3 = { keuze: null, toelichting: "" };

  container.innerHTML = `
    <p class="kamer-intro">Elke beantwoorde vraag ontgrendelt één cijfer van de kluiscode.</p>
    <div class="archief-code" id="archief-code">
      ${[0, 1, 2, 3, 4].map((i) => `<span class="code-digit" data-i="${i}">?</span>`).join("")}
    </div>
    <div class="archief-vragen" id="archief-vragen"></div>
  `;

  const vragenEl = container.querySelector("#archief-vragen");

  function updateDigits() {
    ARCHIEF_VRAGEN.forEach((vraag, i) => {
      const filled = archiefAnswerFilled(answers, vraag.key);
      const span = container.querySelector(`.code-digit[data-i="${i}"]`);
      if (!span) return;
      if (filled) {
        span.textContent = String(digitForQuestion(teamId, i));
        span.classList.add("revealed");
      } else {
        span.textContent = "?";
        span.classList.remove("revealed");
      }
    });
  }

  ARCHIEF_VRAGEN.forEach((vraag) => {
    const item = document.createElement("div");
    item.className = "archief-item";
    const fieldId = `archief-${vraag.key}`;
    const heading = document.createElement(vraag.type === "keuze" ? "p" : "label");
    heading.className = "archief-label";
    heading.textContent = vraag.label;
    if (vraag.type !== "keuze") heading.setAttribute("for", fieldId);
    item.appendChild(heading);

    if (vraag.type === "textarea") {
      const ta = document.createElement("textarea");
      ta.id = fieldId;
      ta.className = "archief-input";
      ta.maxLength = vraag.maxLen;
      ta.value = answers[vraag.key] || "";
      ta.rows = 3;
      ta.addEventListener("input", () => {
        answers[vraag.key] = ta.value;
        updateDigits();
        onChange({ ...answers });
      });
      item.appendChild(ta);
    } else if (vraag.type === "kop") {
      const input = document.createElement("input");
      input.id = fieldId;
      input.type = "text";
      input.className = "archief-input";
      input.maxLength = vraag.maxLen;
      input.value = answers[vraag.key] || "";
      const counter = document.createElement("p");
      counter.className = "archief-counter";
      const updateCounter = () => {
        const n = countWords(input.value);
        counter.textContent = `${n} van 12 woorden`;
        counter.classList.toggle("over-limiet", n > 12);
      };
      input.addEventListener("input", () => {
        answers[vraag.key] = input.value;
        updateCounter();
        updateDigits();
        onChange({ ...answers });
      });
      item.appendChild(input);
      item.appendChild(counter);
      updateCounter();
    } else if (vraag.type === "keuze") {
      const keuzeWrap = document.createElement("div");
      keuzeWrap.className = "archief-keuzes";
      keuzeWrap.setAttribute("role", "group");
      keuzeWrap.setAttribute("aria-label", vraag.label);
      config.archiefKeuzes.forEach((k) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "archief-keuze-btn";
        btn.textContent = config.archiefKeuzeLabels[k];
        btn.setAttribute("aria-pressed", String(answers.q3.keuze === k));
        if (answers.q3.keuze === k) btn.classList.add("is-selected");
        btn.addEventListener("click", () => {
          answers.q3.keuze = k;
          keuzeWrap.querySelectorAll(".archief-keuze-btn").forEach((b) => {
            b.classList.toggle("is-selected", b.textContent === config.archiefKeuzeLabels[k]);
            b.setAttribute("aria-pressed", String(b.textContent === config.archiefKeuzeLabels[k]));
          });
          updateDigits();
          onChange({ ...answers });
        });
        keuzeWrap.appendChild(btn);
      });
      item.appendChild(keuzeWrap);

      const toelichting = document.createElement("input");
      toelichting.id = fieldId;
      toelichting.type = "text";
      toelichting.className = "archief-input";
      toelichting.maxLength = 200;
      toelichting.placeholder = "Toelichting in één zin";
      toelichting.setAttribute("aria-label", "Toelichting in één zin");
      toelichting.value = answers.q3.toelichting || "";
      toelichting.addEventListener("input", () => {
        answers.q3.toelichting = toelichting.value;
        onChange({ ...answers });
      });
      item.appendChild(toelichting);
    }

    vragenEl.appendChild(item);
  });

  updateDigits();
}

export function isKamer3Compleet(answers) {
  if (!answers) return false;
  return ARCHIEF_VRAGEN.every((v) => archiefAnswerFilled(answers, v.key));
}

export function renderKamer4(container, { initialAnswers, config, onChange, sound }) {
  const answers = Object.assign({ woorden: [] }, initialAnswers || {});
  if (!Array.isArray(answers.woorden)) answers.woorden = [];

  container.innerHTML = `
    <p class="kamer-intro">Kies precies drie woorden voor de sfeer van jullie toekomstbeeld.</p>
    <div class="lab-wrap">
      <div class="lab-woorden" id="lab-woorden"></div>
      <div class="reageerbuis">
        <div class="buis-glas"><div class="buis-vloeistof" id="buis-vloeistof"></div></div>
        <p class="buis-hint" id="buis-hint">0 van 3 gekozen</p>
      </div>
    </div>
  `;

  const woordenEl = container.querySelector("#lab-woorden");
  const buisEl = container.querySelector("#buis-vloeistof");
  const hintEl = container.querySelector("#buis-hint");

  const KLEUR = {
    nuchter: "#64748b", ambitieus: "#f97316", menselijk: "#f472b6", snel: "#22d3ee",
    zorgvuldig: "#34d399", gedurfd: "#972345", verbindend: "#a78bfa", speels: "#facc15",
    trots: "#fb923c", eigenwijs: "#fb7185", rustig: "#38bdf8", scherp: "#e2e8f0",
  };

  function updateBuis() {
    const kleuren = answers.woorden.map((w) => KLEUR[w] || "#972345");
    if (kleuren.length === 0) {
      buisEl.style.background = "transparent";
      buisEl.style.height = "6%";
    } else {
      buisEl.style.height = `${20 + kleuren.length * 25}%`;
      buisEl.style.background = `linear-gradient(180deg, ${kleuren.join(",")})`;
    }
    hintEl.textContent = `${answers.woorden.length} van 3 gekozen`;
  }

  function renderButtons() {
    woordenEl.innerHTML = "";
    config.labWoorden.forEach((w) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lab-woord-btn";
      btn.textContent = w;
      btn.style.setProperty("--woord-kleur", KLEUR[w] || "#972345");
      const selected = answers.woorden.includes(w);
      btn.classList.toggle("is-selected", selected);
      const disabled = !selected && answers.woorden.length >= 3;
      btn.disabled = disabled;
      btn.setAttribute("aria-pressed", String(selected));
      btn.addEventListener("click", () => {
        if (selected) {
          answers.woorden = answers.woorden.filter((x) => x !== w);
        } else if (answers.woorden.length < 3) {
          answers.woorden = [...answers.woorden, w];
        }
        if (sound) sound.playSwitchFlip();
        renderButtons();
        updateBuis();
        onChange({ ...answers });
      });
      woordenEl.appendChild(btn);
    });
  }

  renderButtons();
  updateBuis();
}

export function isKamer4Compleet(answers) {
  return !!(answers && Array.isArray(answers.woorden) && answers.woorden.length === 3);
}

export const roomDefs = {
  1: {
    title: "De Controlekamer",
    theme: "kamer1",
    advanceLabel: "Open de deur naar kamer 2",
    hint: "Zet alle zes knoppen om de deur te openen.",
    render: renderKamer1,
    isComplete: isKamer1Compleet,
  },
  2: {
    title: "De Lift",
    theme: "kamer2",
    advanceLabel: "Ga naar het Archief",
    hint: "Kies waar we nu staan én waar we in 2029 staan.",
    render: renderKamer2,
    isComplete: isKamer2Compleet,
  },
  3: {
    title: "Het Archief",
    theme: "kamer3",
    advanceLabel: "Open de toegang naar het Lab",
    hint: "Beantwoord alle vijf vragen om de kluiscode te ontgrendelen.",
    render: renderKamer3,
    isComplete: isKamer3Compleet,
  },
  4: {
    title: "Het Lab",
    theme: "kamer4",
    advanceLabel: "Ga naar de kluis",
    hint: "Kies precies drie woorden.",
    render: renderKamer4,
    isComplete: isKamer4Compleet,
  },
};
