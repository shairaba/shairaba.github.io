// JS port of engine.py's slugify/format_name/spell_correct plus its
// mega-stone and Rotom-form special cases.
import { translateToEnglish, translateToEnglishConfidence, translateToEnglishCandidates } from "./translate.mjs";

const DISPLAY_OVERRIDES = {
  "double-edge": "Double-Edge", "x-scissor": "X-Scissor", "u-turn": "U-turn",
  "will-o-wisp": "Will-O-Wisp", "freeze-dry": "Freeze-Dry", "soft-boiled": "Soft-Boiled",
  "multi-attack": "Multi-Attack", "trick-or-treat": "Trick-or-Treat", "wake-up-slap": "Wake-Up Slap",
  "lock-on": "Lock-On", "baby-doll-eyes": "Baby-Doll Eyes", "self-destruct": "Self-Destruct",
  "topsy-turvy": "Topsy-Turvy", "power-up-punch": "Power-Up Punch",
  "never-ending-nightmare": "Never-Ending Nightmare", "high-horsepower": "High Horsepower",
  "v-create": "V-create", "chip-away": "Chip Away", "good-as-gold": "Good as Gold",
  "as-one-glastrier": "As One (Glastrier)", "as-one-spectrier": "As One (Spectrier)",
  "power-of-alchemy": "Power of Alchemy", "mind-s-eye": "Mind's Eye",
  "tablets-of-ruin": "Tablets of Ruin", "vessel-of-ruin": "Vessel of Ruin",
  "sword-of-ruin": "Sword of Ruin", "beads-of-ruin": "Beads of Ruin",
  "king-s-rock": "King's Rock", "kings-shield": "King's Shield",
  "lucky-punch": "Lucky Punch", "ring-target": "Ring Target",
  // Species names with punctuation OCR routinely mangles (the stylized
  // lowercase "o" in Kommo-o/Jangmo-o/Hakamo-o is a frequent misread as a
  // zero; apostrophes and colons get stripped by slugify entirely).
  "kommo-o": "Kommo-o", "jangmo-o": "Jangmo-o", "hakamo-o": "Hakamo-o", "ho-oh": "Ho-Oh",
  "mr-mime": "Mr. Mime", "mr-rime": "Mr. Rime", "mime-jr": "Mime Jr.",
  "farfetchd": "Farfetch'd", "sirfetchd": "Sirfetch'd", "type-null": "Type: Null",
  "nidoran-m": "Nidoran-M", "nidoran-f": "Nidoran-F", "flabebe": "Flabébé", "porygon-z": "Porygon-Z",
};

const MINOR_WORDS = new Set(["as", "of", "the", "a", "an", "and", "or", "via", "per", "in", "on"]);

