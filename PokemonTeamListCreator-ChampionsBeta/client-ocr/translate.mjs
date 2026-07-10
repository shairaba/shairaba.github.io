// JS port of resources.py's _normalize / _name_to_id / translate_to_english.
// Unlike the Python engine, this doesn't parse Resources/*.js files itself
// - the browser page loads them as plain globals via <script> tags (the
// same convention script.js already uses for pokedex.js/natures.js), and
// this module is handed those already-parsed id->name dicts directly.
import { getCloseMatches, ratio as ratioOf } from "./sequenceMatcher.mjs";

const CJK_RANGES = [
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xac00, 0xd7a3], // Hangul syllables
  [0x1100, 0x11ff], // Hangul jamo
  [0xf900, 0xfaff], // CJK compatibility ideographs
];

export function isCjk(text) {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (CJK_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) return true;
  }
  return false;
}

// Same fuzzy-match key as resources.py's _normalize: strip accents,
// lowercase, collapse punctuation, for Latin-script text - CJK text
// deliberately skips accent-stripping (NFKD would silently turn Japanese
// voiced kana into their unvoiced counterpart, e.g. だ -> た, corrupting
// the word's actual reading rather than being a harmless no-op).
export function normalize(text) {
  if (!isCjk(text)) {
    text = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  text = text.replace(/[^\p{L}\p{N}\s_-]/gu, "");
  text = text.replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
  return text;
}

// Builds the reverse (normalized foreign name -> id) index used below,
// given a language's id->name dict (e.g. the global `pokesFre` object).
export function buildNameToId(idToName) {
  const rev = {};
  for (const [id, name] of Object.entries(idToName)) {
    const norm = normalize(name);
    if (norm && !(norm in rev)) rev[norm] = id;
  }
  return rev;
}

// Given a species name in Showdown's format (e.g. "Floette-Eternal",
// "Charizard-Mega-Y" - what pipeline.mjs and pokedex.js key on), returns
// that species' *base-form* name in `lang`, or null if not found.
//
// This exists for mega-stone-name reconstruction on nicknamed Pokemon: a
// mega stone's on-screen name shares a prefix with the species' own native
// name (e.g. Japanese "フラエッテナイト" = "Floette" + "night/knight"), but
// when the Pokemon is nicknamed there's no OCR'd species text on the card
// to compare that prefix against at all - the resolved species name (from
// movesetMatch.mjs, since the nickname couldn't be text-matched) is the
// only thing available. It's in Showdown format, not idToNameByLang.en's
// own English-name format ("Floette-Eternal" here vs "Floette Eternal
// Flower" in the bundled Pokes data - two different naming conventions
// that happen to disagree past the base species). Splitting off everything
// after the first "-" sidesteps that mismatch entirely rather than needing
// to reconcile the two conventions for every alternate form: a mega
// stone's name is always built from the *base* species name anyway, never
// the form-qualified one, so the base form is exactly what's needed here
// regardless.
export function baseNativeName(englishName, idToNameByLangName, lang) {
  const base = englishName.split("-")[0].trim();
  const normBase = normalize(base);
  const idToNameEnglish = idToNameByLangName.en;
  let matchedId = null;
  for (const [id, enName] of Object.entries(idToNameEnglish)) {
    if (normalize(enName) === normBase) {
      matchedId = id;
      break;
    }
  }
  if (matchedId === null) return null;
  return idToNameByLangName[lang]?.[matchedId] ?? null;
}

// Strips Japanese dakuten/handakuten (voicing) marks the same way
// normalize() strips Latin accents (NFKD decompose + drop combining
// marks) - e.g. "づ" -> "つ", "ど" -> "と". Deliberately the opposite of
// what normalize() does for CJK text, which keeps voicing intact since
// it's normally a meaningful part of the word.
//
// Exists purely as a fallback lookup key for a specific EasyOCR failure
// mode seen on real Japanese screenshots: the small dakuten mark next to a
// kana glyph is sometimes dropped, or swapped for a handakuten, by the OCR
// itself (not a normalization bug - the character reading is just wrong),
// e.g. real "どくづき" (Poison Jab) read back as "とくつき", or real
// "オボンのみ" (Sitrus Berry) read back as "オポンのみ" (dakuten ボ swapped
// for handakuten ポ). A straight fuzzy match of that misread against the
// (correctly voiced) real name doesn't fail cleanly - it can lose to some
// other, unrelated entry whose own voicing pattern happens to overlap more
// (observed for real: "とくつき" loses to "ずつき"/Headbutt over the
// intended "どくづき"/Poison Jab; "オポンのみ" is literally equidistant
// between Sitrus Berry's real name and "オレンのみ"/Oran Berry, a coin-flip
// a plain fuzzy match can't resolve correctly). Comparing devoiced keys
// instead catches the intended word exactly, before that fuzzy contest runs.
//
// NFKD decomposes a dakuten/handakuten kana into its base glyph plus a
// combining mark, but that mark lives at U+3099/U+309A - a different
// Unicode block from the Latin combining-accent range (U+0300-U+036F)
// normalize() strips for French/German/etc text. Using only the Latin
// range here (as a first version of this function did) silently never
// matches real Japanese voicing marks at all, making this whole fallback a
// no-op for the exact input it exists to handle - confirmed empirically,
// not just in theory: `"オポンのみ".normalize("NFKD")` really does produce
// a trailing U+309A codepoint, and the Latin-only regex really does leave
// it untouched.
// foldSmallKana additionally folds small kana (\u3063/\u3083/\u3085/\u3087/\u3041.../\u30c3/\u30e3/\u30e5/\u30e7/\u30a1...)
// to their regular-size counterparts - a second, visually-similar EasyOCR
// slip-up (e.g. "\u306d\u3063\u3077\u3046"/Heat Wave misread as "\u306d\u3064\u3076\u3046", losing both the
// handakuten *and* shrinking \u3063 to \u3064) that a plain dakuten/handakuten-only
// strip doesn't catch. This is opt-in, not applied by default, because it's
// only collision-free for the 'move' category: checked against every
// bundled Japanese name list, it introduces real collisions for 'name'
// (Cubone "\u30ab\u30e9\u30ab\u30e9"/Marowak "\u30ac\u30e9\u30ac\u30e9" - a real, meaningful dakuten
// distinction between two different species) and 'item' (six silver/gold
// item pairs like "\u304e\u3093\u306e\u304a\u3046\u304b\u3093"/"\u304d\u3093\u306e\u304a\u3046\u304b\u3093"), so callers must only
// pass this for categories confirmed collision-free.
function devoiceKana(text, { foldSmallKana = false } = {}) {
  let result = text.normalize("NFKD").replace(/[\u0300-\u036f\u3099\u309a]/g, "");
  if (foldSmallKana) {
    result = [...result].map((ch) => SMALL_KANA_TO_LARGE[ch] ?? ch).join("");
  }
  return result;
}

const SMALL_KANA_TO_LARGE = {
  "\u3041": "\u3042", "\u3043": "\u3044", "\u3045": "\u3046", "\u3047": "\u3048", "\u3049": "\u304a",
  "\u3063": "\u3064", "\u3083": "\u3084", "\u3085": "\u3086", "\u3087": "\u3088",
  "\u30a1": "\u30a2", "\u30a3": "\u30a4", "\u30a5": "\u30a6", "\u30a7": "\u30a8", "\u30a9": "\u30aa",
  "\u30c3": "\u30c4", "\u30e3": "\u30e4", "\u30e5": "\u30e6", "\u30e7": "\u30e8",
};

function buildDevoicedNameToId(idToName, options) {
  const rev = {};
  for (const [norm, id] of Object.entries(buildNameToId(idToName))) {
    const dv = devoiceKana(norm, options);
    if (dv && !(dv in rev)) rev[dv] = id;
  }
  return rev;
}

// idToNameForLang: the source language's id->name dict (e.g. pokesFre).
// idToNameEnglish: English id->name dict (e.g. pokesEn) - the output is
// always this English name regardless of source language, matching
// Showdown convention. Returns null if nothing matched closely enough.
export function translateToEnglish(rawText, idToNameForLang, idToNameEnglish, cutoff = 0.5, category = null) {
  const [name] = translateToEnglishConfidence(rawText, idToNameForLang, idToNameEnglish, cutoff, category);
  return name;
}

// Same matching as translateToEnglish, but also returns [name, confidence]
// where confidence is 1.0 for an exact prefix match or a devoiced-exact
// match (both precise, non-fuzzy signals), otherwise the raw ratio of the
// fuzzy match, or 0.0 if nothing matched at all.
//
// This split exists because "found a match" and "this text really is the
// thing being matched" are different questions for the 'name' category
// specifically: a nicknamed Pokemon's nickname is a real word that will
// often clear the fuzzy cutoff against *something* in the species list by
// pure coincidence - translateToEnglish alone can't tell that apart from a
// genuine, high-ratio species-name match. Callers with a fallback
// identification method for the 'name' category (see movesetMatch.mjs) need
// the actual ratio to decide which source to trust.
export function translateToEnglishConfidence(rawText, idToNameForLang, idToNameEnglish, cutoff = 0.5, category = null) {
  if (!rawText || !rawText.trim()) return [rawText ? rawText.trim() : "", 0.0];

  const normQuery = normalize(rawText);
  if (!normQuery) return [rawText.trim(), 0.0];

  const rev = buildNameToId(idToNameForLang);
  const keys = Object.keys(rev);

  // Gendered forms (Basculegion/Meowstic/Indeedee/Oinkologne) are stored
  // with a "-Male"/"-Female" suffix that never appears in the on-screen
  // name - an exact prefix match is checked first and wins outright, so
  // the correct entry's extra suffix length can't let ratio-based scoring
  // pick a same-length wrong entry instead (a real past failure: a
  // Japanese Basculegion query lost to Torterra's Japanese name, 0.60 vs
  // 0.59, purely because of that diluted ratio).
  const prefixMatches = keys.filter((k) => k === normQuery || k.startsWith(normQuery + "-"));
  if (prefixMatches.length) {
    const matchKey = prefixMatches.reduce((shortest, k) => (k.length < shortest.length ? k : shortest));
    return [idToNameEnglish[rev[matchKey]] ?? null, 1.0];
  }

  // Devoiced exact match: a strong, precise signal that OCR simply dropped
  // a dakuten mark, checked before the fuzzy contest below can lose that
  // word to an unrelated one - see devoiceKana above. Small-kana folding is
  // layered on only for 'move' - the one category confirmed collision-free
  // (see devoiceKana's docstring) - as a second pass if the stricter
  // dakuten-only devoiced key doesn't hit either.
  if (isCjk(rawText)) {
    const options = { foldSmallKana: false };
    const devoiced = buildDevoicedNameToId(idToNameForLang, options);
    const dvQuery = devoiceKana(normQuery, options);
    if (dvQuery in devoiced) {
      return [idToNameEnglish[devoiced[dvQuery]] ?? null, 1.0];
    }
    if (category === "move") {
      const looseOptions = { foldSmallKana: true };
      const looseDevoiced = buildDevoicedNameToId(idToNameForLang, looseOptions);
      const looseDvQuery = devoiceKana(normQuery, looseOptions);
      if (looseDvQuery in looseDevoiced) {
        return [idToNameEnglish[looseDevoiced[looseDvQuery]] ?? null, 1.0];
      }
    }
  }

  const [best] = getCloseMatches(normQuery, keys, 1, cutoff);
  if (!best) return [null, 0.0];
  return [idToNameEnglish[rev[best]] ?? null, ratioOf(normQuery, best)];
}

// Same matching as translateToEnglishConfidence, but returns up to `k`
// ranked [name, confidence] candidates instead of committing to just the
// best one - for the manual-review picker (see main.mjs): when nothing
// scores confidently enough to trust automatically, the next-best few
// guesses are exactly what a human reviewer needs to pick from instead of
// re-typing the whole name from scratch. Confidence is computed the same
// way translateToEnglishConfidence does (1.0 for prefix/devoiced-exact,
// otherwise the fuzzy ratio) so a caller can reuse the same "trust this
// automatically" threshold either function's result to decide whether to
// surface the picker at all.
export function translateToEnglishCandidates(rawText, idToNameForLang, idToNameEnglish, category = null, k = 5, cutoff = 0.3) {
  if (!rawText || !rawText.trim()) return [];

  const normQuery = normalize(rawText);
  if (!normQuery) return [];

  const rev = buildNameToId(idToNameForLang);
  const keys = Object.keys(rev);

  const results = new Map(); // english name -> best confidence seen for it

  const prefixMatches = keys.filter((k2) => k2 === normQuery || k2.startsWith(normQuery + "-"));
  for (const k2 of prefixMatches) {
    const en = idToNameEnglish[rev[k2]];
    if (en) results.set(en, 1.0);
  }

  if (isCjk(rawText)) {
    for (const options of [{ foldSmallKana: false }, ...(category === "move" ? [{ foldSmallKana: true }] : [])]) {
      const devoiced = buildDevoicedNameToId(idToNameForLang, options);
      const dvQuery = devoiceKana(normQuery, options);
      if (dvQuery in devoiced) {
        const en = idToNameEnglish[devoiced[dvQuery]];
        if (en) results.set(en, 1.0);
      }
    }
  }

  for (const key of getCloseMatches(normQuery, keys, k, cutoff)) {
    const en = idToNameEnglish[rev[key]];
    if (!en) continue;
    const score = ratioOf(normQuery, key);
    if (!results.has(en) || results.get(en) < score) results.set(en, score);
  }

  return [...results.entries()]
    .map(([name, confidence]) => ({ name, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k);
}
