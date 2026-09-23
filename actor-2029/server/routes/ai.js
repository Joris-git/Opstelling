const express = require("express");
const db = require("../db");
const gameData = require("../lib/gameData");
const { buildFallbackFuture } = require("../lib/fallbackFuture");

const router = express.Router();

router.post("/toekomstbeeld/:id", async (req, res) => {
  const team = db.getTeamById(req.params.id);
  if (!team) return res.status(404).json({ error: "Team niet gevonden." });

  if (team.futureImage) {
    return res.json({ team });
  }

  const image = buildFallbackFuture(team, gameData);
  const updated = db.saveFutureImage(team.id, image, "fallback");
  res.json({ team: updated });
});

module.exports = router;
