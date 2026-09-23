const DOMPurify = require("isomorphic-dompurify");

function sanitizeSvg(rawSvg) {
  if (typeof rawSvg !== "string" || !rawSvg.trim()) return null;

  const match = rawSvg.match(/<svg[\s\S]*<\/svg>/i);
  const source = match ? match[0] : rawSvg;

  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (/^(xlink:href|href)$/i.test(data.attrName)) {
      if (!/^#/.test(data.attrValue || "")) {
        data.keepAttr = false;
      }
    }
  });

  let clean;
  try {
    clean = DOMPurify.sanitize(source, {
      USE_PROFILES: { svg: true, svgFilters: false },
      FORBID_TAGS: ["script", "foreignObject", "style", "image", "animate", "animateTransform", "animateMotion", "iframe"],
      FORBID_ATTR: ["style", "onload", "onerror", "onclick"],
    });
  } finally {
    DOMPurify.removeAllHooks();
  }

  if (!clean || !/^<svg[\s>]/i.test(clean.trim())) return null;
  return clean.trim();
}

module.exports = { sanitizeSvg };
