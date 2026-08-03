const VGC_FORMATS = {
  "M-B": "Regulation Set M-B",
  "M-A": "Regulation Set M-A",
  "SVI": "Scarlet & Violet - Regulation I",
  "SVH": "Scarlet & Violet - Regulation H",
  "SVG": "Scarlet & Violet - Regulation G",
  "SVF": "Scarlet & Violet - Regulation F",
  "SVE": "Scarlet & Violet - Regulation E",
  "VGC23": "Scarlet & Violet - Regulation D",
  "23S3": "Scarlet & Violet - Regulation C",
  "23S2": "Scarlet & Violet - Regulation B",
  "23S1": "Scarlet & Violet - Regulation A",
  "VGC22": "VGC 2022 (Series 12)",
};

const SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9";

function formatLabel(id) {
  if (!id) return "Unknown";
  return VGC_FORMATS[id] || id;
}

function spriteUrl(speciesId) {
  if (!speciesId) return "";
  return `${SPRITE_BASE}/${speciesId}.png`;
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

function spriteRowHtml(team) {
  const chips = (team || [])
    .map(
      (mon) =>
        `<span class="sprite-chip"><img class="sprite" src="${esc(spriteUrl(mon.species_id))}" alt="${esc(mon.species_name || mon.species_id)}" title="${esc(mon.species_name || mon.species_id)}" loading="lazy"></span>`
    )
    .join("");
  return `<div class="sprite-row">${chips}</div>`;
}

function teamGridHtml(team) {
  if (!team || !team.length) return '<span class="muted">No team list available.</span>';
  const cards = team
    .map((mon) => {
      const moves = (mon.moves || []).map((m) => `<li>${esc(m)}</li>`).join("");
      return `
        <div class="mon-card">
          <div class="mon-header">
            <span class="mon-sprite-chip"><img class="mon-sprite" src="${esc(spriteUrl(mon.species_id))}" alt="${esc(mon.species_name || mon.species_id)}" loading="lazy"></span>
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
