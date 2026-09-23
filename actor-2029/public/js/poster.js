import { escapeHtml } from "./util.js";

export function posterHtml(image) {
  const routeHtml = (image.route || [])
    .map(
      (stap) => `
        <div class="route-stap">
          <h4>${escapeHtml(stap.titel)}</h4>
          <p>${escapeHtml(stap.actie)}</p>
        </div>`
    )
    .join("");

  return `
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
  `;
}
