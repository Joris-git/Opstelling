// Turns the shared app (../algarve/index.html, also published on claude.ai) into a
// stand-alone page for Cloudflare Pages: adds the document head and loads shim.js,
// which connects the app to this site's /api functions.
// Run after changing the app:  node build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "../algarve/index.html"), "utf8");

const headEnd = src.indexOf("</style>") + "</style>".length;
const head = src.slice(0, headEnd).replace(/<title>[^<]*<\/title>/, "<title>Rota</title>");
const body = src.slice(headEnd).replace("<script>", '<script src="/shim.js"></script>\n<script>');

const icon = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2348A6"/><circle cx="10" cy="23" r="3" fill="#fff"/><circle cx="22" cy="9" r="3" fill="#D7832F"/><path d="M13 23h6a4 4 0 0 0 0-8h-6a4 4 0 0 1 0-8h6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>');

const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Plan samen een reis: route, verblijf, activiteiten en dagplanning, met stemmen en Claude als reisassistent.">
<meta name="theme-color" content="#2348A6">
<link rel="icon" href="data:image/svg+xml,${icon}">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}img{max-width:100%}[hidden]{display:none!important}.scrim.rota-gate{z-index:90;align-items:center;justify-content:center}.sheet.rota-gate-sheet{height:auto;max-height:92%;border-radius:18px;margin:16px}body.rota-solo .top,body.rota-solo main,body.rota-solo #fab{display:none!important}body.rota-solo .scrim.rota-gate{background:transparent}</style>
${head}
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(path.join(here, "public/index.html"), html);
console.log("public/index.html geschreven (" + Math.round(html.length / 1024) + " KB)");
