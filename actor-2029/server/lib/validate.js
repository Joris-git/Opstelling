function clampString(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen).trim();
}

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

module.exports = { clampString, countWords };
