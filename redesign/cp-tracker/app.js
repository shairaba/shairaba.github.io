import { RULES, cpFor } from "./rules.js";
import { SPECIES_LIST } from "./species-list.js";
import { NEW_SPRITE_CDN_BASE, SPECIES_TO_DEX } from "./sprite-map.js";

const KEY = "cpbar.results.v1";            // same storage as before: existing results carry over
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

// Within each best-finish-limit group, only the best N results count.
function computeCounted() {
  const counted = new Set();
  const byGroup = {};
  for (const r of results) {
    if (cpOf(r) <= 0) continue; // 0-CP results never take a slot
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
  return (paste || "").split(/\r?\n\s*\r?\n/).map((b) => b.trim().split(/\r?\n/)[0])
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
function spriteImg(name, alt = "") {
  const sp = resolve(name);
  if (!sp) return `<span class="ph" aria-hidden="true">${esc(name.charAt(0))}</span>`;
  const dex = SPECIES_TO_DEX[sp.i];
  const limitless = `https://r2.limitlesstcg.net/pokemon/gen9/${sp.i}.png`;
  const pokestats = `https://pokestats.top/images/pokemon/imgs/${sp.i}.png`;
  const primary = dex ? `${NEW_SPRITE_CDN_BASE}/${dex}.png` : limitless;
  const fallback = dex ? limitless : pokestats;
  return `<img src="${primary}" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`;
}

const monsOf = (r) => r.mons || teamNames(r.team).map((n) => resolve(n)?.n || n);
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------- words ---------- */
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const shortType = (k) => ({ regional: "Regional", international: "International", league_cup: "League Cup",
  league_challenge: "League Challenge", global: "Global Challenge" }[k] || RULES.types[k].label);

/* ---------- best finish limits: one box per counted place ---------- */
function renderGroups(counted) {
  $("groups").innerHTML = Object.entries(RULES.groups).map(([g, info]) => {
    const list = results.filter((r) => RULES.types[r.type].group === g);
    const used = list.filter((r) => counted.has(r.id)).sort((a, b) => cpOf(b) - cpOf(a));
    const pts = used.reduce((s, r) => s + cpOf(r), 0);
    const boxes = Array.from({ length: info.bfl }, (_, i) => {
      const r = used[i];
      if (!r) return `<li class="box open"><span>Open</span></li>`;
      return `<li class="box"><button type="button" data-edit="${r.id}" title="${esc(r.name)}: ${ordinal(r.placement)} of ${r.entrants}">
        <b>${cpOf(r)}</b><small>${esc(r.name)}</small></button></li>`;
    }).join("");
    let hint;
    if (!used.length) hint = "Nothing counted yet.";
    else if (used.length < info.bfl) hint = `${info.bfl - used.length} more ${info.bfl - used.length === 1 ? "result" : "results"} will count in full.`;
    else hint = `Full. A new result counts only if it earns more than ${cpOf(used[used.length - 1])} CP.`;
    return `<article class="group">
      <div class="group-head">
        <h3>${esc(info.label)}${info.verified ? "" : ' <span class="unverified" title="This limit has not been checked against the official rules">unconfirmed</span>'}</h3>
        <p><b>${pts}</b> CP <span>of ${info.max} possible</span></p>
      </div>
      <ol class="boxes" style="--n:${info.bfl}">${boxes}</ol>
      <p class="hint">${hint}</p>
    </article>`;
  }).join("");
}

// CP earned per Pokémon: sum of counted results whose team included it.
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
    : `<p class="empty">Add the team you used to each result to see which Pokémon earned your points.</p>`;
}

function render() {
  $("season").textContent = `${RULES.season} season`;
  const counted = computeCounted();
  let total = 0;
  results.forEach((r) => { if (counted.has(r.id)) total += cpOf(r); });
  $("total").textContent = total;
  const n = counted.size;
  $("total-sub").textContent = results.length
    ? `From ${n} counted ${n === 1 ? "result" : "results"}${results.length > n ? `, out of ${results.length} entered` : ""}.`
    : "Add your first result to start counting.";

  renderGroups(counted);
  renderMonChart(counted);

  const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date));
  $("results").innerHTML = sorted.length ? `<ol class="list">${sorted.map((r) => {
    const names = monsOf(r), isIn = counted.has(r.id), cp = cpOf(r);
    const status = isIn ? "" : cp > 0 ? "Not counted: better results fill these places" : "No CP at this placement";
    return `<li><button type="button" class="res${isIn ? "" : " out"}" data-edit="${r.id}">
      <span class="res-main">
        <b>${esc(r.name)}</b>
        <small>${esc(shortType(r.type))}, ${fmtDate(r.date)}. Placed ${ordinal(r.placement)} of ${r.entrants}</small>
        ${names.length ? `<span class="team">${names.map((m) => spriteImg(m, m)).join("")}</span>` : ""}
        ${status ? `<em>${status}</em>` : ""}
        ${r.notes ? `<span class="note">${esc(r.notes)}</span>` : ""}
      </span>
      <span class="res-cp"><b>${cp}</b><small>CP</small></span>
    </button></li>`;
  }).join("")}</ol>` : `<div class="empty-card"><p>No results yet.</p><button type="button" class="primary" data-add>Add your first result</button></div>`;
}

