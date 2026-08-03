// The regulation letter alone determines the game (Champions vs Scarlet &
// Violet vs Sword & Shield) - same letter always means the same ruleset,
// regardless of which site (Limitless or pokestats.top) a tournament came
// from. See tool/limitless_extractor/formats.py for the authoritative copy.
const FORMAT_LABELS = {
  "M-B": "Reg M-B",
  "M-A": "Reg M-A",
  "SVI": "Reg I",
  "SVH": "Reg H",
  "SVG": "Reg G",
  "SVF": "Reg F",
  "SVE": "Reg E",
  "VGC23": "Reg D",
  "23S3": "Reg C",
  "23S2": "Reg B",
  "23S1": "Reg A",
  "VGC22": "Series 12",
};

// Sprite CDN choice, on the other hand, IS a data-source concern:
// Limitless's own CDN has no Mega-form sprites, so anything sourced from
// pokestats.top (tournaments.game === "pokestats") uses their image host.
const LIMITLESS_SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9";
const POKESTATS_SPRITE_BASE = "https://pokestats.top/images/pokemon/imgs";

function formatLabel(id) {
  if (!id) return "Unknown";
  return FORMAT_LABELS[id] || id;
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

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function spriteRowHtml(team, source) {
  const chips = (team || [])
    .map(
      (mon) =>
        `<span class="sprite-chip"><img class="sprite" src="${esc(spriteUrl(mon.species_id, source))}" alt="${esc(mon.species_name || mon.species_id)}" title="${esc(mon.species_name || mon.species_id)}" loading="lazy"></span>`
    )
    .join("");
  return `<div class="sprite-row">${chips}</div>`;
}

function teamGridHtml(team, source) {
  if (!team || !team.length) return '<span class="muted">No team list available.</span>';
  const cards = team
    .map((mon) => {
      const moves = (mon.moves || []).map((m) => `<li>${esc(m)}</li>`).join("");
      return `
        <div class="mon-card">
          <div class="mon-header">
            <span class="mon-sprite-chip"><img class="mon-sprite" src="${esc(spriteUrl(mon.species_id, source))}" alt="${esc(mon.species_name || mon.species_id)}" loading="lazy"></span>
            <div class="mon-name">${esc(mon.species_name || mon.species_id)}</div>
          </div>
          <div class="mon-line">
            ${mon.item ? `<span class="mon-item">@ ${esc(mon.item)}</span>` : ""}
            ${mon.tera ? `<span class="mon-tera">Tera: ${esc(mon.tera)}</span>` : ""}
          </div>
          <div class="mon-line mon-sub">
            ${mon.ability ? esc(mon.ability) : ""}${mon.nature ? ` &middot; ${esc(mon.nature)}` : ""}
          </div>
          ${moves ? `<ul class="mon-moves">${moves}</ul>` : ""}
        </div>`;
    })
    .join("");
  return `<div class="team-grid">${cards}</div>`;
}

function recordHtml(e) {
  let s = `${e.wins}-${e.losses}`;
  if (e.ties) s += `-${e.ties}`;
  if (e.drop_round) s += ` <span class="dropped">dropped R${e.drop_round}</span>`;
  return s;
}

function wireExpandableRows(tbody) {
  tbody.querySelectorAll(".standings-row").forEach((row) => {
    row.addEventListener("click", (evt) => {
      if (evt.target.closest("a")) return;
      const target = document.getElementById(row.dataset.target);
      target.classList.toggle("open");
      row.classList.toggle("expanded");
    });
  });
}

function populateFormatSelect(select, formats, current) {
  formats.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = formatLabel(f);
    if (f === current) opt.selected = true;
    select.appendChild(opt);
  });
}
