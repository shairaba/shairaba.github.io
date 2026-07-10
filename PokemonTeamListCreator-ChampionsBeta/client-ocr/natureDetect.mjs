// JS port of engine.py's nature (boost/lower chevron) detection: a color
// mask over the small pixel gap between a stat's label and its total
// (computed by parseStatsCard's `gaps`), read from the same full-card
// ImageData the OCR crops were taken from.
import { hsvMask, connectedComponents } from "./cvutils.mjs";

const STAT_FULL_NAME = { Atk: "Attack", Def: "Defense", SpA: "Sp. Atk", SpD: "Sp. Def", Spe: "Speed" };

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

// Same thresholds as engine.py: the chevron is small and vividly
// saturated against the lavender card background, which sits at the same
// hues but tops out around S~110 - see engine.py's nature-detection
// comment block for the calibration history behind these exact numbers
// (in particular, why blue's saturation floor is higher than red's, and
// why red's hue band deliberately excludes the 0-10 wraparound region).
const RED_RANGE = [[163, 60, 120], [180, 255, 255]];
const BLUE_RANGE = [[90, 80, 120], [118, 255, 255]];

// See detectNature's use of this below for the calibration story - real
// chevron blob areas observed across a real sample set cluster at 0 (no
// chevron) or >=20ish (a clear one), with one confirmed genuine miss at 2.
const MIN_CHEVRON_AREA = 2;

function largestBlobArea(mask, width, height, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(width, Math.ceil(x1));
  y1 = Math.min(height, Math.ceil(y1));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return 0;
  const sub = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      sub[y * w + x] = mask[(y0 + y) * width + (x0 + x)];
    }
  }
  // A real chevron is a small, roughly square blob - restricting to that
  // shape matters most when the search window has to be widened to
  // absorb uncertainty in where a fused label+number row's gap actually
  // falls (see parseStatsCard): a wider window is more likely to also
  // sweep in an unrelated same-hue sliver (e.g. the stat bar's own thin
  // "unfilled" segment, seen ~60x11px, nothing like a ~20-35px-square
  // chevron), and without this filter that sliver's larger area can
  // outscore the real chevron and flip which nature gets picked.
  const blobs = connectedComponents({ mask: sub, width: w, height: h })
    .filter((b) => b.width / b.height >= 0.4 && b.width / b.height <= 2.5);
  return blobs.length ? Math.max(...blobs.map((b) => b.area)) : 0;
}

// Shared scan: returns the boosted/lowered stat full-names (or null, if no
// chevron of that color cleared MIN_CHEVRON_AREA anywhere on the card) that
// detectNature and detectNatureConfidence both build on.
function scanChevrons(imageData, gaps, cardHeight) {
  const redMask = hsvMask(imageData, ...RED_RANGE);
  const blueMask = hsvMask(imageData, ...BLUE_RANGE);

  let boosted = null, lowered = null;
  for (const [statKey, [x0, x1, cy]] of Object.entries(gaps)) {
    if (statKey === "HP") continue;
    const y0 = cy - cardHeight * 0.07;
    const y1 = cy + cardHeight * 0.07;
    const redArea = largestBlobArea(redMask.mask, redMask.width, redMask.height, x0, y0, x1, y1);
    const blueArea = largestBlobArea(blueMask.mask, blueMask.width, blueMask.height, x0, y0, x1, y1);
    // Real chevron detections across a wide sample set are either 0 (no
    // chevron in this stat's window, the overwhelmingly common case) or
    // >=20-ish (a genuine, clearly-rendered chevron) - nothing has ever
    // landed in between except one confirmed real miss (a genuine lowered-
    // stat chevron measured at exactly 2px on a lower-resolution
    // screenshot, comfortably clear of every non-chevron reading in the
    // same sample set, which stayed at 0). MIN_AREA sits just under that,
    // not at the old cutoff of 3, so a chevron rendered a little smaller
    // than usual on a lower-res screenshot doesn't fall through to the
    // "no chevron here" default when it clearly should have counted.
    if (redArea >= MIN_CHEVRON_AREA && redArea > blueArea) boosted = STAT_FULL_NAME[statKey];
    if (blueArea >= MIN_CHEVRON_AREA && blueArea > redArea) lowered = STAT_FULL_NAME[statKey];
  }
  return { boosted, lowered };
}

// imageData: the full stats-card ImageData (same coordinate space as
// `gaps`, i.e. the same upscaled canvas the OCR tokens' pixel coordinates
// came from). gaps: parseStatsCard's second return value,
// {key: [gapX0, gapX1, cy]}. cardHeight: the card canvas's pixel height.
export function detectNature(imageData, gaps, cardHeight) {
  const { boosted, lowered } = scanChevrons(imageData, gaps, cardHeight);
  return NATURE_MAP[`${boosted},${lowered}`] ?? "Serious";
}

// Same scan as detectNature, but also flags when the result should be
// treated as a guess rather than a confident read - for the manual-review
// picker (see main.mjs). A real nature chevron always comes in a matched
// pair (one stat boosted, a different one lowered); "Serious" is genuinely
// common (many real teams run neutral natures) and both-null is exactly
// what that looks like, so that case is trusted outright, same as
// detectNature. What's never a real, complete read is exactly one color
// found and not the other - the game doesn't render a lone chevron - so
// that's flagged as uncertain, with candidates covering every nature
// consistent with the one half that *was* found (paired against each of
// the other four possible stats for the missing half).
export function detectNatureConfidence(imageData, gaps, cardHeight) {
  const { boosted, lowered } = scanChevrons(imageData, gaps, cardHeight);
  const nature = NATURE_MAP[`${boosted},${lowered}`] ?? "Serious";

  if ((boosted === null) === (lowered === null)) {
    return { nature, uncertain: false, candidates: [] };
  }

  const otherNames = Object.values(STAT_FULL_NAME);
  const candidates = boosted !== null
    ? otherNames.filter((n) => n !== boosted).map((lo) => NATURE_MAP[`${boosted},${lo}`])
    : otherNames.filter((n) => n !== lowered).map((bo) => NATURE_MAP[`${bo},${lowered}`]);

  return {
    nature,
    uncertain: true,
    candidates: candidates.map((name) => ({ name, confidence: 1 / candidates.length })),
  };
}
