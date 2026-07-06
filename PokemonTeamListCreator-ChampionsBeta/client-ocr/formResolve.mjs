// Resolves regional-variant (Alolan/Galarian/Hisuian/Paldean) and
// gender-variant (Basculegion/Indeedee/Meowstic/...) species to the
// correct Showdown pokedex.js key, by reading the small colored icon
// badges shown next to the species name (gender, then 1-2 type icons) -
// the on-screen name text alone never distinguishes these (unlike
// Aegislash/Sinistcha's "Blade Forme"/"Masterpiece Form" text, see
// resolveFormSuffix in spellCorrect.mjs), so this has to look at pixels.
import { connectedComponents, morphClose } from "./cvutils.mjs";

function rgbToHsv(r, g, b) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rf) h = 60 * (((gf - bf) / d) % 6);
    else if (max === gf) h = 60 * ((bf - rf) / d + 2);
    else h = 60 * ((rf - gf) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [h, s * 100, max * 100];
}

// Finds the small icon badges in the header row, just right of the
// species name - a set of blob candidates, sorted left-to-right, each
// with its own median "ring" fill color (see below for why a ring
// instead of a center-point sample). Returns [] if none found (e.g. the
// name token wasn't identified, or no icons are present).
//
// nameToken: {x1, cy, h} in the same pixel space as imageData - the
// already-OCR'd species name token (from either the moves or stats
// card's header row; both show the identical icon set).
export function detectHeaderIcons(imageData, nameToken) {
  const { data, width, height } = imageData;
  if (!nameToken) return [];

  // Sample the header's own background a little past the name (before
  // any icon) rather than from elsewhere on the card - the header bar
  // has its own gradient/shading distinct from the card body.
  const bgX = Math.min(width - 1, Math.floor(nameToken.x1 + 30));
  const bgY = Math.max(0, Math.min(height - 1, Math.floor(nameToken.cy)));
  const bgIdx = (bgY * width + bgX) * 4;
  const bg = [data[bgIdx], data[bgIdx + 1], data[bgIdx + 2]];

  // The vertical search band covers the whole header row (card-height-
  // relative, matching the same cutoff used to decide which OCR tokens
  // count as "header" in the first place) rather than being centered on
  // nameToken's own detected height - that height isn't reliable enough
  // to size a tight band around (see the size-filter comment below for
  // why), and a card-relative band is wide enough to contain the icons
  // regardless.
  const y0 = 0;
  const y1 = Math.min(height, Math.floor(height * 0.28));
  const x0 = Math.floor(nameToken.x1);
  const mask = new Uint8Array(width * height);
  const distThreshold = 80;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
      if (dist > distThreshold) mask[y * width + x] = 1;
    }
  }
  // A closing pass bridges icons whose fill color is close enough to the
  // background to only partially clear the distance threshold (seen with
  // Poison's violet against the card's own purple header) - without it,
  // those icons fragment into several small pieces instead of one blob.
  const closed = morphClose({ mask, width, height }, 7);
  const blobs = connectedComponents(closed);

  const icons = [];
  for (const b of blobs) {
    const aspect = b.width / b.height;
    // Icon badges are small and roughly square; anything wider/taller
    // than that band is the header's own background-gradient blob (very
    // wide) or the name text itself (also much wider than tall), not an
    // icon - the aspect check alone already excludes both, so sizing
    // doesn't need to lean on nameToken's own detected height, which
    // isn't a reliable size reference (the same "Raichu" text measured
    // 104px tall from one OCR run and 68px from another on pixel-
    // identical input - a real box-height difference between the
    // Node/onnxruntime-node and browser/onnxruntime-web backends, not
    // something to build a proportional size filter on). A generous
    // absolute floor plus a card-height-relative ceiling is far more
    // stable across both runtimes and every screenshot resolution seen.
    if (aspect < 0.6 || aspect > 1.7) continue;
    if (b.width < 20 || b.height < 20 || b.height > height * 0.3) continue;

    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    // Sample a ring partway out from the badge's center rather than the
    // exact center pixel - most badges draw a white glyph (bolt/flame/
    // paw/etc.) in the middle, so the center pixel is often the glyph's
    // white, not the badge's actual color.
    const rx = b.width * 0.36, ry = b.height * 0.36;
    const samples = [];
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(ang) * rx);
      const py = Math.round(cy + Math.sin(ang) * ry);
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const idx = (py * width + px) * 4;
      samples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
    if (!samples.length) continue;
    const median = (arr) => { const s = [...arr].sort((a, c) => a - c); return s[Math.floor(s.length / 2)]; };
    const r = median(samples.map((s) => s[0]));
    const g = median(samples.map((s) => s[1]));
    const bl = median(samples.map((s) => s[2]));
    const [h, s, v] = rgbToHsv(r, g, bl);
    icons.push({ x: b.x, hue: h, sat: s, val: v });
  }
  icons.sort((a, b) => a.x - b.x);
  return icons;
}

