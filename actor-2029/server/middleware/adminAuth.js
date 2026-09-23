const crypto = require("crypto");

const COOKIE_NAME = "regie_auth";
const TOKEN_GELDIGHEID_MS = 12 * 60 * 60 * 1000;

function sign(value) {
  const secret = process.env.SESSION_SECRET || "onveilig-standaard-geheim-verander-dit";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createToken() {
  const expires = Date.now() + TOKEN_GELDIGHEID_MS;
  const payload = String(expires);
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && Date.now() <= expires;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch (e) {
      out[key] = value;
    }
  });
  return out;
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  if (verifyToken(cookies[COOKIE_NAME])) return next();
  res.status(401).json({ error: "Niet ingelogd." });
}

module.exports = {
  COOKIE_NAME,
  TOKEN_GELDIGHEID_MS,
  createToken,
  verifyToken,
  parseCookies,
  requireAdmin,
};