export function formatName(slug) {
  slug = slug.replace(/^-+|-+$/g, "").toLowerCase();
  if (slug in DISPLAY_OVERRIDES) return DISPLAY_OVERRIDES[slug];
  const words = slug.split("-").filter(Boolean);
  return words
    .map((w, i) => (i > 0 && MINOR_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function slugify(text) {
  text = text.replace(/@/g, " ").trim().toLowerCase();
  text = text.replace(/[^a-z0-9\s-]/g, "");
  text = text.replace(/[\s-]+/g, "-").replace(/^-+|-+$/g, "");
  return text;
}

// The Pokes resource data spells out regional variants as "<Species>
// <Region>ian Form" (e.g. "Ninetales Alolan Form", "Slowbro Galarian
// Form") - not a bug, that's genuinely the on-screen text in this game -
// but Showdown/pokedex.js keys them as "<Species>-<Region>" (e.g.
// "Ninetales-Alola"). Left untranslated, every regional form (a very
// common competitive pick - Alolan Ninetales, Galarian Slowbro, etc.)
// would fail the pokedex.js base-stat lookup and silently lose EV
// verification. Basculin's colors/Lycanroc's times-of-day/Sinistcha's
// forms and the like use their own varied, non-regional suffix
// conventions and aren't covered by this - they're rarer in practice and
// still work, just without base-stat cross-checking of their EVs.
const REGION_SUFFIX = { Alolan: "Alola", Galarian: "Galar", Hisuian: "Hisui", Paldean: "Paldea" };

// Shared post-processing applied to a translated "name" category result -
// gender-suffix stripping and regional-form-suffix reshaping - factored out
// so both spellCorrect and spellCorrectConfidence apply it identically.
function finishNameResult(name) {
  // A handful of species (Meowstic, Indeedee, Basculegion, Oinkologne)
  // are stored as separate "X Male"/"X Female" entries in the resource
  // data, but the on-screen name never shows gender - that's always a
  // separate icon - so this suffix would never actually appear in what
  // was OCR'd.
  name = name.replace(/\s+(Male|Female)$/, "");
  const regionMatch = name.match(/^(.+) (Alolan|Galarian|Hisuian|Paldean) Form$/);
  if (regionMatch) {
    // Built directly rather than run through the formatName/slugify call
    // below - that call joins every hyphen-separated segment back
    // together with spaces (right for a real multi-word name, wrong here
    // since Showdown's own key needs the literal hyphen kept, e.g.
    // "Ninetales-Alola" not "Ninetales Alola").
    return `${formatName(slugify(regionMatch[1]))}-${REGION_SUFFIX[regionMatch[2]]}`;
  }
  return formatName(slugify(name));
}

// idToNameByLang: {name -> idToName} bundle for one category (e.g.
// {en: pokesEn, fr: pokesFre, ...}), keyed the same as resources.py's
// LANGUAGES codes. Looks up idToNameByLang[lang] and idToNameByLang.en.
export function spellCorrect(text, category, idToNameByLang, lang = "en") {
  if (!text || !text.trim()) return text ? text.trim() : "";

  const idToNameForLang = idToNameByLang[lang];
  const idToNameEnglish = idToNameByLang.en;
  const english = translateToEnglish(text, idToNameForLang, idToNameEnglish, 0.5, category);
  if (english !== null) {
    return category === "name" ? finishNameResult(english) : formatName(slugify(english));
  }
  return formatName(slugify(text));
}

// Same as spellCorrect(text, "name", ...), but also returns the raw match
// confidence from translateToEnglishConfidence - see that function's
// docstring for why "found a match" and "this text really is the species
// name" are different questions for nicknamed Pokemon. Only meaningful for
// the "name" category; other categories don't need this distinction.
export function spellCorrectNameConfidence(text, idToNameByLang, lang = "en") {
  if (!text || !text.trim()) return [text ? text.trim() : "", 0.0];

  const idToNameForLang = idToNameByLang[lang];
  const idToNameEnglish = idToNameByLang.en;
  const [english, confidence] = translateToEnglishConfidence(text, idToNameForLang, idToNameEnglish);
  if (english !== null) {
    return [finishNameResult(english), confidence];
  }
  return [formatName(slugify(text)), confidence];
}

// Same underlying match as spellCorrect, but returns up to `k` ranked
// {name, confidence} candidates (post-processed the same way spellCorrect's
// single result is - gender/region-suffix reshaping for "name", plain
// format/slugify otherwise) instead of only the best guess - for the
// manual-review picker (see main.mjs). Works for any category, unlike
// spellCorrectNameConfidence which is name-specific.
export function spellCorrectCandidates(text, category, idToNameByLang, lang = "en", k = 5) {
  if (!text || !text.trim()) return [];

  const idToNameForLang = idToNameByLang[lang];
  const idToNameEnglish = idToNameByLang.en;
  const raw = translateToEnglishCandidates(text, idToNameForLang, idToNameEnglish, category, k);
  return raw.map(({ name, confidence }) => ({
    name: category === "name" ? finishNameResult(name) : formatName(slugify(name)),
    confidence,
  }));
}

// Beyond the four regional adjectives above, the Pokes resource data has
// many other "<Species> <Descriptor> Form(e)" entries (Sinistcha
// Masterpiece Form, Aegislash Blade Forme, Lycanroc Midday Form, ...).
// Unlike a regional variant, these describe an in-battle stance/state
// rather than a separately battled Showdown entry - Aegislash is always
// team-built as plain "Aegislash" (its ability handles the Blade Forme
// switch automatically) and the same goes for the others, so the
// descriptor is always dropped back to the bare species name here
// (confirmed against real samples - not a guess).
export function resolveFormSuffix(name) {
  const match = name.match(/^(.+?) [A-Za-z'-]+ Forme?$/);
  return match ? match[1] : name;
}

// Catches mega stones for Pokemon that don't canonically mega evolve in
// the real games (e.g. this game's Floette-Eternal), which can't exist in
// the real item database fuzzy-matched against above. Fuzzy matching
// would otherwise force a "closest" match onto some unrelated real item
// name (e.g. "Floettite" -> "Lost Item"), so this needs to be checked
// before, not after, that lookup.
export function looksLikeMegaStone(itemSlug, nameSlug) {
  let stem = itemSlug;
  if (stem.endsWith("-x") || stem.endsWith("-y")) stem = stem.slice(0, -2);
  if (!stem.endsWith("ite")) return false;
  stem = stem.slice(0, -3);

  // Compare against just the species name's own first word - OCR
  // sometimes tacks stray junk onto the name (e.g. a misread gender
  // symbol turning "Floette" into "Floette Q"), and that shouldn't count
  // against the match.
  const nameWord = nameSlug ? nameSlug.split("-")[0] : "";
  if (!stem || !nameWord) return false;

  let common = 0;
  for (let i = 0; i < Math.min(stem.length, nameWord.length); i++) {
    if (stem[i] !== nameWord[i]) break;
    common++;
  }
  // A couple of characters of elision is normal (e.g. Floette -> "Floett"
  // + "ite" drops the final "e"), so the match doesn't need to be exact.
  return common >= Math.max(3, Math.min(stem.length, nameWord.length) - 2);
}

// Mega stone naming conventions confirmed from real screenshots: the
// species name followed by this word (with an optional trailing X/Y for
// the two stones with two versions). slugify() is ASCII-only and would
// strip non-Latin scripts to nothing, so this checks the untranslated raw
// OCR text directly instead of a slug - looksLikeMegaStone above already
// covers English/Latin scripts via slugify.
const MEGA_STONE_WORD_BY_LANG = {
  ja: "ナイト", // e.g. Floette -> "フラエッテナイト" (Furaette-naito)
};

export function looksLikeMegaStoneRaw(itemRaw, nameRaw, lang) {
  const word = MEGA_STONE_WORD_BY_LANG[lang];
  if (!word || !itemRaw || !nameRaw) return false;
  itemRaw = itemRaw.trim();
  nameRaw = nameRaw.trim().replace(/[^\p{L}\p{N}]+$/u, ""); // drop trailing junk (e.g. a misread gender symbol)
  const core = itemRaw.replace(/\s*[XY]$/, "");
  if (!core.endsWith(word) || !nameRaw) return false;
  const stem = core.slice(0, -word.length);

  let common = 0;
  for (let i = 0; i < Math.min(stem.length, nameRaw.length); i++) {
    if (stem[i] !== nameRaw[i]) break;
    common++;
  }
  return common >= Math.max(2, Math.min(stem.length, nameRaw.length) - 2);
}

// Rotom's alternate forms are cosmetically identical in a single
// screenshot (same base sprite family) but each is tied to a signature
// move that no other Rotom form learns - the reader already OCRs the
// movelist, so this reuses that instead of needing separate sprite/type-
// icon classification.
const ROTOM_FORM_SIGNATURE_MOVES = {
  overheat: "Heat", "hydro-pump": "Wash", blizzard: "Frost",
  "air-slash": "Fan", "leaf-storm": "Mow",
};

export function detectRotomForm(moves) {
  for (const move of moves) {
    const form = ROTOM_FORM_SIGNATURE_MOVES[slugify(move)];
    if (form) return form;
  }
  return null;
}
