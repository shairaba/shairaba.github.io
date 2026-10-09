import test from "node:test";
import assert from "node:assert/strict";
import { matchesListFilters, buildListTexts } from "../src/list.js";
import { defaultPrefs } from "../src/prefs.js";

const NOW = new Date("2026-09-10T00:00:00Z").getTime();

function makeEvent(overrides = {}) {
  return {
    guid: "g1",
    first_seen_at: "2025-01-01T00:00:00Z",
    start_date: "2026-09-20T18:00:00Z",
    region: "LOMBARDIA",
    products: ["vg"],
    activity_type: "tournament",
    series_name: "",
    activity_group_display_id: "STORE1",
    activity_group_name: "Store One",
    timezone: "Europe/Rome",
    ...overrides,
  };
}

test("matchesListFilters: ignores first_seen_at/last_updated_at entirely - old events still match", () => {
  const event = makeEvent({ first_seen_at: "2020-01-01T00:00:00Z" });
  assert.equal(matchesListFilters(event, defaultPrefs(), NOW), true);
});

test("matchesListFilters: rejects events that already started", () => {
  const event = makeEvent({ start_date: "2026-09-01T00:00:00Z" });
  assert.equal(matchesListFilters(event, defaultPrefs(), NOW), false);
});

test("matchesListFilters: rejects an event the locator no longer lists (is_active: false), even if it's still upcoming", () => {
  const event = makeEvent({ is_active: false });
  assert.equal(matchesListFilters(event, defaultPrefs(), NOW), false);
});

test("matchesListFilters: accepts an event with is_active explicitly true or simply absent", () => {
  assert.equal(matchesListFilters(makeEvent({ is_active: true }), defaultPrefs(), NOW), true);
  assert.equal(matchesListFilters(makeEvent({ is_active: undefined }), defaultPrefs(), NOW), true);
});

test("matchesListFilters: region filter", () => {
  const prefs = { ...defaultPrefs(), regions: ["LOMBARDIA"] };
  assert.equal(matchesListFilters(makeEvent({ region: "LAZIO" }), prefs, NOW), false);
  assert.equal(matchesListFilters(makeEvent({ region: "LOMBARDIA" }), prefs, NOW), true);
});

test("matchesListFilters: store filter", () => {
  const prefs = { ...defaultPrefs(), stores: ["STORE2"] };
  assert.equal(matchesListFilters(makeEvent({ activity_group_display_id: "STORE1" }), prefs, NOW), false);
  assert.equal(matchesListFilters(makeEvent({ activity_group_display_id: "STORE2" }), prefs, NOW), true);
});

test("matchesListFilters: type and game filters apply the same as the digest", () => {
  const typePrefs = { ...defaultPrefs(), types: ["cup"] };
  assert.equal(matchesListFilters(makeEvent({ series_name: "VGC League Cup Round 1" }), typePrefs, NOW), true);
  assert.equal(matchesListFilters(makeEvent(), typePrefs, NOW), false);

  const gamePrefs = { ...defaultPrefs(), games: ["tcg"] };
  assert.equal(matchesListFilters(makeEvent({ products: ["vg"] }), gamePrefs, NOW), false);
  assert.equal(matchesListFilters(makeEvent({ products: ["vg", "tcg"] }), gamePrefs, NOW), true);
});

test("buildListTexts: a small result still produces exactly MAX_PAGES (2) messages - page 1 has the content, page 2 is a placeholder", () => {
  const later = makeEvent({ guid: "g2", start_date: "2026-10-01T00:00:00Z" });
  const sooner = makeEvent({ guid: "g3", start_date: "2026-09-15T00:00:00Z" });
  const pages = buildListTexts([makeEvent(), later, sooner], defaultPrefs(), NOW);
  assert.equal(pages.length, 2);
  assert.match(pages[0], /tutte le regioni/);
  assert.match(pages[0], /\(1\/2\)/);
  assert.match(pages[1], /\(2\/2\)/);
  assert.match(pages[1], /Nessun altro torneo in programma/);
  assert.match(pages[1], /Aggiornato: /, "the placeholder page is still a live standing message, not dead text");
  const posSooner = pages[0].indexOf("guid=g3");
  const posFirst = pages[0].indexOf("guid=g1");
  const posLater = pages[0].indexOf("guid=g2");
  assert.ok(posSooner < posFirst && posFirst < posLater, "expected chronological order (soonest first)");
});

test("buildListTexts: past events are excluded even though matchesChat-style change detection doesn't apply here", () => {
  const past = makeEvent({ guid: "g2", start_date: "2020-01-01T00:00:00Z" });
  const [page] = buildListTexts([makeEvent(), past], defaultPrefs(), NOW);
  assert.ok(!page.includes("guid=g2"));
  assert.ok(page.includes("guid=g1"));
});

