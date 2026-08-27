import test from "node:test";
import assert from "node:assert/strict";
import { matchesChat, formatDigest, buildDigests, isNewEvent } from "../src/digest.js";
import { defaultPrefs } from "../src/prefs.js";

const NOW = new Date("2026-09-10T00:00:00Z").getTime();
const YESTERDAY = new Date("2026-09-09T00:00:00Z").getTime();

function makeEvent(overrides = {}) {
  return {
    guid: "g1",
    first_seen_at: "2026-09-09T12:00:00Z",
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

test("matchesChat: rejects events not new since last check", () => {
  const event = makeEvent({ first_seen_at: "2026-09-01T00:00:00Z" });
  assert.equal(matchesChat(event, defaultPrefs(), YESTERDAY, NOW), false);
});

test("matchesChat: rejects events that already started", () => {
  const event = makeEvent({ start_date: "2026-09-01T00:00:00Z" });
  assert.equal(matchesChat(event, defaultPrefs(), YESTERDAY, NOW), false);
});

test("matchesChat: accepts a new upcoming event with default (unfiltered) prefs", () => {
  const event = makeEvent();
  assert.equal(matchesChat(event, defaultPrefs(), YESTERDAY, NOW), true);
});

test("matchesChat: region filter", () => {
  const event = makeEvent({ region: "LAZIO" });
  const prefs = { ...defaultPrefs(), regions: ["LOMBARDIA"] };
  assert.equal(matchesChat(event, prefs, YESTERDAY, NOW), false);
  assert.equal(matchesChat(makeEvent({ region: "LOMBARDIA" }), prefs, YESTERDAY, NOW), true);
});

test("matchesChat: type filter uses the same series_name-based classification as the site", () => {
  const cupEvent = makeEvent({ series_name: "VGC League Cup Round 1" });
  const prefs = { ...defaultPrefs(), types: ["cup"] };
  assert.equal(matchesChat(cupEvent, prefs, YESTERDAY, NOW), true);
  assert.equal(matchesChat(makeEvent({ activity_type: "play_session" }), prefs, YESTERDAY, NOW), false);
});

test("matchesChat: game filter checks intersection with products", () => {
  const prefs = { ...defaultPrefs(), games: ["tcg"] };
  assert.equal(matchesChat(makeEvent({ products: ["vg"] }), prefs, YESTERDAY, NOW), false);
  assert.equal(matchesChat(makeEvent({ products: ["vg", "tcg"] }), prefs, YESTERDAY, NOW), true);
});

test("matchesChat: store filter restricts to specific venues", () => {
  const prefs = { ...defaultPrefs(), stores: ["STORE2"] };
  assert.equal(matchesChat(makeEvent({ activity_group_display_id: "STORE1" }), prefs, YESTERDAY, NOW), false);
  assert.equal(matchesChat(makeEvent({ activity_group_display_id: "STORE2" }), prefs, YESTERDAY, NOW), true);
});

test("matchesChat: catches an edited event even though it was first seen long before the cutoff", () => {
  const edited = makeEvent({ first_seen_at: "2026-08-01T00:00:00Z", last_updated_at: "2026-09-09T18:00:00Z" });
  assert.equal(matchesChat(edited, defaultPrefs(), YESTERDAY, NOW), true);
});

test("matchesChat: an old event that hasn't changed since the cutoff is still excluded", () => {
  const stale = makeEvent({ first_seen_at: "2026-08-01T00:00:00Z", last_updated_at: "2026-08-01T00:00:00Z" });
  assert.equal(matchesChat(stale, defaultPrefs(), YESTERDAY, NOW), false);
});

test("isNewEvent: true when never edited since creation (no last_updated_at, or equal to first_seen_at)", () => {
  assert.equal(isNewEvent(makeEvent()), true);
  assert.equal(isNewEvent(makeEvent({ last_updated_at: "2026-09-09T12:00:00Z" })), true);
});

test("isNewEvent: false once last_updated_at has moved past first_seen_at", () => {
  assert.equal(isNewEvent(makeEvent({ last_updated_at: "2026-09-10T00:00:00Z" })), false);
});

test("formatDigest: includes a count header and one block per event", () => {
  const messages = formatDigest([makeEvent(), makeEvent({ guid: "g2" })]);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /2 nuovi eventi/);
  assert.match(messages[0], /Store One/);
});

test("formatDigest: distinguishes new vs edited events in the header and per-line tag", () => {
  const edited = makeEvent({ guid: "g2", activity_group_name: "Store Two", first_seen_at: "2026-08-01T00:00:00Z", last_updated_at: "2026-09-09T18:00:00Z" });
  const messages = formatDigest([makeEvent(), edited]);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /1 nuovo e 1 aggiornato/);
  assert.match(messages[0], /🆕 Nuovo.*Store One/s);
  assert.match(messages[0], /✏️ Aggiornato.*Store Two/s);
});

test("formatDigest: splits into multiple messages past the length cap", () => {
  const manyEvents = Array.from({ length: 200 }, (_, i) => makeEvent({ guid: `g${i}`, activity_group_name: `Store Number ${i} With A Fairly Long Name` }));
  const messages = formatDigest(manyEvents);
  assert.ok(messages.length > 1, "expected the digest to split across multiple messages");
  for (const msg of messages) assert.ok(msg.length <= 4096, "each message must stay under Telegram's limit");
});

test("buildDigests: only returns chats with at least one new match, and updates nothing itself", () => {
  const events = [makeEvent(), makeEvent({ guid: "g2", region: "LAZIO" })];
  const chats = [
    { chatId: "1", prefs: { ...defaultPrefs(), lastNotifiedAt: new Date(YESTERDAY).toISOString() } },
    { chatId: "2", prefs: { ...defaultPrefs(), regions: ["SICILIA"], lastNotifiedAt: new Date(YESTERDAY).toISOString() } },
  ];
  const digests = buildDigests(chats, events, NOW);
  assert.equal(digests.length, 1);
  assert.equal(digests[0].chatId, "1");
  assert.equal(digests[0].matchedCount, 2);
});

test("buildDigests: a chat with no lastNotifiedAt (first run) still gets events from the last 24h", () => {
  const events = [makeEvent()];
  const chats = [{ chatId: "1", prefs: defaultPrefs() }];
  const digests = buildDigests(chats, events, NOW);
  assert.equal(digests.length, 1);
});
