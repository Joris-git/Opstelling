const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const gameData = require("../lib/gameData");
const { buildFallbackGezamenlijk } = require("../lib/fallbackFuture");
const { genereerGezamenlijkToekomstbeeldMetAI } = require("../lib/anthropicClient");
const { createRateLimiter } = require("../lib/rateLimit");
const { toCsv } = require("../lib/csv");
const { requireAdmin, createToken, COOKIE_NAME, TOKEN_GELDIGHEID_MS } = require("../middleware/adminAuth");

const router = express.Router();

const loginRateLimit = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 20 });
const gezamenlijkRateLimit = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 });

router.post("/login", loginRateLimit, (req, res) => {
  const password = String((req.body && req.body.password) || "");
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is niet ingesteld op de server." });
  }

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return res.status(401).json({ error: "Onjuist wachtwoord." });

  const token = createToken();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: TOKEN_GELDIGHEID_MS,
  });
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/check", requireAdmin, (req, res) => res.json({ ok: true }));

router.get("/teams", requireAdmin, (req, res) => {
  res.json({ teams: db.listTeams() });
});

router.delete("/teams/:id", requireAdmin, (req, res) => {
  db.deleteTeam(req.params.id);
  res.json({ ok: true });
});

router.get("/export.json", requireAdmin, (req, res) => {
  const teams = db.listTeams();
  res.setHeader("Content-Disposition", 'attachment; filename="actor-2029-export.json"');
  res.json({ exportedAt: new Date().toISOString(), teams });
});

function flattenTeam(team) {
  return {
    teamName: team.teamName,
    resumeCode: team.resumeCode,
    createdAt: team.createdAt,
    currentRoom: team.currentRoom,
    isTest: team.isTest,
    room1_startedAt: team.room1.startedAt,
    room1_completedAt: team.room1.completedAt,
    room1_knop1: team.room1.answers && team.room1.answers.knop1,
    room1_knop2: team.room1.answers && team.room1.answers.knop2,
    room1_knop3: team.room1.answers && team.room1.answers.knop3,
    room1_knop4: team.room1.answers && team.room1.answers.knop4,
    room1_knop5: team.room1.answers && team.room1.answers.knop5,
    room1_knop6: team.room1.answers && team.room1.answers.knop6,
    room2_startedAt: team.room2.startedAt,
    room2_completedAt: team.room2.completedAt,
    room2_nu: team.room2.answers && team.room2.answers.nu,
    room2_toekomst: team.room2.answers && team.room2.answers.toekomst,
    room3_startedAt: team.room3.startedAt,
    room3_completedAt: team.room3.completedAt,
    room3_q1: team.room3.answers && team.room3.answers.q1,
    room3_q2: team.room3.answers && team.room3.answers.q2,
    room3_q3_keuze: team.room3.answers && team.room3.answers.q3 && team.room3.answers.q3.keuze,
    room3_q3_toelichting: team.room3.answers && team.room3.answers.q3 && team.room3.answers.q3.toelichting,
    room3_q4: team.room3.answers && team.room3.answers.q4,
    room3_q5: team.room3.answers && team.room3.answers.q5,
    room4_startedAt: team.room4.startedAt,
    room4_completedAt: team.room4.completedAt,
    room4_woorden: team.room4.answers && Array.isArray(team.room4.answers.woorden) && team.room4.answers.woorden.join(" | "),
    tijdcapsule: team.tijdcapsule,
    future_kop: team.futureImage && team.futureImage.kop,
    future_source: team.futureSource,
    future_generatedAt: team.futureGeneratedAt,
  };
}

const EXPORT_COLUMNS = [
  "teamName", "resumeCode", "createdAt", "currentRoom", "isTest",
  "room1_startedAt", "room1_completedAt", "room1_knop1", "room1_knop2", "room1_knop3", "room1_knop4", "room1_knop5", "room1_knop6",
  "room2_startedAt", "room2_completedAt", "room2_nu", "room2_toekomst",
  "room3_startedAt", "room3_completedAt", "room3_q1", "room3_q2", "room3_q3_keuze", "room3_q3_toelichting", "room3_q4", "room3_q5",
  "room4_startedAt", "room4_completedAt", "room4_woorden",
  "tijdcapsule", "future_kop", "future_source", "future_generatedAt",
];

router.get("/export.csv", requireAdmin, (req, res) => {
  const teams = db.listTeams();
  const rows = teams.map(flattenTeam);
  const csv = toCsv(rows, EXPORT_COLUMNS);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="actor-2029-export.csv"');
  res.send(`﻿${csv}`);
});

router.get("/gezamenlijk-toekomstbeeld", requireAdmin, (req, res) => {
  const bestaand = db.getGezamenlijkBeeld();
  res.json({ gezamenlijk: bestaand });
});

router.post("/gezamenlijk-toekomstbeeld", requireAdmin, gezamenlijkRateLimit, async (req, res) => {
  const teams = db.listTeams().filter((t) => !t.isTest);

  let image = null;
  let source = "fallback";

  if (process.env.ANTHROPIC_API_KEY && teams.length > 0) {
    try {
      image = await genereerGezamenlijkToekomstbeeldMetAI(teams, { timeoutMs: 60000 });
      source = "ai";
    } catch (e) {
      console.error("Gezamenlijk toekomstbeeld via AI mislukt, terugvaloptie gebruikt:", e.message);
    }
  }

  if (!image) {
    image = buildFallbackGezamenlijk(teams, gameData);
    source = "fallback";
  }

  const saved = db.saveGezamenlijkBeeld(image, source);
  res.json({ gezamenlijk: saved });
});

module.exports = router;
