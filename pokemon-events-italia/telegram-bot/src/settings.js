import { REGION_LABELS, REGION_KEYS, TYPE_LABELS, TYPE_KEYS, GAME_LABELS, GAME_KEYS } from "./data.js";
import { passesFilter, toggleValue, summarizeSelection } from "./prefs.js";
import { venueName } from "./venues.js";

/* Everything in this file is pure (menu text/keyboard in, no I/O) so it can
   be unit-tested and reasoned about without a real Telegram connection or
   KV binding - index.js is the only place that actually talks to Telegram
   or storage. */

export function rootMenuView(prefs) {
  const storesSummary = prefs.stores === null || prefs.stores === undefined
    ? "Nessun filtro"
    : `${prefs.stores.length} selezionati`;
  const text =
    "⚙️ <b>Le tue preferenze</b>\n\n" +
    `🗺 Regioni: ${summarizeSelection(prefs.regions, REGION_LABELS, REGION_KEYS)}\n` +
    `🏆 Tipo evento: ${summarizeSelection(prefs.types, TYPE_LABELS, TYPE_KEYS)}\n` +
    `🎮 Gioco: ${summarizeSelection(prefs.games, GAME_LABELS, GAME_KEYS)}\n` +
    `🏪 Negozi specifici: ${storesSummary}\n\n` +
    "Riceverai un riepilogo giornaliero dei nuovi eventi che rispettano questi filtri. Scegli una categoria da modificare:";
  return {
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗺 Regioni", callback_data: "nav:region" }],
        [{ text: "🏆 Tipo evento", callback_data: "nav:type" }],
        [{ text: "🎮 Gioco", callback_data: "nav:game" }],
        [{ text: "🏪 Negozi specifici", callback_data: "nav:store" }],
        [{ text: "✅ Fatto", callback_data: "nav:done" }],
      ],
    },
  };
}

function checklistView({ title, dimension, labels, keys, selected, columns }) {
  const rows = [];
  for (let i = 0; i < keys.length; i += columns) {
    rows.push(
      keys.slice(i, i + columns).map((key) => ({
        text: `${passesFilter(selected, key) ? "✅" : "⬜"} ${labels[key]}`,
        callback_data: `tgl:${dimension}:${key}`,
      }))
    );
  }
  rows.push([
    { text: "☑️ Tutte", callback_data: `all:${dimension}` },
    { text: "◻️ Nessuna", callback_data: `none:${dimension}` },
  ]);
  rows.push([{ text: "‹ Indietro", callback_data: "nav:root" }]);
  return {
    text: `${title}\n\nTocca per selezionare/deselezionare. Nessuna selezione = tutte incluse.`,
    reply_markup: { inline_keyboard: rows },
  };
}

export function regionMenuView(prefs) {
  return checklistView({
    title: "🗺 <b>Regioni</b>",
    dimension: "region",
    labels: REGION_LABELS,
    keys: REGION_KEYS,
    selected: prefs.regions,
    columns: 2,
  });
}

export function typeMenuView(prefs) {
  return checklistView({
    title: "🏆 <b>Tipo evento</b>",
    dimension: "type",
    labels: TYPE_LABELS,
    keys: TYPE_KEYS,
    selected: prefs.types,
    columns: 1,
  });
}

export function gameMenuView(prefs) {
  return checklistView({
    title: "🎮 <b>Gioco</b>",
    dimension: "game",
    labels: GAME_LABELS,
    keys: GAME_KEYS,
    selected: prefs.games,
    columns: 1,
  });
}

const DIMENSION_FIELD = { region: "regions", type: "types", game: "games" };
const DIMENSION_KEYS = { region: REGION_KEYS, type: TYPE_KEYS, game: GAME_KEYS };
const DIMENSION_VIEW = { region: regionMenuView, type: typeMenuView, game: gameMenuView };

/* Applies one callback_data action to prefs (pure - returns a NEW prefs
   object, doesn't mutate) and reports which view should be (re-)rendered
   next. index.js persists the returned prefs to KV and edits the Telegram
   message using the returned view. */
export function applyCallback(data, prefs) {
  const [action, dimension, key] = data.split(":");

  if (action === "nav") {
    if (dimension === "root") return { prefs, view: rootMenuView(prefs) };
    if (dimension === "done") return { prefs, view: null };
    if (DIMENSION_VIEW[dimension]) return { prefs, view: DIMENSION_VIEW[dimension](prefs) };
    return { prefs, view: rootMenuView(prefs) };
  }

  const field = DIMENSION_FIELD[dimension];
  if (!field) return { prefs, view: rootMenuView(prefs) };
  const keys = DIMENSION_KEYS[dimension];

  let nextPrefs = prefs;
  if (action === "tgl") {
    nextPrefs = { ...prefs, [field]: toggleValue(prefs[field], keys, key) };
  } else if (action === "all") {
    nextPrefs = { ...prefs, [field]: null };
  } else if (action === "none") {
    nextPrefs = { ...prefs, [field]: [] };
  }
  return { prefs: nextPrefs, view: DIMENSION_VIEW[dimension](nextPrefs) };
}

/* Stores are handled outside applyCallback (unlike region/type/game) since
   rendering their menu needs a live venue name lookup (venueIndex, built
   from events.json - see venues.js) rather than a small static label map,
   and search results need a query string that persists across the
   "type a message" round trip. index.js routes nav:store / nav:storesearch
   / tglstore:* / clearstore callbacks here directly. */
export function storeMenuView(prefs, venueIndex) {
  const selected = prefs.stores || [];
  const rows = selected.map((id) => [
    { text: `✅ ${venueName(venueIndex, id)}`, callback_data: `tglstore:${id}` },
  ]);
  rows.push([{ text: "🔍 Cerca un negozio", callback_data: "nav:storesearch" }]);
  if (selected.length > 0) rows.push([{ text: "🗑 Rimuovi filtro negozi", callback_data: "clearstore" }]);
  rows.push([{ text: "‹ Indietro", callback_data: "nav:root" }]);
  const summary =
    selected.length === 0
      ? "Nessun filtro: tutti i negozi che rispettano le altre categorie sono inclusi."
      : `${selected.length} negozi selezionati - solo questi verranno inclusi (in aggiunta agli altri filtri).`;
  return {
    text: `🏪 <b>Negozi specifici</b>\n\n${summary}\n\nTocca un negozio nella lista per rimuoverlo, o cerca per aggiungerne uno nuovo.`,
    reply_markup: { inline_keyboard: rows },
  };
}

export function storeSearchResultsView(matches, prefs) {
  const selected = prefs.stores || [];
  const rows = matches.map((v) => [
    { text: `${selected.includes(v.id) ? "✅" : "⬜"} ${v.name}`, callback_data: `tglstore:${v.id}` },
  ]);
  rows.push([{ text: "‹ Indietro", callback_data: "nav:store" }]);
  const text = matches.length
    ? `Risultati (${matches.length}):`
    : "Nessun negozio trovato con questo nome. Prova a scrivere una parte diversa del nome.";
  return { text, reply_markup: { inline_keyboard: rows } };
}

export function storeSearchPromptView() {
  return {
    text: "🔍 Scrivi il nome (o parte del nome) del negozio che stai cercando.",
    reply_markup: { inline_keyboard: [[{ text: "‹ Annulla", callback_data: "nav:store" }]] },
  };
}
