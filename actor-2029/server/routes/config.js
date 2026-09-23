const express = require("express");
const gameData = require("../lib/gameData");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    knobStanden: gameData.KNOB_STANDEN,
    knobLabels: gameData.KNOB_LABELS,
    stellingen: gameData.STELLINGEN,
    liftVerdiepingen: gameData.LIFT_VERDIEPINGEN,
    liftLabels: gameData.LIFT_LABELS,
    archiefKeuzes: gameData.ARCHIEF_KEUZES,
    archiefKeuzeLabels: gameData.ARCHIEF_KEUZE_LABELS,
    labWoorden: gameData.LAB_WOORDEN,
    roomDurationsSec: gameData.ROOM_DURATIONS_SEC,
    totalDurationSec: gameData.TOTAL_DURATION_SEC,
  });
});

module.exports = router;
