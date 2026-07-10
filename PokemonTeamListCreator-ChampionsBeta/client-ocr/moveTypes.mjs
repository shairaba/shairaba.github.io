// Move -> type lookup for every Champions-legal move (see
// championsLearnsets.json), cross-referenced from PokeAPI against that same
// move list. Used to cross-check the manual-review picker's move-name
// candidates against the type icon actually shown next to that move on the
// card (see formResolve.mjs's detectMoveTypeIcon and pipeline.mjs) - the
// card never shows a move's type as text anywhere, only that icon.
const MOVE_TYPES_URL = new URL("../Resources/moveTypes.json", import.meta.url).href;

let typesPromise = null;
function loadTypes() {
  if (!typesPromise) {
    typesPromise = fetch(MOVE_TYPES_URL).then((r) => r.json());
  }
  return typesPromise;
}

// name: an already-resolved English move name (e.g. "Close Combat").
// Returns its type (e.g. "Fighting"), or null if the move isn't in the
// Champions-legal set at all.
export async function getMoveType(name) {
  if (!name) return null;
  const types = await loadTypes();
  return types[name] ?? null;
}