// Reference (hue, saturation, value) bands for each type's icon badge,
// calibrated against real screenshots (see
// project_client_ocr_parsing_edge_cases memory / commit history for the
// samples this came from) - not every type has been directly confirmed
// (Bug and Dragon in particular are estimates from general series
// convention rather than a measured sample), so treat a classification
// involving those two with extra suspicion if it ever misfires.
const TYPE_HSV = {
  Normal: { hue: null, sat: [0, 15], val: [50, 80] }, // near-grey; identified by low saturation, not hue
  Fire: { hue: [345, 15], sat: [70, 88], val: [70, 85] },
  Water: { hue: [205, 228], sat: [65, 95], val: [80, 95] },
  Electric: { hue: [38, 55], sat: [85, 96], val: [90, 100] },
  Grass: { hue: [95, 125], sat: [60, 80], val: [55, 70] },
  Ice: { hue: [178, 200], sat: [55, 72], val: [88, 98] },
  Fighting: { hue: [18, 36], sat: [86, 98], val: [88, 100] },
  Poison: { hue: [258, 285], sat: [30, 65], val: [78, 92] },
  Ground: { hue: [18, 36], sat: [58, 76], val: [48, 62] },
  Flying: { hue: [200, 222], sat: [20, 48], val: [83, 95] },
  Psychic: { hue: [328, 345], sat: [58, 70], val: [80, 90] },
  Bug: { hue: [65, 92], sat: [55, 80], val: [65, 82] }, // estimate - not directly sampled
  Rock: { hue: [20, 50], sat: [8, 32], val: [48, 72] },
  Ghost: { hue: [283, 300], sat: [22, 42], val: [45, 60] },
  Dragon: { hue: [248, 266], sat: [50, 78], val: [55, 78] }, // estimate - not directly sampled
  Dark: { hue: [340, 5], sat: [8, 27], val: [22, 42] },
  Steel: { hue: [185, 200], sat: [22, 46], val: [58, 76] },
  Fairy: { hue: [288, 306], sat: [40, 70], val: [80, 93] },
};

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function inRange(hue, [lo, hi]) {
  if (lo <= hi) return hue >= lo && hue <= hi;
  return hue >= lo || hue <= hi; // wraps past 360/0 (e.g. Fire, Dark)
}

// Scores how well one detected icon matches a candidate type, used only
// to compare a *small, known set of candidate types* against each other
// (never as a general 18-way classifier) - see resolveAlternateForm.
function typeMatchScore(icon, typeName) {
  const ref = TYPE_HSV[typeName];
  if (!ref) return -Infinity;
  let score = 0;
  if (ref.hue === null) {
    // Normal: judged on saturation alone.
    score -= icon.sat; // lower saturation = better match
  } else {
    const mid = Array.isArray(ref.hue) ? (ref.hue[0] + ref.hue[1]) / 2 : ref.hue;
    score -= hueDistance(icon.hue, mid) * 2;
    if (!inRange(icon.hue, ref.hue)) score -= 40;
  }
  if (icon.sat < ref.sat[0]) score -= (ref.sat[0] - icon.sat);
  else if (icon.sat > ref.sat[1]) score -= (icon.sat - ref.sat[1]);
  if (icon.val < ref.val[0]) score -= (ref.val[0] - icon.val);
  else if (icon.val > ref.val[1]) score -= (icon.val - ref.val[1]);
  return score;
}

