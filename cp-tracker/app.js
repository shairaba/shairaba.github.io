import { RULES, cpFor } from "./rules.js";
import { SPECIES_LIST } from "./species-list.js";
import { NEW_SPRITE_CDN_BASE, SPECIES_TO_DEX } from "./sprite-map.js";

const KEY = "cpbar.results.v1";
const $ = (id) => document.getElementById(id);
let results = load();
let editing = null;

function load() {
  try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter((r) => RULES.types[r.type]); } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(results)); } catch {}
}

const cpOf = (r) => (r.override != null ? r.override : cpFor(r.type, r.placement, r.entrants));

// Within each BFL group, only the best N results count.
function computeCounted() {
  const counted = new Set();
  const byGroup = {};
  for (const r of results) {
    if (cpOf(r) <= 0) continue; // 0-CP results never take a BFL slot
    const g = RULES.types[r.type]?.group;
    (byGroup[g] ||= []).push(r);
  }
  for (const [g, list] of Object.entries(byGroup)) {
    const bfl = RULES.groups[g].bfl;
    [...list].sort((a, b) => cpOf(b) - cpOf(a)).slice(0, bfl ?? Infinity).forEach((r) => counted.add(r.id));
  }
  return counted;
}

function teamNames(paste) {
  return (paste || "").split(/\n\s*\n/).map((b) => b.trim().split("\n")[0])
    .filter(Boolean)
    .map((l) => {
      l = l.split("@")[0].trim();
      const m = l.match(/\(([^)]{2,})\)\s*(\(.\))?$/); // "Nickname (Species)"
      return (m ? m[1] : l.replace(/\s*\(.\)$/, "")).trim();
    });
}

// Species lookup by display name or sprite id ("Hisuian Arcanine" / "arcanine-hisui").
const BY_KEY = new Map();
for (const sp of SPECIES_LIST) { BY_KEY.set(sp.n.toLowerCase(), sp); BY_KEY.set(sp.i, sp); }
const resolve = (name) => BY_KEY.get(name.trim().toLowerCase()) || BY_KEY.get(name.trim().toLowerCase().replace(/\s+/g, "-"));

// Same fallback chain as vgc-locals-italia: new CDN -> Limitless -> Pokestats.
function spriteImg(name) {
  const sp = resolve(name);
  if (!sp) return "";
  const dex = SPECIES_TO_DEX[sp.i];
  const limitless = `https://r2.limitlesstcg.net/pokemon/gen9/${sp.i}.png`;
  const pokestats = `https://pokestats.top/images/pokemon/imgs/${sp.i}.png`;
  const primary = dex ? `${NEW_SPRITE_CDN_BASE}/${dex}.png` : limitless;
  const fallback = dex ? limitless : pokestats;
  return `<img src="${primary}" alt="${esc(name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`;
}

const monsOf = (r) => r.mons || teamNames(r.team).map((n) => resolve(n)?.n || n);

// CP earned per Pokémon: sum of counted results whose team included it. Only Pokémon with CP > 0 are shown.
function renderMonChart(counted) {
  const totals = new Map();
  for (const r of results) {
    if (!counted.has(r.id)) continue;
    const cp = cpOf(r);
    for (const m of new Set(monsOf(r))) totals.set(m, (totals.get(m) || 0) + cp);
  }
  const rows = [...totals].filter(([, cp]) => cp > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const max = rows[0]?.[1] || 1;
  $("monchart").innerHTML = rows.length ? rows.map(([n, cp]) =>
    `<div class="mrow" title="${esc(n)}: ${cp} CP"><span class="mico">${spriteImg(n)}</span><span class="mname">${esc(n)}</span>
     <span class="mtrack"><i style="width:${(cp / max) * 100}%"></i></span><b>${cp}</b></div>`).join("")
    : "<small>Add teams to your results to see CP per Pokémon.</small>";
}

function render() {
  $("season").textContent = RULES.season;
  const counted = computeCounted();
  let total = 0;
  results.forEach((r) => { if (counted.has(r.id)) total += cpOf(r); });
  $("total").textContent = total;

  $("groups").innerHTML = "<h2>Best finish limits</h2>" + Object.entries(RULES.groups).map(([g, info]) => {
    const list = results.filter((r) => RULES.types[r.type].group === g);
    const used = list.filter((r) => counted.has(r.id));
    const pts = used.reduce((s, r) => s + cpOf(r), 0);
        return `<div class="g"><div class="top"><span>${info.label}${info.verified ? "" : ' <span class="warn" title="Limit unverified">⚠</span>'}</span>
      <span>${used.length}/${info.bfl} · <b>${pts}</b>/${info.max} CP</span></div><div class="bar"><i style="width:${Math.min(100, (pts / info.max) * 100)}%"></i></div></div>`;
  }).join("");

  renderMonChart(counted);

  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date));
  $("results").innerHTML = sorted.length ? sorted.map((r) => {
    const names = monsOf(r);
    return `<div class="res ${counted.has(r.id) ? "" : "dropped"}">
      <div class="top"><div><b>${esc(r.name)}</b><br><small>${r.date} · ${RULES.types[r.type].label} · ${r.placement}/${r.entrants}${counted.has(r.id) ? "" : cpOf(r) > 0 ? " · not counted (over limit)" : " · 0 CP, not counted"}</small></div>
      <b class="cp">${cpOf(r)}</b></div>
      ${names.length ? `<div class="team">${names.map((n) => `<figure>${spriteImg(n)}<figcaption>${esc(n)}</figcaption></figure>`).join("")}</div>` : ""}
      ${r.notes ? `<small>${esc(r.notes)}</small>` : ""}
      <div class="acts"><button data-edit="${r.id}">Edit</button><button data-del="${r.id}">Delete</button></div></div>`;
  }).join("") : "<small>No results yet.</small>";
}

