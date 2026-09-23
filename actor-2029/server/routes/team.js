const express = require("express");
const db = require("../db");
const { clampString, countWords } = require("../lib/validate");
const {
  KNOB_STANDEN,
  LIFT_VERDIEPINGEN,
  ARCHIEF_KEUZES,
  LAB_WOORDEN,
} = require("../lib/gameData");

const router = express.Router();

function sanitizeRoom1(input) {
  const answers = {};
  for (let i = 1; i <= 6; i += 1) {
    const key = `knop${i}`;
    const val = input && input[key];
    answers[key] = KNOB_STANDEN.includes(val) ? val : null;
  }
  return answers;
}

function sanitizeRoom2(input) {
  const nu = input && LIFT_VERDIEPINGEN.includes(input.nu) ? input.nu : null;
  const toekomst = input && LIFT_VERDIEPINGEN.includes(input.toekomst) ? input.toekomst : null;
  return { nu, toekomst };
}

function sanitizeRoom3(input) {
  const q3 = input && input.q3 ? input.q3 : {};
  return {
    q1: clampString(input && input.q1, 300),
    q2: clampString(input && input.q2, 300),
    q3: {
      keuze: ARCHIEF_KEUZES.includes(q3.keuze) ? q3.keuze : null,
      toelichting: clampString(q3.toelichting, 200),
    },
    q4: clampString(input && input.q4, 300),
    q5: clampString(input && input.q5, 120),
  };
}

function sanitizeRoom4(input) {
  const raw = Array.isArray(input && input.woorden) ? input.woorden : [];
  const woorden = raw.filter((w) => LAB_WOORDEN.includes(w)).slice(0, 3);
  return { woorden };
}

const SANITIZERS = { 1: sanitizeRoom1, 2: sanitizeRoom2, 3: sanitizeRoom3, 4: sanitizeRoom4 };

router.post("/start", (req, res) => {
  const teamName = clampString(req.body && req.body.teamName, 60) || "Naamloos team";
  const isTest = !!(req.body && req.body.isTest);
  const team = db.createTeam(teamName, isTest);
  res.json({ team });
});

router.get("/resume/:code", (req, res) => {
  const team = db.getTeamByResumeCode(req.params.code.trim());
  if (!team) return res.status(404).json({ error: "Hervatcode niet gevonden." });
  res.json({ team });
});

router.get("/:id", (req, res) => {
  const team = db.getTeamById(req.params.id);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });
  res.json({ team });
});

router.post("/:id/room/:roomNumber/start", (req, res) => {
  const roomNumber = Number(req.params.roomNumber);
  if (![1, 2, 3, 4].includes(roomNumber)) return res.status(400).json({ error: "Ongeldige kamer." });
  const team = db.startRoom(req.params.id, roomNumber);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });
  res.json({ team });
});

router.post("/:id/room/:roomNumber/save", (req, res) => {
  const roomNumber = Number(req.params.roomNumber);
  const sanitize = SANITIZERS[roomNumber];
  if (!sanitize) return res.status(400).json({ error: "Ongeldige kamer." });
  const answers = sanitize(req.body && req.body.answers);
  const team = db.saveRoomAnswers(req.params.id, roomNumber, answers);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });
  res.json({ team });
});

router.post("/:id/tijdcapsule", (req, res) => {
  const tekst = clampString(req.body && req.body.tekst, 400);
  const team = db.saveTijdcapsule(req.params.id, tekst);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });
  res.json({ team });
});

router.post("/:id/room/:roomNumber/complete", (req, res) => {
  const roomNumber = Number(req.params.roomNumber);
  if (![1, 2, 3, 4].includes(roomNumber)) return res.status(400).json({ error: "Ongeldige kamer." });
  const team = db.completeRoom(req.params.id, roomNumber);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });
  res.json({ team });
});

module.exports = { router, countWords };
