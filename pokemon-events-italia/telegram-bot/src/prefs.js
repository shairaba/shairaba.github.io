/* Per-chat preference storage helpers.
   Each of regions/types/games is stored as either:
     - null        -> unfiltered ("everything"), the default for a new chat
     - an array     -> only these keys match (can be empty, meaning "match
                       nothing" - a deliberate "mute this dimension" state,
                       reachable via the settings menu's "Deselect all")
   A plain array without the null sentinel can't distinguish "never
   configured" from "explicitly picked every option", which is why null is
   its own state rather than just using an empty/full array. */

// Which workmode(s) a chat is actively subscribed to - "both" is the
// default so nothing changes for anyone who subscribed before this setting
// existed (defaultPrefs() gets merged with whatever's already in KV, so an
// old record with no "mode" field just falls back to this). "digest" and
// "list" turn the OTHER mode's proactive pushes off for that chat (no daily
// digest message, or no daily auto-refresh of their /list message,
// respectively) - it does not affect on-demand commands, so /list still
// works even in "digest" mode if someone types it.
export const MODES = ["both", "digest", "list"];

export function defaultPrefs() {
  return {
    regions: null,
    types: null,
    games: null,
    stores: null,
    lastNotifiedAt: null,
    state: null,
    mode: "both",
    // Message IDs of this chat's standing "/list" messages (plural - a
    // broad filter can span several Telegram messages, see list.js), in
    // page order. Lets /list and the refresh crons edit those same messages
    // in place instead of spamming new ones every time, and know how many
    // pages there used to be so a shrunk result can delete the leftovers.
    // Empty until /list is used for the first time.
    listMessageIds: [],
  };
}

/* One-time shape migration for chats that subscribed before /list could
   span multiple messages: their stored record has the old singular
   "listMessageId" instead of "listMessageIds". Called wherever raw KV JSON
   gets parsed (index.js) rather than folded into defaultPrefs()'s object
   spread, since a plain `{...defaultPrefs(), ...stored}` merge would keep
   BOTH the old and new field instead of converting one into the other. */
export function migratePrefs(prefs) {
  if (prefs.listMessageId && (!prefs.listMessageIds || prefs.listMessageIds.length === 0)) {
    prefs.listMessageIds = [prefs.listMessageId];
  }
  delete prefs.listMessageId;
  return prefs;
}

/* A chat's "mode" gates the two proactive push mechanisms independently -
   "list" turns off the daily digest, "digest" turns off the daily /list
   auto-refresh - without touching on-demand commands, which always work
   regardless of mode.
   Exported and tested here rather than left as private helpers in
   index.js on purpose: isListEligible's field name got out of sync with a
   prefs shape change once already (kept checking the old singular
   "listMessageId" after it became "listMessageIds", silently skipping
   every chat on every refresh cron with nothing in the logs to point at
   it) precisely because it lived in index.js, which - by this project's
   own stated convention - doesn't get unit tests. */
export function isDigestEligible(prefs) {
  return prefs.mode !== "list";
}

export function isListEligible(prefs) {
  return prefs.mode !== "digest" && !!(prefs.listMessageIds && prefs.listMessageIds.length > 0);
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
