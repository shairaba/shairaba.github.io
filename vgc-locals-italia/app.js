// Self-contained copy of the sprite/fetch helpers from
// ../vgc-tournament-explorer/app.js (per this repo's per-app-independence
// convention - each sub-app owns its own copy rather than cross-importing).

const LIMITLESS_SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9";
const POKESTATS_SPRITE_BASE = "https://pokestats.top/images/pokemon/imgs";

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function spriteUrl(speciesId, source) {
  if (!speciesId) return "";
  const base = source === "pokestats" ? POKESTATS_SPRITE_BASE : LIMITLESS_SPRITE_BASE;
  return `${base}/${speciesId}.png`;
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// species_id here can come from either sprite CDN's own slug convention
// (see tool/species_reference.py's module docstring) - try Limitless first,
// fall back to pokestats' CDN on 404, same pattern as
// vgc-tournament-explorer/dashboard.html's spriteChipHtml.
function spriteChipHtml(speciesId, name) {
  const primary = esc(spriteUrl(speciesId, "limitless"));
  const fallback = esc(spriteUrl(speciesId, "pokestats"));
  return `<span class="sprite-chip"><img class="sprite" src="${primary}" alt="${esc(name)}" title="${esc(name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}';"></span>`;
}

function spriteRowHtml(team) {
  return `<div class="sprite-row">${(team || []).map((mon) => spriteChipHtml(mon.species_id, mon.species_name)).join("")}</div>`;
}

// "VG Cup" -> type-cup, "VG Challenge" -> type-challenge (see .badge.type-*
// in style.css for the color tokens each maps to).
function typeBadgeHtml(tournamentType) {
  const slug = tournamentType === "VG Cup" ? "cup" : "challenge";
  return `<span class="badge type-${slug}">${esc(tournamentType || "Unknown")}</span>`;
}

// Same light/dark toggle as ../pokemon-events-italia/app.js's
// initThemeToggle(): the [data-theme] attribute itself is set before first
// paint by an inline script in <head> (see index.html/submit.html), this
// just flips it on click and re-saves the cookie.
function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  });
}
document.addEventListener("DOMContentLoaded", initThemeToggle);
