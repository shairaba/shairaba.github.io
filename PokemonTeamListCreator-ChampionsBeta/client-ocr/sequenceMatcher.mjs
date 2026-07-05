// Minimal JS port of Python's difflib.SequenceMatcher, just the parts
// resources.py's spell-correction relies on: ratio() and
// get_close_matches(). No autojunk/isjunk handling - not needed for the
// short strings (species/move/item/ability names) this is used on.
function findLongestMatch(a, b, b2j, alo, ahi, blo, bhi) {
  let bestI = alo, bestJ = blo, bestSize = 0;
  let j2len = new Map();
  for (let i = alo; i < ahi; i++) {
    const newJ2len = new Map();
    const indices = b2j.get(a[i]) ?? [];
    for (const j of indices) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len.get(j - 1) ?? 0) + 1;
      newJ2len.set(j, k);
      if (k > bestSize) {
        bestI = i - k + 1;
        bestJ = j - k + 1;
        bestSize = k;
      }
    }
    j2len = newJ2len;
  }
  // Extend the match through equal elements on both sides (junk-free
  // variant of the real algorithm's second pass).
  while (bestI > alo && bestJ > blo && a[bestI - 1] === b[bestJ - 1]) {
    bestI--; bestJ--; bestSize++;
  }
  while (bestI + bestSize < ahi && bestJ + bestSize < bhi && a[bestI + bestSize] === b[bestJ + bestSize]) {
    bestSize++;
  }
  return [bestI, bestJ, bestSize];
}

function getMatchingBlocks(a, b) {
  const b2j = new Map();
  for (let j = 0; j < b.length; j++) {
    if (!b2j.has(b[j])) b2j.set(b[j], []);
    b2j.get(b[j]).push(j);
  }

  const blocks = [];
  const queue = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const [i, j, k] = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi);
    if (k) {
      blocks.push([i, j, k]);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  return blocks;
}

export function ratio(a, b) {
  if (!a.length && !b.length) return 1.0;
  const matches = getMatchingBlocks(a, b).reduce((sum, [, , size]) => sum + size, 0);
  return (2.0 * matches) / (a.length + b.length);
}

// Mirrors difflib.get_close_matches(word, possibilities, n, cutoff).
export function getCloseMatches(word, possibilities, n = 1, cutoff = 0.5) {
  const scored = [];
  for (const p of possibilities) {
    const r = ratio(word, p);
    if (r >= cutoff) scored.push([r, p]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, n).map(([, p]) => p);
}