function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

const form = $("form");
const slots = () => [...document.querySelectorAll(".slot")];
$("species-dl").innerHTML = SPECIES_LIST.filter((s) => s.i !== "unknown").map((s) => `<option value="${esc(s.n)}">`).join("");
$("slots").innerHTML = Array.from({ length: 6 }, (_, i) =>
  `<input class="slot" list="species-dl" placeholder="Pokémon ${i + 1}" autocomplete="off">`).join("");
// Free-text slots snap to the canonical species name when they match one.
$("slots").addEventListener("change", (e) => { const sp = resolve(e.target.value); if (sp) e.target.value = sp.n; });
$("pasteBtn").onclick = () => {
  const names = teamNames($("paste").value).slice(0, 6);
  slots().forEach((inp, i) => { inp.value = names[i] ? resolve(names[i])?.n || names[i] : ""; });
  $("paste").value = "";
};
$("typeSel").innerHTML = Object.entries(RULES.types)
  .map(([k, t]) => `<option value="${k}">${t.label}${t.verified ? "" : " ⚠"}</option>`).join("");

function preview() {
  const f = new FormData(form);
  const cp = cpFor(f.get("type"), +f.get("placement"), +f.get("entrants"));
  const el = $("preview");
  el.textContent = f.get("placement") && f.get("entrants") ? `Table says: ${cp} CP${cp ? "" : " (kicker not met or outside table)"}` : "";
  el.className = "preview" + (cp ? "" : " zero");
}
form.addEventListener("input", preview);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  const r = {
    id: editing || crypto.randomUUID(),
    name: f.name, date: f.date, type: f.type,
    placement: +f.placement, entrants: +f.entrants,
    override: f.override === "" ? null : +f.override,
    mons: slots().map((i) => i.value.trim()).filter(Boolean), notes: f.notes,
  };
  results = editing ? results.map((x) => (x.id === editing ? r : x)) : [...results, r];
  save(); stopEdit(); render();
});

function stopEdit() {
  editing = null; form.reset(); slots().forEach((i) => (i.value = "")); $("saveBtn").textContent = "Save result"; $("cancelBtn").hidden = true; preview();
}
$("cancelBtn").onclick = stopEdit;

$("results").addEventListener("click", (e) => {
  const del = e.target.dataset.del, ed = e.target.dataset.edit;
  if (del && confirm("Delete this result?")) { results = results.filter((r) => r.id !== del); save(); render(); }
  if (ed) {
    const r = results.find((x) => x.id === ed);
    editing = ed;
    for (const k of ["name", "date", "type", "placement", "entrants", "notes"]) form.elements[k].value = r[k] ?? "";
    form.elements.override.value = r.override ?? "";
    const m = monsOf(r);
    slots().forEach((inp, i) => { inp.value = m[i] || ""; });
    $("saveBtn").textContent = "Update result"; $("cancelBtn").hidden = false; preview();
    form.scrollIntoView({ behavior: "smooth" });
  }
});

$("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(results, null, 2)], { type: "application/json" }));
  a.download = `cp-results-${RULES.season}.json`; a.click();
};
$("importFile").onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    let data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw 0;
    data = data.filter((r) => RULES.types[r.type]);
    if (confirm(`Replace current ${results.length} results with ${data.length} imported?`)) { results = data; save(); render(); }
  } catch { alert("Invalid file"); }
  e.target.value = "";
};

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
render();

$("theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.cookie = `theme=${next}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
});