// Gender icon color bands - always the first icon when present (a
// Pokemon with no gender, like Rotom, simply has no icon in this slot,
// so type icons start at index 0 instead of 1).
function classifyGenderIcon(icon) {
  if (icon.sat < 40) return null;
  if (inRange(icon.hue, [340, 15]) && icon.val > 55) return "male-or-female-red-or-blue"; // placeholder, replaced below
  return null;
}
function isFemaleIcon(icon) { return icon.sat > 50 && inRange(icon.hue, [340, 15]) && icon.val > 55; }
function isMaleIcon(icon) { return icon.sat > 50 && inRange(icon.hue, [210, 240]) && icon.val > 55; }

// species (already-translated English base name, e.g. "Raichu") -> the
// regional suffixes that exist for it in this pokedex, each with its
// full type list. Only species actually present as both a base and a
// "-Region" key in Resources/Showdown/pokedex.js are listed - if a
// species isn't here, resolveAlternateForm leaves it as the base name
// (matching the "keep base form for anything not explicitly handled"
// fallback the user asked for).
const REGIONAL_FORMS = {
  Diglett: { base: ["Ground"], Alola: ["Ground", "Steel"] },
  Dugtrio: { base: ["Ground"], Alola: ["Ground", "Steel"] },
  Geodude: { base: ["Rock", "Ground"], Alola: ["Rock", "Electric"] },
  Graveler: { base: ["Rock", "Ground"], Alola: ["Rock", "Electric"] },
  Golem: { base: ["Rock", "Ground"], Alola: ["Rock", "Electric"] },
  Grimer: { base: ["Poison"], Alola: ["Poison", "Dark"] },
  Muk: { base: ["Poison"], Alola: ["Poison", "Dark"] },
  Exeggutor: { base: ["Grass", "Psychic"], Alola: ["Grass", "Dragon"] },
  Marowak: { base: ["Ground"], Alola: ["Fire", "Ghost"] },
  Meowth: { base: ["Normal"], Alola: ["Dark"], Galar: ["Steel"] },
  Persian: { base: ["Normal"], Alola: ["Dark"] },
  // Pikachu-Alola is deliberately omitted: it's a cosmetic cap variant
  // with identical base stats to plain Pikachu in this dex, so there's
  // nothing for resolving it differently to actually change.
  Raichu: { base: ["Electric"], Alola: ["Electric", "Psychic"] },
  Rattata: { base: ["Normal"], Alola: ["Dark", "Normal"] },
  Raticate: { base: ["Normal"], Alola: ["Dark", "Normal"] },
  Sandshrew: { base: ["Ground"], Alola: ["Ice", "Steel"] },
  Sandslash: { base: ["Ground"], Alola: ["Ice", "Steel"] },
  Vulpix: { base: ["Fire"], Alola: ["Ice"] },
  Ninetales: { base: ["Fire"], Alola: ["Ice", "Fairy"] },
  Articuno: { base: ["Ice", "Flying"], Galar: ["Psychic", "Flying"] },
  Zapdos: { base: ["Electric", "Flying"], Galar: ["Fighting", "Flying"] },
  Moltres: { base: ["Fire", "Flying"], Galar: ["Dark", "Flying"] },
  Corsola: { base: ["Water", "Rock"], Galar: ["Ghost"] },
  Darumaka: { base: ["Fire"], Galar: ["Ice"] },
  Darmanitan: { base: ["Fire"], Galar: ["Ice"] },
  Zigzagoon: { base: ["Normal"], Galar: ["Dark", "Normal"] },
  Linoone: { base: ["Normal"], Galar: ["Dark", "Normal"] },
  "Mr. Mime": { base: ["Psychic", "Fairy"], Galar: ["Ice", "Psychic"] },
  Ponyta: { base: ["Fire"], Galar: ["Psychic"] },
  Rapidash: { base: ["Fire"], Galar: ["Psychic"] },
  Slowpoke: { base: ["Water", "Psychic"], Galar: ["Poison", "Psychic"] },
  Slowbro: { base: ["Water", "Psychic"], Galar: ["Poison", "Psychic"] },
  Slowking: { base: ["Water", "Psychic"], Galar: ["Poison", "Psychic"] },
  Stunfisk: { base: ["Ground", "Electric"], Galar: ["Ground", "Steel"] },
  Weezing: { base: ["Poison"], Galar: ["Poison", "Fairy"] },
  Yamask: { base: ["Ghost"], Galar: ["Ground", "Ghost"] },
  Arcanine: { base: ["Fire"], Hisui: ["Fire", "Rock"] },
  Growlithe: { base: ["Fire"], Hisui: ["Fire", "Rock"] },
  Avalugg: { base: ["Ice"], Hisui: ["Ice", "Rock"] },
  Braviary: { base: ["Normal", "Flying"], Hisui: ["Psychic", "Flying"] },
  Decidueye: { base: ["Grass", "Ghost"], Hisui: ["Grass", "Fighting"] },
  Electrode: { base: ["Electric"], Hisui: ["Electric", "Grass"] },
  Voltorb: { base: ["Electric"], Hisui: ["Electric", "Grass"] },
  Sliggoo: { base: ["Dragon"], Hisui: ["Steel", "Dragon"] },
  Goodra: { base: ["Dragon"], Hisui: ["Steel", "Dragon"] },
  Lilligant: { base: ["Grass"], Hisui: ["Grass", "Fighting"] },
  Qwilfish: { base: ["Water", "Poison"], Hisui: ["Dark", "Poison"] },
  Samurott: { base: ["Water"], Hisui: ["Water", "Dark"] },
  Sneasel: { base: ["Dark", "Ice"], Hisui: ["Fighting", "Poison"] },
  Typhlosion: { base: ["Fire"], Hisui: ["Fire", "Ghost"] },
  Zorua: { base: ["Dark"], Hisui: ["Normal", "Ghost"] },
  Zoroark: { base: ["Dark"], Hisui: ["Normal", "Ghost"] },
  Wooper: { base: ["Water", "Ground"], Paldea: ["Poison"] },
};

