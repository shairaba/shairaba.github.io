/* Per-chat preference storage helpers.
   Each of regions/types/games is stored as either:
     - null        -> unfiltered ("everything"), the default for a new chat
     - an array     -> only these keys match (can be empty, meaning "match
                       nothing" - a deliberate "mute this dimension" state,
                       reachable via the settings menu's "Deselect all")
   A plain array without the null sentinel can't distinguish "never
   configured" from "explicitly picked every option", which is why null is
   its own state rather than just using an empty/full array. */

export function defaultPrefs() {
  return { regions: null, types: null, games: null, stores: null, lastNotifiedAt: null, state: null };
}

export function passesFilter(selected, value) {
  if (selected === null || selected === undefined) return true;
  return selected.includes(value);
}

/* Toggles `value` in/out of the effective selection, materializing the
   implicit "everything" (null) into an explicit list on the first toggle,
   and collapsing back to null if every key ends up selected again (keeps
   the stored value canonical regardless of the order things were clicked
   in, and keeps it small since we're paying for KV storage/bandwidth). */
export function toggleValue(selected, allKeys, value) {
  const effective = new Set(selected === null || selected === undefined ? allKeys : selected);
  if (effective.has(value)) effective.delete(value);
  else effective.add(value);
  if (effective.size === allKeys.length) return null;
  return allKeys.filter((k) => effective.has(k));
}

/* Stores don't have a small fixed key list like regions/types/games (there
   are ~390 of them, pulled live from events.json rather than known ahead of
   time), so unlike toggleValue() there's no "materialize null into every
   key" step - null here can only mean "no store restriction", reached by
   removing the last explicitly-picked store rather than by ever selecting
   all of them. */
export function toggleStore(selected, storeId) {
  const set = new Set(selected || []);
  if (set.has(storeId)) set.delete(storeId);
  else set.add(storeId);
  const arr = [...set];
  return arr.length === 0 ? null : arr;
}

export function summarizeSelection(selected, labels, keys) {
  if (selected === null || selected === undefined) return "Tutte";
  if (selected.length === 0) return "Nessuna";
  if (selected.length === keys.length) return "Tutte";
  return selected.map((k) => labels[k] || k).join(", ");
}
