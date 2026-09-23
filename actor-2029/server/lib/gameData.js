const KNOB_STANDEN = [
  "helemaal_niet_waar",
  "niet_waar",
  "twijfel",
  "waar",
  "helemaal_waar",
];

const KNOB_LABELS = {
  helemaal_niet_waar: "Helemaal niet waar",
  niet_waar: "Niet waar",
  twijfel: "Twijfel",
  waar: "Waar",
  helemaal_waar: "Helemaal waar",
};

const STELLINGEN = [
  "In 2029 schrijft AI de eerste versie van vrijwel elk bestuursstuk, verslag en advies.",
  "Besturen betalen ons straks voor oordeel en vertrouwen, niet voor uitvoering.",
  "AI maakt een deel van onze huidige functies overbodig.",
  "Als wij niet meegaan met AI, raken we klanten kwijt.",
  "De menselijke kant van Actor wordt belangrijker naarmate AI meer kan.",
  "In 2029 is AI voor ons net zo gewoon als e-mail.",
];

const LIFT_VERDIEPINGEN = [
  "verkennen",
  "experimenteren",
  "toepassen",
  "verankeren",
  "meesterschap",
];

const LIFT_LABELS = {
  verkennen: "Verkennen",
  experimenteren: "Experimenteren",
  toepassen: "Toepassen",
  verankeren: "Verankeren",
  meesterschap: "Meesterschap",
};

const ARCHIEF_KEUZES = [
  "kennis_en_vaardigheid",
  "tijd",
  "tools_en_toegang",
  "vertrouwelijkheid_en_data",
  "cultuur_en_durf",
  "richting_vanuit_leiding",
];

const ARCHIEF_KEUZE_LABELS = {
  kennis_en_vaardigheid: "Kennis en vaardigheid",
  tijd: "Tijd",
  tools_en_toegang: "Tools en toegang",
  vertrouwelijkheid_en_data: "Vertrouwelijkheid en data",
  cultuur_en_durf: "Cultuur en durf",
  richting_vanuit_leiding: "Richting vanuit leiding",
};

const LAB_WOORDEN = [
  "nuchter", "ambitieus", "menselijk", "snel", "zorgvuldig", "gedurfd",
  "verbindend", "speels", "trots", "eigenwijs", "rustig", "scherp",
];

const ROOM_DURATIONS_SEC = {
  1: 10 * 60,
  2: 5 * 60,
  3: 12 * 60,
  4: 3 * 60,
};

const TOTAL_DURATION_SEC = 30 * 60;

module.exports = {
  KNOB_STANDEN,
  KNOB_LABELS,
  STELLINGEN,
  LIFT_VERDIEPINGEN,
  LIFT_LABELS,
  ARCHIEF_KEUZES,
  ARCHIEF_KEUZE_LABELS,
  LAB_WOORDEN,
  ROOM_DURATIONS_SEC,
  TOTAL_DURATION_SEC,
};
