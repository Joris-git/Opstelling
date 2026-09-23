const { KNOB_LABELS, STELLINGEN, LIFT_LABELS, ARCHIEF_KEUZE_LABELS } = require("./gameData");

function lijst(items) {
  return items.map((x) => `- ${x}`).join("\n");
}

function buildPrompt(team) {
  const r1 = (team.room1 && team.room1.answers) || {};
  const r2 = (team.room2 && team.room2.answers) || {};
  const r3 = (team.room3 && team.room3.answers) || {};
  const r4 = (team.room4 && team.room4.answers) || {};

  const stellingenLijst = STELLINGEN.map((stelling, idx) => {
    const stand = r1[`knop${idx + 1}`];
    const label = stand ? KNOB_LABELS[stand] : "(niet ingevuld)";
    return `${idx + 1}. "${stelling}" → ${label}`;
  }).join("\n");

  const nu = r2.nu ? LIFT_LABELS[r2.nu] : "(niet gekozen)";
  const toekomst = r2.toekomst ? LIFT_LABELS[r2.toekomst] : "(niet gekozen)";

  const q3keuze = r3.q3 && r3.q3.keuze ? ARCHIEF_KEUZE_LABELS[r3.q3.keuze] : "(niet gekozen)";
  const q3toelichting = (r3.q3 && r3.q3.toelichting) || "(geen toelichting)";

  const woorden = Array.isArray(r4.woorden) && r4.woorden.length ? r4.woorden.join(", ") : "(geen woorden gekozen)";

  const tijdcapsule = team.tijdcapsule && team.tijdcapsule.trim()
    ? team.tijdcapsule.trim()
    : "(geen boodschap achtergelaten)";

  return `
Team "${team.teamName}" speelde de Actor 2029-escaperoom en gaf de volgende antwoorden.

KAMER 1 — DE CONTROLEKAMER (stellingen over AI bij Actor):
${stellingenLijst}

KAMER 2 — DE LIFT (positie op de as Verkennen → Experimenteren → Toepassen → Verankeren → Meesterschap):
- Waar Actor nu staat: ${nu}
- Waar Actor in 2029 staat: ${toekomst}

KAMER 3 — HET ARCHIEF:
1. Welk werk laten we AI als eerste structureel doen? ${JSON.stringify(r3.q1 || "(niet ingevuld)")}
2. Wat doen we nooit met AI? ${JSON.stringify(r3.q2 || "(niet ingevuld)")}
3. Wat houdt ons nu het meest tegen? ${q3keuze} — toelichting: ${JSON.stringify(q3toelichting)}
4. Welk experiment wordt binnen drie maanden onze standaard werkwijze? ${JSON.stringify(r3.q4 || "(niet ingevuld)")}
5. Voorgestelde krantenkop van het team: ${JSON.stringify(r3.q5 || "(niet ingevuld)")}

KAMER 4 — HET LAB (drie sfeerwoorden voor de toon):
${woorden}

BONUS — BOODSCHAP AAN HET VERLEDEN (mag als speelse inspiratie gebruikt worden, hoeft niet letterlijk terug te komen):
${JSON.stringify(tijdcapsule)}

Maak op basis hiervan het toekomstbeeld via het gereedschap "lever_toekomstbeeld". Ga vrij en verrassend om met de antwoorden — het doel is een beeld dat het team laat lachen, schrikken of nadenken, geen samenvatting van hun antwoorden. Gebruik geen jargon, geen AI-hype-taal, en verzin geen namen van echte bestaande personen of klanten.`.trim();
}

const SYSTEM_PROMPT = `Je schrijft voor Actor | Partner in besturen, een organisatie die besturen van pensioenfondsen, sociale fondsen en cao-partijen ondersteunt (bestuurssecretariaat, beleidsadvies, uitvoering). Je maakt na afloop van een escaperoom-spel een kort, verrassend toekomstbeeld van Actor in 2029, gebaseerd op de antwoorden van een spelend team.

Schrijf in het Nederlands, stellig en warm, met een vleugje speelsheid. Geen jargon, geen "AI zal een revolutie ontketenen"-hype, geen zweverige taal. Gebruik geen namen van echte bestaande personen, bestuurders of klanten — verzin desnoods een functie of rol, nooit een naam die op een echt persoon kan slaan.

Voor het veld "svg": lever een geldige, volledig zelfstandige SVG-illustratie met viewBox="0 0 800 450" en xmlns="http://www.w3.org/2000/svg". Gebruik alleen basisvormen (rect, circle, ellipse, line, polyline, polygon, path, text, tspan, g, defs, linearGradient, radialGradient, stop). Gebruik uitsluitend presentatie-attributen (fill, stroke, opacity, transform, enzovoort) — nooit een style-attribuut, nooit <style>-tags. Geen <script>, geen event-attributen (onload, onclick, enzovoort), geen externe verwijzingen (geen <image>, geen href naar iets buiten de SVG zelf). Ontwerp een sfeervolle, wat mysterieuze illustratie die past bij een donker, futuristisch controlecentrum — denk aan een gestileerde horizon, gloeiende accenten, abstracte vormen — passend bij de sfeerwoorden en de scène die je beschrijft.`;

module.exports = { buildPrompt, SYSTEM_PROMPT };
