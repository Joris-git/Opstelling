import { escapeHtml } from "./util.js";

export function renderKluisLoading(container) {
  container.innerHTML = `
    <div class="kluis-loading">
      <div class="kluis-ring"></div>
      <p>De kluis ontsleutelt jullie toekomstbeeld…</p>
    </div>
  `;
}

export function renderKluisError(container, { onRetry }) {
  container.innerHTML = `
    <div class="kluis-loading kluis-fout">
      <p>Het ontsleutelen lukte niet meteen.</p>
      <button type="button" class="btn-primary" id="btn-retry-fout">Probeer opnieuw</button>
    </div>
  `;
  container.querySelector("#btn-retry-fout").addEventListener("click", onRetry);
}

export function renderKluisResult(container, image, { source, onFullscreen, onDownloadPng, onPrint, onRetry }) {
  const routeHtml = (image.route || [])
    .map(
      (stap) => `
        <div class="route-stap">
          <h4>${escapeHtml(stap.titel)}</h4>
          <p>${escapeHtml(stap.actie)}</p>
        </div>`
    )
    .join("");

  container.innerHTML = `
    <div class="kluis-result">
      <div class="kluis-poster" id="kluis-poster">
        <div class="poster-svg">${image.svg}</div>
        <div class="poster-tekst">
          <h2>${escapeHtml(image.kop)}</h2>
          <p class="poster-scene">${escapeHtml(image.scene)}</p>
          <div class="poster-artefact">
            <strong>Artefact uit 2029</strong>
            <p>${escapeHtml(image.artefact)}</p>
          </div>
          <div class="poster-route">${routeHtml}</div>
          <p class="poster-grens"><em>${escapeHtml(image.grens)}</em></p>
        </div>
      </div>
      <div class="kluis-acties">
        <button type="button" class="btn-primary" id="btn-fullscreen">Volledig scherm</button>
        <button type="button" id="btn-download">Download als PNG</button>
        <button type="button" id="btn-print">Afdrukken / PDF</button>
        <button type="button" id="btn-retry">Probeer opnieuw</button>
      </div>
      ${source === "fallback" ? '<p class="kluis-fallback-note">Dit toekomstbeeld is automatisch opgebouwd uit jullie antwoorden.</p>' : ""}
    </div>
  `;

  container.querySelector("#btn-fullscreen").addEventListener("click", onFullscreen);
  container.querySelector("#btn-download").addEventListener("click", onDownloadPng);
  container.querySelector("#btn-print").addEventListener("click", onPrint);
  container.querySelector("#btn-retry").addEventListener("click", onRetry);
}

function svgToImage(svgString) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let curY = y;
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

export async function downloadPosterAsPng(image, teamName) {
  const width = 1200;
  const height = 1700;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, width, height);

  const svgHeight = Math.round((width * 9) / 16);
  try {
    const img = await svgToImage(image.svg);
    ctx.drawImage(img, 0, 0, width, svgHeight);
  } catch (e) {
    /* illustratie tekenen mislukt: poster gaat door zonder afbeelding */
  }

  let y = svgHeight + 60;
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 42px Georgia, serif";
  y = wrapText(ctx, image.kop, 60, y, width - 120, 50) + 25;

  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#cbd5e1";
  y = wrapText(ctx, image.scene, 60, y, width - 120, 30) + 30;

  ctx.font = "italic 18px sans-serif";
  ctx.fillStyle = "#e07a97";
  y = wrapText(ctx, `Artefact: ${image.artefact}`, 60, y, width - 120, 26) + 30;

  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#e2e8f0";
  (image.route || []).forEach((stap) => {
    y = wrapText(ctx, `${stap.titel} — ${stap.actie}`, 60, y, width - 120, 24) + 10;
  });

  ctx.font = "italic 16px sans-serif";
  ctx.fillStyle = "#94a3b8";
  wrapText(ctx, image.grens, 60, y + 10, width - 120, 24);

  const link = document.createElement("a");
  const safeName = (teamName || "team").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  link.download = `actor-2029-toekomstbeeld-${safeName}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