test("buildListTexts: shows address, price, and the directions/signup links only when the event actually has them", () => {
  const [bare] = buildListTexts([makeEvent()], defaultPrefs(), NOW);
  assert.ok(!bare.includes("🗺"));
  assert.ok(!bare.includes("💰"));
  assert.ok(!bare.includes("Portami lì"));
  assert.ok(!bare.includes("Preiscrizioni"));

  const [rich] = buildListTexts(
    [
      makeEvent({
        full_address: "VIA GIOSUÈ CARDUCCI, 18, 20092 CINISELLO BALSAMO MI, ITALY",
        admission: "5",
        latitude: 45.5,
        longitude: 9.2,
        third_party_registration_website: "https://example.com/signup",
      }),
    ],
    defaultPrefs(),
    NOW
  );
  assert.match(rich, /🗺 VIA GIOSUÈ CARDUCCI, 18, 20092 CINISELLO BALSAMO MI(?!, ITALY)/);
  assert.match(rich, /💰 5€/);
  assert.match(rich, /<a href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=45\.5,9\.2">Portami lì<\/a>/);
  assert.match(rich, /<a href="https:\/\/example\.com\/signup">Preiscrizioni<\/a>/);
});

test("buildListTexts: an empty result still produces MAX_PAGES (2) messages, both saying so rather than an empty list", () => {
  const pages = buildListTexts([makeEvent({ region: "LAZIO" })], { ...defaultPrefs(), regions: ["SICILIA"] }, NOW);
  assert.equal(pages.length, 2);
  assert.match(pages[0], /Nessun torneo in programma/);
  assert.match(pages[1], /Nessun altro torneo in programma/);
});

test("buildListTexts: header reflects a store-scoped selection over a region-scoped one", () => {
  const prefs = { ...defaultPrefs(), regions: ["LOMBARDIA"], stores: ["STORE1", "STORE2"] };
  const [page] = buildListTexts([makeEvent()], prefs, NOW);
  assert.match(page, /2 negozi selezionati/);
});

test("buildListTexts: page 2 turns from a placeholder into real content once a later refresh has enough events to need it", () => {
  const [, placeholderPage2] = buildListTexts([makeEvent()], defaultPrefs(), NOW);
  assert.match(placeholderPage2, /Nessun altro torneo in programma/);

  const many = Array.from({ length: 35 }, (_, i) =>
    makeEvent({
      guid: `g${i}`,
      start_date: `2026-09-${String(11 + (i % 18)).padStart(2, "0")}T18:00:00Z`,
      full_address: `VIA DELLO SPORT ${i}, 20100 MILANO MI`,
    })
  );
  const [, realPage2] = buildListTexts(many, defaultPrefs(), NOW);
  assert.ok(!realPage2.includes("Nessun altro torneo in programma"));
  assert.match(realPage2, /guid=g/, "page 2 now carries actual event links instead of the placeholder");
});

test("buildListTexts: a result too long for one message splits into a second, tagged and within the limit", () => {
  const many = Array.from({ length: 35 }, (_, i) =>
    makeEvent({
      guid: `g${i}`,
      start_date: `2026-09-${String(11 + (i % 18)).padStart(2, "0")}T18:00:00Z`,
      full_address: `VIA DELLO SPORT ${i}, 20100 MILANO MI`,
    })
  );
  const pages = buildListTexts(many, defaultPrefs(), NOW);
  assert.equal(pages.length, 2, "expected exactly two messages, not one or more than the cap");
  for (const page of pages) assert.ok(page.length <= 4096, "each page must stay under Telegram's limit");
  assert.match(pages[0], /\(1\/2\)/);
  assert.match(pages[1], /\(2\/2\)/);
});

test("buildListTexts: even a result that would otherwise need many more pages is hard-capped at MAX_PAGES (2)", () => {
  const many = Array.from({ length: 200 }, (_, i) =>
    makeEvent({
      guid: `g${i}`,
      start_date: `2026-09-${String(11 + (i % 18)).padStart(2, "0")}T18:00:00Z`,
      full_address: `VIA DELLO SPORT ${i}, 20100 MILANO MI`,
      admission: "5",
      latitude: 45.5,
      longitude: 9.2,
      third_party_registration_website: "https://example.com/signup",
    })
  );
  const pages = buildListTexts(many, defaultPrefs(), NOW);
  assert.equal(pages.length, 2);
  assert.match(pages[1], /e altri \d+ eventi/, "the events that didn't fit in 2 pages should be counted as omitted, not silently dropped");
});

test("buildListTexts: only the last page carries the 'Aggiornato' timestamp", () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    makeEvent({
      guid: `g${i}`,
      start_date: `2026-09-${String(11 + (i % 18)).padStart(2, "0")}T18:00:00Z`,
      full_address: `VIA DELLO SPORT ${i}, 20100 MILANO MI`,
    })
  );
  const pages = buildListTexts(many, defaultPrefs(), NOW);
  assert.ok(pages.length > 1);
  for (const page of pages.slice(0, -1)) assert.ok(!page.includes("Aggiornato:"));
  assert.match(pages[pages.length - 1], /Aggiornato: /);
});

test("buildListTexts: caps the total number of events shown and notes how many were left out, only on the last page", () => {
  const many = Array.from({ length: 90 }, (_, i) =>
    makeEvent({ guid: `g${i}`, start_date: `2026-09-${String(11 + (i % 18)).padStart(2, "0")}T18:00:00Z` })
  );
  const pages = buildListTexts(many, defaultPrefs(), NOW);
  assert.match(pages[pages.length - 1], /e altri \d+ eventi/);
  for (const page of pages.slice(0, -1)) assert.ok(!page.includes("altri"));
});
