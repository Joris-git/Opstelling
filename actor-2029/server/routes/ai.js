const express = require("express");
const db = require("../db");
const gameData = require("../lib/gameData");
const { buildFallbackFuture } = require("../lib/fallbackFuture");
const { genereerToekomstbeeldMetAI } = require("../lib/anthropicClient");
const { createRateLimiter } = require("../lib/rateLimit");

const router = express.Router();

const aiRateLimit = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 20 });

router.post("/toekomstbeeld/:id", aiRateLimit, async (req, res) => {
  const team = db.getTeamById(req.params.id);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });

  if (team.futureImage && team.futureSource === "ai") {
    return res.json({ team });
  }

  let image = null;
  let source = "fallback";

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      image = await genereerToekomstbeeldMetAI(team, { timeoutMs: 60000 });
      source = "ai";
    } catch (e) {
      console.error("AI-toekomstbeeld mislukt, terugvaloptie gebruikt:", e.message);
    }
  }

  if (!image) {
    image = buildFallbackFuture(team, gameData);
    source = "fallback";
  }

  const updated = db.saveFutureImage(team.id, image, source);
  res.json({ team: updated });
});

module.exports = router;
