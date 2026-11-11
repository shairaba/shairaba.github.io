// JS port of engine.py's compute_evs_from_totals / _base_calc /
// _ev_candidates. Derives each stat's EV from its (reliably-read) total
// plus base stats and nature, instead of trusting the small, fragile EV
// digit read directly off the bar - see engine.py's own comment block for
// the full reverse-engineering history behind the formula below and why
// the 66-point budget is used only as a tiebreaker, never a hard gate.
const STAT_FULL_NAME = { Atk: "Attack", Def: "Defense", SpA: "Sp. Atk", SpD: "Sp. Def", Spe: "Speed" };

// {boostedStat},{loweredStat} -> nature name (same pairing natureDetect.mjs
// uses in the other direction).
const NATURE_MAP = {
  "Attack,Defense": "Lonely", "Attack,Speed": "Brave",
  "Attack,Sp. Atk": "Adamant", "Attack,Sp. Def": "Naughty",
  "Defense,Attack": "Bold", "Defense,Speed": "Relaxed",
  "Defense,Sp. Atk": "Impish", "Defense,Sp. Def": "Lax",
  "Speed,Attack": "Timid", "Speed,Defense": "Hasty",
  "Speed,Sp. Atk": "Jolly", "Speed,Sp. Def": "Naive",
  "Sp. Atk,Attack": "Modest", "Sp. Atk,Defense": "Mild",
  "Sp. Atk,Speed": "Quiet", "Sp. Atk,Sp. Def": "Rash",
  "Sp. Def,Attack": "Calm", "Sp. Def,Defense": "Gentle",
  "Sp. Def,Speed": "Sassy", "Sp. Def,Sp. Atk": "Careful",
};
// Inverse of the map above: nature name -> [boostedStat, loweredStat].
const NATURE_EFFECTS = Object.fromEntries(
  Object.entries(NATURE_MAP).map(([pair, nature]) => [nature, pair.split(",")])
);

const LEVEL = 50;
const IV = 31;
const TOTAL_EV_BUDGET = 66;

function baseCalc(base) {
  return Math.floor(((2 * base + IV) * LEVEL) / 100);
}

function evCandidates(base, total, natureMult, isHp, maxEv = 40) {
  const calc = baseCalc(base);
  const candidates = [];
  for (let ev = 0; ev <= maxEv; ev++) {
    const predicted = isHp
      ? calc + LEVEL + 10 + ev
      : Math.floor((calc + 5 + ev) * natureMult);
    if (predicted === total) candidates.push(ev);
  }
  return candidates;
}

// Cartesian product of arrays, matching Python's itertools.product used
// in engine.py's tiebreak search.
function* product(arrays) {
  if (!arrays.length) { yield []; return; }
  const [first, ...rest] = arrays;
  for (const value of first) {
    for (const combo of product(rest)) yield [value, ...combo];
  }
}

// baseStats: {hp,atk,def,spa,spd,spe} for the matched species (from
// pokedex.js). statRows: {key: {total, ev, confirmed}} from
// parseStatsCard. nature: nature name string (e.g. "Adamant").
// Returns {evs: {key: number}, totalSum: number} or null if any stat's
// total has no valid EV in [0,40] - the same "something upstream is
// badly wrong" signal engine.py uses to trigger falling back to the
// OCR'd EV digits directly.
export function computeEvsFromTotals(baseStats, statRows, nature) {
  if (!baseStats) return null;

  const [boostedStat, loweredStat] = NATURE_EFFECTS[nature] ?? [null, null];
  const dexKey = { HP: "hp", Atk: "atk", Def: "def", SpA: "spa", SpD: "spd", Spe: "spe" };

  const candidatesPerStat = {};
  // Which (ev, confirmed) pair the resolved total actually came from -
  // needed below since that can come from an alt candidate instead of
  // statRows[key] itself (see the loop below).
  const evConfirmedPerStat = {};
  for (const key of ["HP", "Atk", "Def", "SpA", "SpD", "Spe"]) {
    if (!(key in statRows)) continue;
    let mult = 1.0;
    if (key !== "HP") {
      if (STAT_FULL_NAME[key] === boostedStat) mult = 1.1;
      else if (STAT_FULL_NAME[key] === loweredStat) mult = 0.9;
    }
    // A row whose total/EV came from splitting a single fused digit run
    // (e.g. "400") can be genuinely ambiguous purely from digit shape -
    // parseStatsCard's primary guess is tried first, but for a low base
    // stat that guess can itself look plausible while being wrong (e.g.
    // Torkoal's Speed total 40 fused with ev 0 reads as "400", which also
    // looks like a valid 3-digit total on its own). Falling back through
    // the alternate splits lets the one whose EV is actually reachable
    // from this species' real base stat win instead.
    const attempts = [{ total: statRows[key].total, ev: statRows[key].ev, confirmed: statRows[key].confirmed }, ...(statRows[key].alt ?? [])];
    let candidates = [];
    for (const attempt of attempts) {
      candidates = evCandidates(baseStats[dexKey[key]], attempt.total, mult, key === "HP");
      if (candidates.length) {
        evConfirmedPerStat[key] = { ev: attempt.ev, confirmed: attempt.confirmed };
        break;
      }
    }
    if (!candidates.length) return null;
    candidatesPerStat[key] = candidates;
  }

  // A stat's total sometimes matches more than one EV exactly (a 0.9/1.1
  // nature-rounding artifact) - when that happens, trust the OCR'd EV
  // digit if it's one of the mathematically valid candidates (it's
  // simultaneously confirming the math and resolving the tie), and only
  // reach for the 66-budget tiebreak when there's no digit to consult or
  // it doesn't agree with any valid candidate.
  const resolved = {};
  const ambiguousKeys = [];
  const ambiguousCandidates = [];
  for (const [key, candidates] of Object.entries(candidatesPerStat)) {
    if (candidates.length === 1) {
      resolved[key] = candidates[0];
      continue;
    }
    const { ev: ocrEv, confirmed } = evConfirmedPerStat[key];
    if (confirmed && candidates.includes(ocrEv)) {
      resolved[key] = ocrEv;
    } else {
      ambiguousKeys.push(key);
      ambiguousCandidates.push(candidates);
    }
  }

  if (ambiguousKeys.length) {
    const fixedSum = Object.values(resolved).reduce((a, b) => a + b, 0);
    let bestCombo = null, bestSum = null;
    for (const combo of product(ambiguousCandidates)) {
      const comboSum = fixedSum + combo.reduce((a, b) => a + b, 0);
      if (comboSum === TOTAL_EV_BUDGET) { bestCombo = combo; break; }
      if (bestSum === null || Math.abs(comboSum - TOTAL_EV_BUDGET) < Math.abs(bestSum - TOTAL_EV_BUDGET)) {
        bestCombo = combo;
        bestSum = comboSum;
      }
    }
    ambiguousKeys.forEach((key, i) => { resolved[key] = bestCombo[i]; });
  }

  const totalSum = Object.values(resolved).reduce((a, b) => a + b, 0);
  return { evs: resolved, totalSum };
}