const REGION_KEY_SUFFIX = { Alola: "Alola", Galar: "Galar", Hisui: "Hisui", Paldea: "Paldea" };

// Species known to have separate male/female pokedex.js entries with
// genuinely different base stats (not just cosmetic) - the on-screen
// name never distinguishes them (see spellCorrect.mjs's Male/Female-
// suffix stripping), so this checks the gender icon color instead.
// Keyed by base species name -> the pokedex.js key for the female entry.
const GENDER_STAT_VARIANTS = {
  Basculegion: "Basculegion-F",
  Indeedee: "Indeedee-F",
  Meowstic: "Meowstic-F",
  Oinkologne: "Oinkologne-F",
};

// baseName: the already-translated, already-form-suffix-resolved English
// species name (e.g. "Raichu", "Basculegion"). icons: detectHeaderIcons'
// output. pokedex: the Showdown base-stat dex, used only to confirm a
// candidate key actually exists before returning it.
export function resolveAlternateForm(baseName, icons, pokedex) {
  if (!icons.length) return baseName;

  // The gender icon, if present, is always first and is unambiguously
  // red or blue - distinct enough from every type's color band that it's
  // identified before any type classification runs.
  let typeIcons = icons;
  let gender = null;
  if (isFemaleIcon(icons[0])) { gender = "female"; typeIcons = icons.slice(1); }
  else if (isMaleIcon(icons[0])) { gender = "male"; typeIcons = icons.slice(1); }

  if (gender === "female" && GENDER_STAT_VARIANTS[baseName] && pokedex[GENDER_STAT_VARIANTS[baseName]]) {
    return GENDER_STAT_VARIANTS[baseName];
  }

  const forms = REGIONAL_FORMS[baseName];
  if (!forms) return baseName;

  const candidates = Object.entries(forms).filter(([region]) => {
    if (region === "base") return true;
    const key = `${baseName}-${REGION_KEY_SUFFIX[region]}`;
    return Boolean(pokedex[key]);
  });
  if (candidates.length <= 1) return baseName;

  // Score each candidate form by how well its known type list matches
  // the actually-detected type icons (both in count and per-icon color),
  // and keep whichever scores best - falling back to the base form on a
  // tie or if nothing scores reasonably, per the "when unsure, keep the
  // base form" rule.
  let bestRegion = "base", bestScore = -Infinity;
  for (const [region, types] of candidates) {
    if (types.length !== typeIcons.length) continue; // icon count alone rules this candidate out
    let score = 0;
    for (let i = 0; i < types.length; i++) score += typeMatchScore(typeIcons[i], types[i]);
    if (score > bestScore) { bestScore = score; bestRegion = region; }
  }

  if (bestRegion === "base") return baseName;
  return `${baseName}-${REGION_KEY_SUFFIX[bestRegion]}`;
}