/* ---------- the add / edit sheet ---------- */
const form = $("form");
const sheet = $("sheet");
const slots = () => [...document.querySelectorAll(".slot input")];
$("species-dl").innerHTML = SPECIES_LIST.filter((s) => s.i !== "unknown").map((s) => `<option value="${esc(s.n)}">`).join("");
$("slots").innerHTML = Array.from({ length: 6 }, (_, i) =>
  `<label class="slot"><span class="slot-img" aria-hidden="true"></span><input list="species-dl" placeholder="Pokémon ${i + 1}" autocomplete="off" aria-label="Pokémon ${i + 1}"></label>`).join("");
function paintSlot(inp) {
  const v = inp.value.trim();
  inp.previousElementSibling.innerHTML = v ? spriteImg(v) : "";
}
$("slots").addEventListener("change", (e) => { const sp = resolve(e.target.value); if (sp) e.target.value = sp.n; paintSlot(e.target); });
$("slots").addEventListener("input", (e) => { if (resolve(e.target.value)) paintSlot(e.target); });
$("pasteBtn").onclick = () => {
  const names = teamNames($("paste").value).slice(0, 6);
  if (!names.length) return toast("No Pokémon found in that paste");
  slots().forEach((inp, i) => { inp.value = names[i] ? resolve(names[i])?.n || names[i] : ""; paintSlot(inp); });
  $("paste").value = "";
  $("pasteBtn").closest("details").open = false;
};

const typeEntries = Object.entries(RULES.types);
$("typeSel").innerHTML = typeEntries.map(([k, t], i) =>
  `<label class="type"><input type="radio" name="type" value="${k}"${i === 0 ? " checked" : ""}><span>${esc(shortType(k))}</span></label>`).join("");

function preview() {
  const f = new FormData(form);
  const p = +f.get("placement"), e = +f.get("entrants");
  const el = $("preview");
  const override = f.get("override");
  if (!p || !e) { el.innerHTML = `<span class="ro-label">CP for this result</span><b>–</b><small>Enter where you placed and how many played.</small>`; el.className = "readout zero"; return; }
  if (p > e) { el.innerHTML = `<span class="ro-label">CP for this result</span><b>–</b><small>You can’t place lower than the number of players.</small>`; el.className = "readout zero"; return; }
  const cp = cpFor(f.get("type"), p, e);
  let why = "";
  if (!cp) {
    const t = RULES.types[f.get("type")];
    const row = t.table.find(([max]) => p <= max);
    why = !row ? `Only the top ${t.table[t.table.length - 1][0]} earn CP at this kind of event.`
               : `${ordinal(p)} place earns CP only with at least ${row[1]} players.`;
  }
  const shown = override !== "" && override != null ? +override : cp;
  el.innerHTML = `<span class="ro-label">CP for this result</span><b>${shown}</b><small>${
    override !== "" && override != null ? `Your figure. The table gives ${cp}.` : cp ? `${ordinal(p)} of ${e} players.` : why}</small>`;
  el.className = "readout" + (shown ? "" : " zero");
}
form.addEventListener("input", preview);

function openSheet(r) {
  editing = r ? r.id : null;
  form.reset();
  if (r) {
    for (const k of ["name", "date", "placement", "entrants", "notes"]) form.elements[k].value = r[k] ?? "";
    form.querySelector(`input[name="type"][value="${r.type}"]`).checked = true;
    form.elements.override.value = r.override ?? "";
    form.querySelectorAll("details").forEach((d) => { d.open = r.override != null && d.querySelector('[name="override"]'); });
  } else {
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    form.querySelectorAll("details").forEach((d) => { d.open = false; });
  }
  const m = r ? monsOf(r) : [];
  slots().forEach((inp, i) => { inp.value = m[i] || ""; paintSlot(inp); });
  $("sheet-h").textContent = r ? "Edit result" : "Add result";
  $("saveBtn").textContent = r ? "Save changes" : "Save result";
  $("deleteBtn").hidden = !r;
  preview();
  sheet.showModal();
  if (!r) form.elements.name.focus();
}
const closeSheet = () => { sheet.close(); editing = null; };
$("addBtn").onclick = () => openSheet();
$("closeBtn").onclick = closeSheet;
$("cancelBtn").onclick = closeSheet;
sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  if (+f.placement > +f.entrants) { toast("Your placing can’t be higher than the number of players"); return; }
  const r = {
    id: editing || crypto.randomUUID(),
    name: f.name.trim(), date: f.date, type: f.type,
    placement: +f.placement, entrants: +f.entrants,
    override: f.override === "" ? null : +f.override,
    mons: slots().map((i) => i.value.trim()).filter(Boolean), notes: f.notes,
  };
  const wasEditing = !!editing;
  results = editing ? results.map((x) => (x.id === editing ? r : x)) : [...results, r];
  save(); closeSheet(); render();
  toast(wasEditing ? "Result updated" : `Saved: ${cpOf(r)} CP`);
});

$("deleteBtn").onclick = () => {
  if (!editing || !confirm("Delete this result?")) return;
  results = results.filter((r) => r.id !== editing);
  save(); closeSheet(); render(); toast("Result deleted");
};

document.addEventListener("click", (e) => {
  const ed = e.target.closest("[data-edit]");
  if (ed) openSheet(results.find((x) => x.id === ed.dataset.edit));
  if (e.target.closest("[data-add]")) openSheet();
});

/* ---------- backup ---------- */
$("exportBtn").onclick = () => {
  if (!results.length) return toast("Nothing to save yet");
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
    if (!results.length || confirm(`Replace your ${results.length} results with the ${data.length} in this backup?`)) {
      results = data; save(); render(); toast(`Loaded ${data.length} results`);
    }
  } catch { toast("That file isn’t a CP Tracker backup"); }
  e.target.value = "";
};

let tt;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2600);
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
render();

$("theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.cookie = `theme=${next}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
});
