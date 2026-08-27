import test from "node:test";
import assert from "node:assert/strict";
import { passesFilter, toggleValue, toggleStore, summarizeSelection } from "../src/prefs.js";

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

test("summarizeSelection", () => {
  assert.equal(summarizeSelection(null, LABELS, KEYS), "Tutte");
  assert.equal(summarizeSelection([], LABELS, KEYS), "Nessuna");
  assert.equal(summarizeSelection(["a", "b", "c"], LABELS, KEYS), "Tutte");
  assert.equal(summarizeSelection(["a"], LABELS, KEYS), "A");
});
