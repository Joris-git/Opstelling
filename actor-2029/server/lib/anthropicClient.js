const Anthropic = require("@anthropic-ai/sdk");
const { buildPrompt, buildGezamenlijkPrompt, SYSTEM_PROMPT } = require("./aiPrompt");
const { sanitizeSvg } = require("./svgSanitize");
const { clampString } = require("./validate");

const TOEKOMSTBEELD_TOOL = {
  name: "lever_toekomstbeeld",
  description: "Lever het toekomstbeeld van Actor in 2029 als gestructureerde data.",
  input_schema: {
    type: "object",
    properties: {
      kop: {
        type: "string",
        description: "Een scherpe krantenkop over Actor in 2029, ongeveer 6-14 woorden.",
      },
      scene: {
        type: "string",
        description: "Een levendige scène van 120 tot 160 woorden, met een verrassende invalshoek.",
      },
      artefact: {
        type: "string",
        description: "Een kort voorwerp of document uit 2029 (bijv. een agenda, pushmelding, vacaturetekst), maximaal 60 woorden.",
      },
      route: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        description: "Drie concrete stappen: binnen 3 maanden, 2027, 2029.",
        items: {
          type: "object",
          properties: {
            titel: { type: "string", description: "Maximaal 6 woorden." },
            actie: { type: "string", description: "Maximaal 22 woorden, concreet en gebaseerd op de antwoorden." },
          },
          required: ["titel", "actie"],
        },
      },
      grens: {
        type: "string",
        description: "Wat mensenwerk blijft, maximaal 15 woorden.",
      },
      svg: {
        type: "string",
        description: "Een veilige, zelfstandige full-screen SVG-illustratie zoals beschreven in de systeeminstructie.",
      },
    },
    required: ["kop", "scene", "artefact", "route", "grens", "svg"],
  },
};

function normaliseerRoute(route) {
  const arr = Array.isArray(route) ? route.slice(0, 3) : [];
  while (arr.length < 3) arr.push({ titel: "Stap", actie: "" });
  return arr.map((stap) => ({
    titel: clampString(stap && stap.titel, 80) || "Stap",
    actie: clampString(stap && stap.actie, 220),
  }));
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function roepClaudeAanMetTool(prompt, { timeoutMs, standaardKop }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Geen ANTHROPIC_API_KEY ingesteld.");

  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 });

  const call = client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    tools: [TOEKOMSTBEELD_TOOL],
    tool_choice: { type: "tool", name: "lever_toekomstbeeld" },
  });

  const response = await withTimeout(call, timeoutMs, "AI-aanroep duurde te lang.");

  const toolUse = (response.content || []).find(
    (block) => block.type === "tool_use" && block.name === "lever_toekomstbeeld"
  );
  if (!toolUse || !toolUse.input) {
    throw new Error("Geen bruikbaar antwoord van de AI ontvangen.");
  }

  const raw = toolUse.input;
  const svgSafe = sanitizeSvg(raw.svg);
  if (!svgSafe) {
    throw new Error("De SVG-illustratie van de AI kon niet veilig worden gevalideerd.");
  }

  return {
    kop: clampString(raw.kop, 200) || standaardKop,
    scene: clampString(raw.scene, 1600),
    artefact: clampString(raw.artefact, 500),
    route: normaliseerRoute(raw.route),
    grens: clampString(raw.grens, 300),
    svg: svgSafe,
  };
}

async function genereerToekomstbeeldMetAI(team, { timeoutMs = 60000 } = {}) {
  const prompt = buildPrompt(team);
  return roepClaudeAanMetTool(prompt, { timeoutMs, standaardKop: `Actor in 2029: ${team.teamName}` });
}

async function genereerGezamenlijkToekomstbeeldMetAI(teams, { timeoutMs = 60000 } = {}) {
  const prompt = buildGezamenlijkPrompt(teams);
  return roepClaudeAanMetTool(prompt, { timeoutMs, standaardKop: "Actor in 2029" });
}

module.exports = { genereerToekomstbeeldMetAI, genereerGezamenlijkToekomstbeeldMetAI };
