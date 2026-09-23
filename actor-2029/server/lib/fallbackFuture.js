const { LIFT_LABELS, ARCHIEF_KEUZE_LABELS } = require("./gameData");

const WOORD_KLEUR = {
  nuchter: "#64748b",
  ambitieus: "#f97316",
  menselijk: "#f472b6",
  snel: "#22d3ee",
  zorgvuldig: "#34d399",
  gedurfd: "#972345",
  verbindend: "#a78bfa",
  speels: "#facc15",
  trots: "#fb923c",
  eigenwijs: "#fb7185",
  rustig: "#38bdf8",
  scherp: "#e2e8f0",
};

function escapeXml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]));
}

function pick(value, fallback) {
  const v = typeof value === "string" ? value.trim() : "";
  return v.length > 0 ? v : fallback;
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 150, g: 150, b: 150 };
  const num = parseInt(m[1], 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mixColors(hexes) {
  const rgbs = hexes.map(hexToRgb);
  const avg = rgbs.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 }
  );
  const n = rgbs.length || 1;
  const toHex = (v) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${toHex(avg.r)}${toHex(avg.g)}${toHex(avg.b)}`;
}

function buildFallbackSvg(team, kop, artefact) {
  const woorden = (team.room4 && team.room4.answers && team.room4.answers.woorden) || [];
  const kleuren = woorden.length
    ? woorden.map((w) => WOORD_KLEUR[w] || "#972345")
    : ["#972345", "#1e293b", "#0ea5e9"];

  const kleurA = kleuren[0] || "#972345";
  const kleurB = kleuren[1] || mixColors(kleuren);
  const kleurC = kleuren[2] || kleuren[0] || "#0ea5e9";

  const nu = (team.room2 && team.room2.answers && team.room2.answers.nu) || null;
  const toekomst = (team.room2 && team.room2.answers && team.room2.answers.toekomst) || null;
  const nuLabel = nu ? LIFT_LABELS[nu] : "Verkennen";
  const toekomstLabel = toekomst ? LIFT_LABELS[toekomst] : "Meesterschap";

  const kopSafe = escapeXml(kop);
  const artefactSafe = escapeXml(artefact);
  const nuSafe = escapeXml(nuLabel);
  const toekomstSafe = escapeXml(toekomstLabel);

  return `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Toekomstbeeld Actor 2029">
    <defs>
      <linearGradient id="lucht" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${kleurA}" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="${kleurB}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#05060a" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="grond" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${kleurC}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#05060a" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="800" height="450" fill="#05060a"/>
    <rect x="0" y="0" width="800" height="300" fill="url(#lucht)"/>
    <rect x="0" y="300" width="800" height="150" fill="url(#grond)"/>

    <polygon points="400,120 470,300 330,300" fill="none" stroke="${kleurA}" stroke-width="3" opacity="0.45"/>
    <line x1="365" y1="245" x2="435" y2="245" stroke="${kleurA}" stroke-width="3" opacity="0.45"/>

    <g opacity="0.85">
      <rect x="120" y="230" width="18" height="70" fill="${kleurC}"/>
      <rect x="150" y="200" width="18" height="100" fill="${kleurB}"/>
      <rect x="180" y="160" width="18" height="140" fill="${kleurA}"/>
      <text x="120" y="320" font-family="monospace" font-size="12" fill="#cbd5e1">${nuSafe} → ${toekomstSafe}</text>
    </g>

    <text x="400" y="70" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#f1f5f9">${kopSafe}</text>

    <g transform="translate(560,330)">
      <rect x="0" y="0" width="200" height="80" rx="6" fill="#0b1220" stroke="${kleurA}" stroke-width="1.5" opacity="0.9"/>
      <text x="14" y="24" font-family="monospace" font-size="11" fill="${kleurA}">ARTEFACT 2029</text>
      <text x="14" y="44" font-family="monospace" font-size="10" fill="#cbd5e1">${artefactSafe.slice(0, 90)}</text>
    </g>
  </svg>`;
}

function buildFallbackFuture(team, gameData) {
  const room2 = (team.room2 && team.room2.answers) || {};
  const room3 = (team.room3 && team.room3.answers) || {};
  const room4 = (team.room4 && team.room4.answers) || {};

  const toekomstLabel = room2.toekomst ? LIFT_LABELS[room2.toekomst] : "meesterschap";
  const eersteWerk = pick(room3.q1, "het opstellen van eerste concepten voor verslagen en advies");
  const nooitAI = pick(room3.q2, "het laatste woord bij een gevoelig bestuurlijk vraagstuk");
  const grootsteRem = room3.q3 && room3.q3.keuze ? ARCHIEF_KEUZE_LABELS[room3.q3.keuze] : "tijd";
  const experiment = pick(room3.q4, "een AI-concept laten meelezen voordat het naar het bestuur gaat");
  const krantenkop = pick(room3.q5, `Actor bereikt in 2029 het niveau ${toekomstLabel}`);
  const woorden = Array.isArray(room4.woorden) && room4.woorden.length ? room4.woorden : ["nuchter", "ambitieus", "verbindend"];

  const kop = krantenkop;

  const scene = `Het is dinsdagochtend, 2029, kwart voor negen bij Actor. Op elk scherm draait rustig een concept-advies dat AI ’s nachts heeft voorbereid — ${eersteWerk} staat er al, wachtend op een mens die het scherper maakt. Een adviseur leest het door met een kop koffie, streept twee zinnen weg en belt een bestuurder: niet om iets uit te leggen, maar om te toetsen of het klopt met wat er speelt. Dat gesprek is nog altijd van mensen. Ergens in het gebouw wordt ${nooitAI} juist expres niet aan AI overgelaten — dat is een lijn die niemand hier meer ter discussie stelt. Actor is verschoven naar ${toekomstLabel.toLowerCase()}, met een team dat ${woorden.join(", ")} is geworden. Het voelt niet als een revolutie. Het voelt als dinsdag.`;

  const artefact = `Interne pushmelding, 07:52 uur: "Conceptversie klaar — ${eersteWerk}. Controleer toon en oordeel voor verzending." Ondertekend: het redactiesysteem van Actor.`;

  const route = [
    {
      titel: "Binnen 3 maanden",
      actie: `${experiment} wordt de vaste eerste stap in ons werkproces.`,
    },
    {
      titel: "2027",
      actie: `We hebben ${grootsteRem.toLowerCase()} structureel aangepakt, zodat AI breed en veilig wordt gebruikt.`,
    },
    {
      titel: "2029",
      actie: `Actor werkt op het niveau ${toekomstLabel.toLowerCase()}; AI is vanzelfsprekend, oordeel blijft mensenwerk.`,
    },
  ];

  const grens = `Het echte gesprek met een bestuurder — ${nooitAI.toLowerCase()} — blijft altijd mensenwerk.`;

  const svg = buildFallbackSvg(team, kop, artefact);

  return { kop, scene, artefact, route, grens, svg };
}

function buildFallbackGezamenlijk(teams, gameData) {
  const bruikbareTeams = teams.filter(
    (t) => t.room1.answers || t.room2.answers || t.room3.answers || t.room4.answers
  );
  const n = bruikbareTeams.length || teams.length;

  const woordCounts = {};
  bruikbareTeams.forEach((t) => {
    const woorden = (t.room4 && t.room4.answers && t.room4.answers.woorden) || [];
    woorden.forEach((w) => {
      woordCounts[w] = (woordCounts[w] || 0) + 1;
    });
  });
  const topWoorden = Object.entries(woordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);

  const toekomstCounts = {};
  bruikbareTeams.forEach((t) => {
    const f = t.room2 && t.room2.answers && t.room2.answers.toekomst;
    if (f) toekomstCounts[f] = (toekomstCounts[f] || 0) + 1;
  });
  const meestGekozenFloor = Object.entries(toekomstCounts).sort((a, b) => b[1] - a[1])[0];
  const toekomstLabel = meestGekozenFloor ? LIFT_LABELS[meestGekozenFloor[0]] : "meesterschap";

  const kop = `${n} teams bij Actor kiezen richting ${toekomstLabel.toLowerCase()} in 2029`;

  const scene = `Alle ${n} teams stapten dezelfde escaperoom uit, maar niet met hetzelfde verhaal. De een zag Actor in 2029 als een plek waar AI het meeste voorwerk doet; de ander bleef genuanceerder. Wat opvalt: bijna iedereen noemt ${topWoorden.length ? topWoorden.join(", ") : "eenzelfde soort woorden"} als sfeer voor de toekomst — dat is geen toeval. De verschillen zitten 'm niet in de richting, maar in het tempo: sommigen willen morgen beginnen, anderen eerst de basis op orde. Precies die spanning maakt 2029 interessant: geen uniforme koers van bovenaf, maar meerdere teams die vanuit hun eigen werk naar hetzelfde punt toe bewegen.`;

  const artefact = `Interne notitie, gedeeld na de sessie: "${n} teams, evenveel routes, één richting: ${toekomstLabel.toLowerCase()}. Verschillen zijn geen probleem — ze zijn de planning."`;

  const route = [
    {
      titel: "Binnen 3 maanden",
      actie: "De losse experimenten van alle teams worden gedeeld op één centrale plek.",
    },
    {
      titel: "2027",
      actie: `De teams die voorop lopen richting ${toekomstLabel.toLowerCase()} trekken de rest mee.`,
    },
    {
      titel: "2029",
      actie: `Actor werkt organisatiebreed op het niveau ${toekomstLabel.toLowerCase()}, in ieders eigen tempo gegroeid.`,
    },
  ];

  const grens = "Het gesprek over wát we willen, blijft altijd van de mensen die het samen bepalen.";

  const svg = buildFallbackSvg(
    { room4: { answers: { woorden: topWoorden } }, room2: { answers: { nu: "verkennen", toekomst: meestGekozenFloor ? meestGekozenFloor[0] : "meesterschap" } } },
    kop,
    artefact
  );

  return { kop, scene, artefact, route, grens, svg };
}

module.exports = { buildFallbackFuture, buildFallbackGezamenlijk, escapeXml };
