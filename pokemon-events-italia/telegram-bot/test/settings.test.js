import test from "node:test";
import assert from "node:assert/strict";
import { rootMenuView, regionMenuView, applyCallback, storeMenuView, storeSearchResultsView, modeMenuView } from "../src/settings.js";
import { defaultPrefs } from "../src/prefs.js";

test("rootMenuView lists all four filter categories, the workmode, and a Fatto button", () => {
  const view = rootMenuView(defaultPrefs());
  assert.match(view.text, /Regioni: Tutte/);
  assert.match(view.text, /Tipo evento: Tutte/);
  assert.match(view.text, /Gioco: Tutte/);
  assert.match(view.text, /Negozi specifici: Nessun filtro/);
  assert.match(view.text, /Modalità: 📬📋 Entrambe/);
  const flatButtons = view.reply_markup.inline_keyboard.flat();
  assert.ok(flatButtons.some((b) => b.callback_data === "nav:done"));
  assert.ok(flatButtons.some((b) => b.callback_data === "nav:store"));
  assert.ok(flatButtons.some((b) => b.callback_data === "nav:mode"));
});

test("modeMenuView marks the chat's current mode and offers the other two", () => {
  const view = modeMenuView({ ...defaultPrefs(), mode: "list" });
  const buttons = view.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.find((b) => b.callback_data === "setmode:list").text.startsWith("✅"));
  assert.ok(buttons.find((b) => b.callback_data === "setmode:both").text.startsWith("⬜"));
  assert.ok(buttons.find((b) => b.callback_data === "setmode:digest").text.startsWith("⬜"));
});

test("regionMenuView marks every region checked by default", () => {
  const view = regionMenuView(defaultPrefs());
  const buttons = view.reply_markup.inline_keyboard.flat();
  const regionButtons = buttons.filter((b) => b.callback_data.startsWith("tgl:region:"));
  assert.equal(regionButtons.length, 20);
  assert.ok(regionButtons.every((b) => b.text.startsWith("✅")));
});

test("applyCallback: toggling a region off is reflected in the next region view", () => {
  const { prefs, view } = applyCallback("tgl:region:LOMBARDIA", defaultPrefs());
  assert.deepEqual(prefs.regions.includes("LOMBARDIA"), false);
  const lombardiaButton = view.reply_markup.inline_keyboard.flat().find((b) => b.callback_data === "tgl:region:LOMBARDIA");
  assert.ok(lombardiaButton.text.startsWith("⬜"));
});

test("applyCallback: nav:done returns a null view (caller clears the keyboard)", () => {
  const { view } = applyCallback("nav:done", defaultPrefs());
  assert.equal(view, null);
});

test("applyCallback: all:type resets to unfiltered", () => {
  const narrowed = { ...defaultPrefs(), types: ["cup"] };
  const { prefs } = applyCallback("all:type", narrowed);
  assert.equal(prefs.types, null);
});

test("applyCallback: none:game empties the selection (mutes that dimension)", () => {
  const { prefs } = applyCallback("none:game", defaultPrefs());
  assert.deepEqual(prefs.games, []);
});

test("storeMenuView renders a remove button per selected store using the venue index", () => {
  const venueIndex = new Map([["S1", { id: "S1", name: "Game Store Milano" }]]);
  const prefs = { ...defaultPrefs(), stores: ["S1"] };
  const view = storeMenuView(prefs, venueIndex);
  const button = view.reply_markup.inline_keyboard.flat().find((b) => b.callback_data === "tglstore:S1");
  assert.match(button.text, /Game Store Milano/);
});

test("storeSearchResultsView shows a toggle per match, checked if already selected", () => {
  const prefs = { ...defaultPrefs(), stores: ["S1"] };
  const matches = [{ id: "S1", name: "Game Store Milano" }, { id: "S2", name: "Game Store Roma" }];
  const view = storeSearchResultsView(matches, prefs);
  const buttons = view.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.find((b) => b.callback_data === "tglstore:S1").text.startsWith("✅"));
  assert.ok(buttons.find((b) => b.callback_data === "tglstore:S2").text.startsWith("⬜"));
});
