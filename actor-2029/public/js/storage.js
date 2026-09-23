const LS_TEAM_KEY = "actor2029_team";
const LS_MUTED_KEY = "actor2029_muted";

export function saveLocalTeamRef(team) {
  try {
    localStorage.setItem(
      LS_TEAM_KEY,
      JSON.stringify({ id: team.id, resumeCode: team.resumeCode, teamName: team.teamName })
    );
  } catch (e) {
    /* privé-modus of opslag geblokkeerd: negeren, server blijft bron van waarheid */
  }
}

export function loadLocalTeamRef() {
  try {
    const raw = localStorage.getItem(LS_TEAM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearLocalTeamRef() {
  try {
    localStorage.removeItem(LS_TEAM_KEY);
  } catch (e) {
    /* negeren */
  }
}

function answersKey(teamId, room) {
  return `actor2029_answers_${teamId}_room${room}`;
}

export function saveLocalAnswers(teamId, room, answers) {
  try {
    localStorage.setItem(answersKey(teamId, room), JSON.stringify(answers));
  } catch (e) {
    /* negeren */
  }
}

export function loadLocalAnswers(teamId, room) {
  try {
    const raw = localStorage.getItem(answersKey(teamId, room));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveMuted(muted) {
  try {
    localStorage.setItem(LS_MUTED_KEY, muted ? "1" : "0");
  } catch (e) {
    /* negeren */
  }
}

export function loadMuted() {
  try {
    return localStorage.getItem(LS_MUTED_KEY) === "1";
  } catch (e) {
    return false;
  }
}
