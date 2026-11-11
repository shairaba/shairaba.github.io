// Identifies a Pokemon's species from its (reliably-OCR'd) ability and
// moveset, for nicknamed Pokemon or otherwise-low-confidence name reads.
// JS port of the Python prototype's moveset_id.py - same data, same logic.
//
// This exists as a cheaper, more reliable alternative to image-based
// species matching (which was tried for this browser build and dropped -
// see git history/formResolve.mjs's docstring context - because this
// game's own icon art didn't correlate against any external reference
// library). A nicknamed Pokemon's ability and moves are read from plain
// OCR text exactly like any other card field - no image-similarity
// guessing involved - so if the (ability, moveset) combination happens to
// be unique across the Champions roster, that's a strong, purely textual
// signal. It won't always narrow to a unique species (a common ability
// shared by several similar species can leave real ambiguity), which is
// exactly when the caller should fall back to whatever it already does.
//
// Data source: Resources/championsAbilities.json and
// Resources/championsLearnsets.json, scraped from Bulbapedia's
// Category:Pokemon learnsets (Champions).
const LEARNSETS_URL = new URL("../Resources/championsLearnsets.json", import.meta.url).href;
const ABILITIES_URL = new URL("../Resources/championsAbilities.json", import.meta.url).href;

let dataPromise = null;

function loadData() {
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetch(LEARNSETS_URL).then((r) => r.json()),
      fetch(ABILITIES_URL).then((r) => r.json()),
    ]).then(([learnsets, abilities]) => ({ learnsets, abilities }));
  }
  return dataPromise;
}

// Returns the single species name whose (regular or hidden) ability
// matches `ability` and whose Champions-accessible learnset is a superset
// of `moves`, or null if zero or more than one species match - ambiguity
// is treated the same as "no match" here (never guess among ties), the
// same safety principle used throughout this codebase: abstaining and
// falling back to whatever the caller already does is always safer than a
// confidently wrong guess.
//
// ability: an English ability name (as returned by spellCorrect(..., "ability", ...)).
// moves: an array of English move names (as returned by spellCorrect(..., "move", ...));
// falsy entries are ignored, and an empty (or all-empty) list makes this
// abstain immediately, same as a missing ability - a moveset alone isn't
// the same "which species is this" signal without it.
// Shared by identifyByAbilityAndMoves and getSpeciesCandidates below -
// every species whose (regular or hidden) ability matches `ability` and
// whose Champions-accessible learnset is a superset of `moves`. Returns
// null (not []) when there isn't enough signal to search at all, so callers
// can tell "found zero species" apart from "didn't even look".
async function allMatchingSpecies(ability, moves) {
  const realMoves = (moves || []).filter(Boolean);
  if (!ability || !realMoves.length) return null;

  const { learnsets, abilities } = await loadData();

  const candidates = [];
  for (const [name, learnset] of Object.entries(learnsets)) {
    const info = abilities[name];
    if (!info) continue;
    const hasAbility = (info.abilities || []).includes(ability) || info.hidden === ability;
    if (!hasAbility) continue;
    const moveSet = new Set(learnset);
    if (!realMoves.every((mv) => moveSet.has(mv))) continue;
    candidates.push(name);
  }

  return candidates;
}

export async function identifyByAbilityAndMoves(ability, moves) {
  const candidates = await allMatchingSpecies(ability, moves);
  return candidates && candidates.length === 1 ? candidates[0] : null;
}

// Every species consistent with this card's own (already-resolved) ability
// and moves - the "sanity check" version of identifyByAbilityAndMoves,
// used to filter the manual-review picker's species candidates/dropdown
// (see main.mjs and pipeline.mjs) rather than to silently resolve a name on
// its own. Unlike identifyByAbilityAndMoves this never abstains just
// because there's more than one match - a reviewer choosing between two
// legitimately-consistent species is exactly the case the review screen
// exists for. Returns null (not []) when there wasn't enough signal to
// search at all (missing ability or moves), same distinction
// allMatchingSpecies draws, so callers can fall back to their own
// unfiltered candidates instead of wrongly treating "couldn't check" as
// "checked, found nothing".
export async function getSpeciesCandidates(ability, moves) {
  return allMatchingSpecies(ability, moves);
}

// Same data and matching rule as identifyByAbilityAndMoves, but returns up
// to `k` ranked candidates instead of only a confident unique answer - for
// the manual-review picker (see main.mjs), where a human reviewer picking
// between "the top few species that fit best" is far more useful than just
// being told the ability+moveset didn't uniquely resolve. Candidates are
// scored by how many of the read moves they actually know (ability match is
// a hard requirement, same as identifyByAbilityAndMoves, not a scoring
// factor - a species with the right moves but the wrong ability was never a
// real candidate to begin with). confidence here is a plain fraction of
// moves matched, not the same kind of number translateToEnglishConfidence
// returns - still directly comparable *between* these candidates, just not
// across the two systems.
export async function identifyByAbilityAndMovesCandidates(ability, moves, k = 5) {
  const realMoves = (moves || []).filter(Boolean);
  if (!ability || !realMoves.length) return [];

  const { learnsets, abilities } = await loadData();

  const scored = [];
  for (const [name, learnset] of Object.entries(learnsets)) {
    const info = abilities[name];
    if (!info) continue;
    const hasAbility = (info.abilities || []).includes(ability) || info.hidden === ability;
    if (!hasAbility) continue;
    const moveSet = new Set(learnset);
    const matched = realMoves.filter((mv) => moveSet.has(mv)).length;
    if (matched === 0) continue;
    scored.push({ name, confidence: matched / realMoves.length });
  }

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, k);
}

// The full list of Champions-legal moves for one species (already-
// translated English name, e.g. "Sneasler"), or null if the species isn't
// in the learnset data at all - used to keep the manual-review picker (see
// main.mjs) from ever offering a move the card's own species can't
// actually learn, which a plain OCR-text fuzzy match has no way to know
// about on its own (it matches against every move in the game).
export async function getLearnset(name) {
  if (!name) return null;
  const { learnsets } = await loadData();
  return learnsets[name] ?? null;
}

// Same idea as getLearnset, but for abilities: every ability (regular slots
// plus the hidden ability, same as identifyByAbilityAndMoves's own "hasAbility"
// check above) this species can actually have, or null if it isn't in the
// abilities data at all.
export async function getAbilities(name) {
  if (!name) return null;
  const { abilities } = await loadData();
  const info = abilities[name];
  if (!info) return null;
  return [...(info.abilities || []), ...(info.hidden ? [info.hidden] : [])];
}
