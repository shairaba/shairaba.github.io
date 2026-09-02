import test from "node:test";
import assert from "node:assert/strict";
import {
  passesFilter,
  toggleValue,
  toggleStore,
  summarizeSelection,
  migratePrefs,
  defaultPrefs,
  isDigestEligible,
  isListEligible,
} from "../src/prefs.js";

const KEYS = ["a", "b", "c"];
const LABELS = { a: "A", b: "B", c: "C" };

test("passesFilter: null means everything passes", () => {
  assert.equal(passesFilter(null, "a"), true);
  assert.equal(passesFilter(undefined, "z"), true);
});

test("passesFilter: array restricts to its members", () => {
  assert.equal(passesFilter(["a", "b"], "a"), true);
  assert.equal(passesFilter(["a", "b"], "c"), false);
  assert.equal(passesFilter([], "a"), false);
});

test("toggleValue: unchecking one from the implicit 'all' state materializes the rest", () => {
  const result = toggleValue(null, KEYS, "a");
  assert.deepEqual(result, ["b", "c"]);
});

test("toggleValue: re-checking the last missing key collapses back to null", () => {
  const result = toggleValue(["b", "c"], KEYS, "a");
  assert.equal(result, null);
});

test("toggleValue: toggling within an explicit subset just adds/removes", () => {
  assert.deepEqual(toggleValue(["a"], KEYS, "b"), ["a", "b"]);
  assert.deepEqual(toggleValue(["a", "b"], KEYS, "a"), ["b"]);
});

test("toggleStore: adds to an open-ended list, no materialization needed", () => {
  assert.deepEqual(toggleStore(null, "S1"), ["S1"]);
  assert.deepEqual(toggleStore(["S1"], "S2"), ["S1", "S2"]);
});

test("toggleStore: removing the last store collapses back to null", () => {
  assert.equal(toggleStore(["S1"], "S1"), null);
});

test("migratePrefs: converts an old single listMessageId into the new array field", () => {
  const migrated = migratePrefs({ ...defaultPrefs(), listMessageId: 12345 });
  assert.deepEqual(migrated.listMessageIds, [12345]);
  assert.equal("listMessageId" in migrated, false);
});

test("migratePrefs: a record already on the new shape is left untouched", () => {
  const migrated = migratePrefs({ ...defaultPrefs(), listMessageIds: [111, 222] });
  assert.deepEqual(migrated.listMessageIds, [111, 222]);
});

test("migratePrefs: a record with neither field just gets the default empty array", () => {
  const migrated = migratePrefs(defaultPrefs());
  assert.deepEqual(migrated.listMessageIds, []);
});

test("isDigestEligible: true for 'both' and 'digest' modes, false for 'list'", () => {
  assert.equal(isDigestEligible({ ...defaultPrefs(), mode: "both" }), true);
  assert.equal(isDigestEligible({ ...defaultPrefs(), mode: "digest" }), true);
  assert.equal(isDigestEligible({ ...defaultPrefs(), mode: "list" }), false);
});

test("isListEligible: false without at least one listMessageIds entry, even in 'both'/'list' mode", () => {
  assert.equal(isListEligible({ ...defaultPrefs(), mode: "both", listMessageIds: [] }), false);
  assert.equal(isListEligible({ ...defaultPrefs(), mode: "both", listMessageIds: [123] }), true);
  assert.equal(isListEligible({ ...defaultPrefs(), mode: "digest", listMessageIds: [123] }), false);
});

test("isListEligible: a chat migrated from the old single listMessageId shape is still eligible - the exact regression this project actually hit (this check kept looking at the pre-migration field name after prefs.js moved to listMessageIds, silently skipping every chat on every refresh cron)", () => {
  const oldShapeRecord = { ...defaultPrefs(), mode: "both", listMessageId: 999 };
  const migrated = migratePrefs(oldShapeRecord);
  assert.equal(isListEligible(migrated), true);
});

test("summarizeSelection", () => {
  assert.equal(summarizeSelection(null, LABELS, KEYS), "Tutte");
  assert.equal(summarizeSelection([], LABELS, KEYS), "Nessuna");
  assert.equal(summarizeSelection(["a", "b", "c"], LABELS, KEYS), "Tutte");
  assert.equal(summarizeSelection(["a"], LABELS, KEYS), "A");
});
