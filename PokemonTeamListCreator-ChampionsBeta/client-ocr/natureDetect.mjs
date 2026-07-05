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
  const blobs = connectedComponents({ mask: sub, width: w, height: h });
  return blobs.length ? Math.max(...blobs.map((b) => b.area)) : 0;
}

// imageData: the full stats-card ImageData (same coordinate space as
// `gaps`, i.e. the same upscaled canvas the OCR tokens' pixel coordinates
// came from). gaps: parseStatsCard's second return value,
// {key: [gapX0, gapX1, cy]}. cardHeight: the card canvas's pixel height.
export function detectNature(imageData, gaps, cardHeight) {
  const redMask = hsvMask(imageData, ...RED_RANGE);
  const blueMask = hsvMask(imageData, ...BLUE_RANGE);

  let boosted = null, lowered = null;
  for (const [statKey, [x0, x1, cy]] of Object.entries(gaps)) {
    if (statKey === "HP") continue;
    const y0 = cy - cardHeight * 0.07;
    const y1 = cy + cardHeight * 0.07;
    const redArea = largestBlobArea(redMask.mask, redMask.width, redMask.height, x0, y0, x1, y1);
    const blueArea = largestBlobArea(blueMask.mask, blueMask.width, blueMask.height, x0, y0, x1, y1);
    if (redArea >= 3 && redArea > blueArea) boosted = STAT_FULL_NAME[statKey];
    if (blueArea >= 3 && blueArea > redArea) lowered = STAT_FULL_NAME[statKey];
  }

  return NATURE_MAP[`${boosted},${lowered}`] ?? "Serious";
}
