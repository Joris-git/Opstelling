function createRateLimiter({ windowMs, max }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || "onbekend";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(key, { windowStart: now, count: 1 });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: "Te veel verzoeken. Wacht even en probeer het opnieuw." });
    }
    next();
  };
}

module.exports = { createRateLimiter };
