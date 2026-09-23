const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "actor-2029.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL,
    resume_code TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_test INTEGER NOT NULL DEFAULT 0,

    current_room INTEGER NOT NULL DEFAULT 0,
    total_started_at TEXT,

    room1_started_at TEXT,
    room1_completed_at TEXT,
    room1_answers TEXT,

    room2_started_at TEXT,
    room2_completed_at TEXT,
    room2_answers TEXT,

    room3_started_at TEXT,
    room3_completed_at TEXT,
    room3_answers TEXT,

    room4_started_at TEXT,
    room4_completed_at TEXT,
    room4_answers TEXT,

    future_image TEXT,
    future_generated_at TEXT,
    future_source TEXT
  );

  CREATE TABLE IF NOT EXISTS gezamenlijk_beeld (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    image TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    source TEXT NOT NULL
  );
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("teams", "tijdcapsule", "TEXT");

function nowIso() {
  return new Date().toISOString();
}

function generateResumeCode() {
  const words = [
    "KLUIS", "SLUIS", "SIGNAAL", "RELAIS", "CODE", "PROTOCOL", "MODULE", "ARCHIEF",
  ];
  const word = words[crypto.randomInt(0, words.length)];
  const digits = crypto.randomInt(1000, 9999);
  return `${word}-${digits}`;
}

function createTeam(teamName, isTest = false) {
  const id = crypto.randomUUID();
  const ts = nowIso();

  let resumeCode;
  let attempts = 0;
  while (attempts < 20) {
    resumeCode = generateResumeCode();
    const exists = db.prepare("SELECT 1 FROM teams WHERE resume_code = ?").get(resumeCode);
    if (!exists) break;
    attempts += 1;
  }

  db.prepare(`
    INSERT INTO teams (id, team_name, resume_code, created_at, updated_at, is_test, current_room, total_started_at)
    VALUES (@id, @team_name, @resume_code, @created_at, @updated_at, @is_test, 1, @total_started_at)
  `).run({
    id,
    team_name: teamName,
    resume_code: resumeCode,
    created_at: ts,
    updated_at: ts,
    is_test: isTest ? 1 : 0,
    total_started_at: ts,
  });

  return getTeamById(id);
}

function parseTeamRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    teamName: row.team_name,
    resumeCode: row.resume_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isTest: !!row.is_test,
    currentRoom: row.current_room,
    totalStartedAt: row.total_started_at,
    room1: {
      startedAt: row.room1_started_at,
      completedAt: row.room1_completed_at,
      answers: row.room1_answers ? JSON.parse(row.room1_answers) : null,
    },
    room2: {
      startedAt: row.room2_started_at,
      completedAt: row.room2_completed_at,
      answers: row.room2_answers ? JSON.parse(row.room2_answers) : null,
    },
    room3: {
      startedAt: row.room3_started_at,
      completedAt: row.room3_completed_at,
      answers: row.room3_answers ? JSON.parse(row.room3_answers) : null,
    },
    room4: {
      startedAt: row.room4_started_at,
      completedAt: row.room4_completed_at,
      answers: row.room4_answers ? JSON.parse(row.room4_answers) : null,
    },
    futureImage: row.future_image ? JSON.parse(row.future_image) : null,
    futureGeneratedAt: row.future_generated_at,
    futureSource: row.future_source,
    tijdcapsule: row.tijdcapsule,
  };
}

function getTeamById(id) {
  const row = db.prepare("SELECT * FROM teams WHERE id = ?").get(id);
  return parseTeamRow(row);
}

function getTeamByResumeCode(resumeCode) {
  const row = db.prepare("SELECT * FROM teams WHERE resume_code = ? COLLATE NOCASE").get(resumeCode);
  return parseTeamRow(row);
}

function listTeams() {
  const rows = db.prepare("SELECT * FROM teams ORDER BY created_at DESC").all();
  return rows.map(parseTeamRow);
}

const ROOM_KEYS = { 1: "room1", 2: "room2", 3: "room3", 4: "room4" };

function startRoom(id, roomNumber) {
  const key = ROOM_KEYS[roomNumber];
  if (!key) return getTeamById(id);
  const team = getTeamById(id);
  if (!team) return null;
  if (team[key].startedAt) return team;

  db.prepare(`UPDATE teams SET ${key}_started_at = ?, current_room = ?, updated_at = ? WHERE id = ?`)
    .run(nowIso(), roomNumber, nowIso(), id);
  return getTeamById(id);
}

function saveRoomAnswers(id, roomNumber, answers) {
  const key = ROOM_KEYS[roomNumber];
  if (!key) return getTeamById(id);
  db.prepare(`UPDATE teams SET ${key}_answers = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(answers), nowIso(), id);
  return getTeamById(id);
}

function completeRoom(id, roomNumber) {
  const key = ROOM_KEYS[roomNumber];
  if (!key) return getTeamById(id);
  const team = getTeamById(id);
  if (!team) return null;

  const nextRoom = roomNumber >= 4 ? 5 : roomNumber + 1;
  const updates = { current_room: nextRoom, updated_at: nowIso() };

  const stmt = db.prepare(`
    UPDATE teams
    SET ${key}_completed_at = COALESCE(${key}_completed_at, ?),
        current_room = ?,
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(nowIso(), nextRoom, nowIso(), id);
  return getTeamById(id);
}

function saveTijdcapsule(id, tekst) {
  db.prepare(`UPDATE teams SET tijdcapsule = ?, updated_at = ? WHERE id = ?`).run(
    tekst,
    nowIso(),
    id
  );
  return getTeamById(id);
}

function saveFutureImage(id, image, source) {
  db.prepare(`
    UPDATE teams SET future_image = ?, future_generated_at = ?, future_source = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(image), nowIso(), source, nowIso(), id);
  return getTeamById(id);
}

function deleteTeam(id) {
  db.prepare("DELETE FROM teams WHERE id = ?").run(id);
}

function deleteTestTeams() {
  const info = db.prepare("DELETE FROM teams WHERE is_test = 1").run();
  return info.changes;
}

function getGezamenlijkBeeld() {
  const row = db.prepare("SELECT * FROM gezamenlijk_beeld WHERE id = 1").get();
  if (!row) return null;
  return {
    image: JSON.parse(row.image),
    generatedAt: row.generated_at,
    source: row.source,
  };
}

function saveGezamenlijkBeeld(image, source) {
  db.prepare(`
    INSERT INTO gezamenlijk_beeld (id, image, generated_at, source)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET image = excluded.image, generated_at = excluded.generated_at, source = excluded.source
  `).run(JSON.stringify(image), nowIso(), source);
  return getGezamenlijkBeeld();
}

module.exports = {
  db,
  createTeam,
  getTeamById,
  getTeamByResumeCode,
  listTeams,
  startRoom,
  saveRoomAnswers,
  completeRoom,
  saveTijdcapsule,
  saveFutureImage,
  deleteTeam,
  deleteTestTeams,
  getGezamenlijkBeeld,
  saveGezamenlijkBeeld,
};
