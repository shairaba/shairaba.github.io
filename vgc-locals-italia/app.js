// Self-contained copy of the sprite/fetch helpers from
// ../vgc-tournament-explorer/app.js (per this repo's per-app-independence
// convention - each sub-app owns its own copy rather than cross-importing).
//
// i18n follows ../pokemon-events-italia/app.js's exact pattern (TRANSLATIONS
// dict, t()/getLang()/setLang()/applyTranslations()/initLangToggle()) -
// only UI chrome is translated (labels, buttons, headings). Tournament
// names, player names, and species names are user-submitted/data-driven and
// deliberately left as-is in both languages.

const TRANSLATIONS = {
  it: {
    navTournaments: "Tornei",
    navDashboard: "Statistiche",
    themeToggleLabel: "Cambia tema",
    footnoteDisclaimer: "Non affiliato a The Pokémon Company International.",

    indexH1: "Locals VGC Italia",
    searchPlaceholder: "Cerca per torneo o nome Pokémon…",
    filterAll: "Tutti",
    loading: "Caricamento…",
    showingNote: (shown, total) => `Mostrati ${shown} di ${total} tornei.`,
    noMatchFilters: "Nessun torneo corrisponde ai filtri.",
    noTournamentsYet: "Nessun torneo ancora inviato - sii il primo!",
    winnerLabel: (name) => `Vincitore: ${name}`,
    noTeamsYet: "Nessuna squadra ancora inviata.",
    anonymous: "Anonimo",
    cardMeta: (date, n, k) => `${date} · ${n} giocatori → top ${k}`,

    dashboardH1: "Utilizzo nel Top Cut",
    dashboardLede:
      "Statistiche di utilizzo inviate dalla community, dai top cut dei tornei locali VGC italiani (top 2, 4 o 8, a seconda del numero di partecipanti - non l'intero campo di gioco), quindi questi numeri non sono direttamente confrontabili con siti di meta-utilizzo completo come pikalytics.",
    statLocalsCounted: "Locals conteggiati",
    statTopCutTeams: "Squadre in top cut conteggiate",
    mostUsedHeading: "Pokémon più usati nel top cut",
    noDataYet: "Nessun dato ancora - torna quando saranno stati inviati dei locals.",

    submitH1: "Invia un torneo",
    submitLede:
      "Per gli organizzatori: inserisci il tuo evento una volta, poi la squadra di 6 Pokémon di ogni giocatore in top cut. Includi solo i giocatori arrivati nel top cut ufficiale, non l'intera lista iscritti.",
    submitNotice:
      "Questo invia i dati direttamente al foglio di calcolo dei risultati - non c'è login, quindi invia solo i tornei che hai davvero organizzato.",
    tournamentDetailsHeading: "Dettagli del torneo",
    labelTournamentName: "Nome del torneo",
    placeholderTournamentName: "es. Milano Winter Locals #3",
    labelDate: "Data",
    labelTournamentType: "Tipo di torneo",
    selectPlaceholder: "Seleziona…",
    labelNumberOfPlayers: "Numero di giocatori",
    placeholderNumberOfPlayers: "es. 14",
    hintTopCutSize: "Determina la dimensione del top cut: <9 → top 2, 9-16 → top 4, 17+ → top 8.",
    labelToName: "Il tuo nome (organizzatore)",
    placeholderToName: "Solo per eventuali chiarimenti, non mostrato pubblicamente",
    continueBtn: "Continua con le squadre",
    topCutTeamsHeading: "Squadre del top cut",
    stepTwoSummary: (name, type, n, k) =>
      `${name} - ${type} - ${n} iscritti → top ${k}. Inserisci la squadra di ogni giocatore del top cut qui sotto.`,
    playerNameLabel: "Nome giocatore (opzionale)",
    searchPlaceholderShort: "Cerca…",
    pokemonLabel: (n) => `Pokémon ${n}`,
    placeLabel: (n) => `${n}° posto`,
    backBtn: "Indietro",
    submitAllBtn: "Invia tutte le squadre",
    progressLine: (i, total) => `Invio squadra ${i} di ${total}…`,
    submittedHeading: "Inviato",
    doneSummary: (count, name) =>
      `${count === 1 ? "1 squadra inviata" : `${count} squadre inviate`} per "${name}". ` +
      "Poiché questa pagina non può confermare che Google abbia ricevuto ogni invio (vedi la nota qui sotto), " +
      "controlla il foglio di risposta una volta finito.",
    submitAnotherBtn: "Invia un altro torneo",
    backToTournamentsBtn: "Torna ai tornei",
    submitFootnote:
      "Questa pagina invia i dati direttamente al modulo Google dei risultati (vedi il codice sorgente del sito per i dettagli) invece di mandarti al modulo stesso - non può confermare che Google abbia ricevuto ogni invio, dato che la richiesta parte cross-origin. Se qualcosa non torna, i dati del torneo si trovano anche direttamente nel foglio di risposta del modulo.",
    fieldRequired: "Obbligatorio.",
    fieldPositiveNumber: "Inserisci un numero intero positivo.",
    fieldUnknownSpecies: "Pokémon non riconosciuto - scegline uno dalla lista.",
    speciesNoMatch: "Nessun risultato.",

    breadcrumbAllTournaments: "← Tutti i tornei",
    allTeamsHeading: "Tutte le squadre del top cut",
    noTeamsForTournamentYet: "Nessuna squadra ancora inviata per questo torneo.",
  },
  en: {
    navTournaments: "Tournaments",
    navDashboard: "Dashboard",
    themeToggleLabel: "Toggle dark mode",
    footnoteDisclaimer: "Not affiliated with The Pokémon Company International.",

    indexH1: "Italian VGC Locals",
    searchPlaceholder: "Search by tournament or Pokémon name…",
    filterAll: "All",
    loading: "Loading…",
    showingNote: (shown, total) => `Showing ${shown} of ${total} tournaments.`,
    noMatchFilters: "No tournaments match those filters.",
    noTournamentsYet: "No tournaments submitted yet - be the first!",
    winnerLabel: (name) => `Winner: ${name}`,
    noTeamsYet: "No teams submitted yet.",
    anonymous: "Anonymous",
    cardMeta: (date, n, k) => `${date} · ${n} players → top ${k}`,

    dashboardH1: "Top Cut Usage",
    dashboardLede:
      "Community-submitted usage stats from Italian VGC local tournaments' top cuts (top 2, 4, or 8, depending on turnout - not the full entrant field), so these numbers aren't directly comparable to full-meta usage sites like pikalytics.",
    statLocalsCounted: "Locals counted",
    statTopCutTeams: "Top-cut teams counted",
    mostUsedHeading: "Most used Pokémon in top cut",
    noDataYet: "No data yet - check back once locals have been submitted.",

    submitH1: "Submit a tournament",
    submitLede:
      "For tournament organizers: enter your event once, then each top-cut player's 6-Pokémon team. Only include players who made it into the official top cut - not the full entrant list.",
    submitNotice:
      "This sends data straight to the results spreadsheet - there's no login, so please only submit tournaments you actually ran.",
    tournamentDetailsHeading: "Tournament details",
    labelTournamentName: "Tournament name",
    placeholderTournamentName: "e.g. Milano Winter Locals #3",
    labelDate: "Date",
    labelTournamentType: "Type of tournament",
    selectPlaceholder: "Select…",
    labelNumberOfPlayers: "Number of players",
    placeholderNumberOfPlayers: "e.g. 14",
    hintTopCutSize: "Determines top cut size: <9 → top 2, 9-16 → top 4, 17+ → top 8.",
    labelToName: "Your name (tournament organizer)",
    placeholderToName: "For follow-up only, not shown publicly",
    continueBtn: "Continue to team entry",
    topCutTeamsHeading: "Top-cut teams",
    stepTwoSummary: (name, type, n, k) =>
      `${name} - ${type} - ${n} entrants → top ${k}. Enter each top-cut player's team below.`,
    playerNameLabel: "Player name (optional)",
    searchPlaceholderShort: "Search…",
    pokemonLabel: (n) => `Pokémon ${n}`,
    placeLabel: (n) => {
      const suffixes = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]} place`;
    },
    backBtn: "Back",
    submitAllBtn: "Submit all teams",
    progressLine: (i, total) => `Submitting team ${i} of ${total}…`,
    submittedHeading: "Submitted",
    doneSummary: (count, name) =>
      `Submitted ${count} team${count === 1 ? "" : "s"} for "${name}". ` +
      "Since this page can't confirm Google actually received each one (see the note below), " +
      "double check the response Sheet once you're done.",
    submitAnotherBtn: "Submit another tournament",
    backToTournamentsBtn: "Back to tournaments",
    submitFootnote:
      "This page posts directly to the results Google Form behind the scenes (see the site's source for details) rather than sending you to the Form itself - it can't confirm Google actually received each submission, since that request is fired cross-origin. If something looks off, the tournament data also lives in the Form's response spreadsheet directly.",
    fieldRequired: "Required.",
    fieldPositiveNumber: "Enter a positive whole number.",
    fieldUnknownSpecies: "Not a recognized Pokémon - pick one from the list.",
    speciesNoMatch: "No match.",

    breadcrumbAllTournaments: "← All tournaments",
    allTeamsHeading: "All top-cut teams",
    noTeamsForTournamentYet: "No teams submitted for this tournament yet.",
  },
};

const LANG_STORAGE_KEY = "lang";

function getLang() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return stored && TRANSLATIONS[stored] ? stored : "it";
}

function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

function t(key, ...args) {
  const entry = TRANSLATIONS[getLang()][key];
  return typeof entry === "function" ? entry(...args) : entry;
}

/* Walks the DOM applying the current language to every element tagged with
   data-i18n (textContent), data-i18n-placeholder, or data-i18n-aria-label -
   static markup only. Dynamic JS-rendered content (tournament cards, form
   steps) reads t() directly at render time instead. */
function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = getLang();
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === getLang());
  });
}

/* Wires the IT/EN toggle present in every page's topbar. `onChange` runs
   after the language switches and static markup is retranslated, so each
   page can re-render its own dynamic content (tournament cards, dashboard
   meters, form steps). */
function initLangToggle(onChange) {
  applyTranslations();
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      applyTranslations();
      if (onChange) onChange();
    });
  });
}

const LIMITLESS_SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9";
const POKESTATS_SPRITE_BASE = "https://pokestats.top/images/pokemon/imgs";

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
