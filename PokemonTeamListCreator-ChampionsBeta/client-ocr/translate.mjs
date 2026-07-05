// JS port of resources.py's _normalize / _name_to_id / translate_to_english.
// Unlike the Python engine, this doesn't parse Resources/*.js files itself
// - the browser page loads them as plain globals via <script> tags (the
// same convention script.js already uses for pokedex.js/natures.js), and
// this module is handed those already-parsed id->name dicts directly.
import { getCloseMatches } from "./sequenceMatcher.mjs";

const CJK_RANGES = [
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xac00, 0xd7a3], // Hangul syllables
  [0x1100, 0x11ff], // Hangul jamo
  [0xf900, 0xfaff], // CJK compatibility ideographs
];

function isCjk(text) {
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

// idToNameForLang: the source language's id->name dict (e.g. pokesFre).
// idToNameEnglish: English id->name dict (e.g. pokesEn) - the output is
// always this English name regardless of source language, matching
// Showdown convention. Returns null if nothing matched closely enough.
export function translateToEnglish(rawText, idToNameForLang, idToNameEnglish, cutoff = 0.5) {
  if (!rawText || !rawText.trim()) return rawText ? rawText.trim() : "";

  const normQuery = normalize(rawText);
  if (!normQuery) return rawText.trim();

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
  let matchKey;
  if (prefixMatches.length) {
    matchKey = prefixMatches.reduce((shortest, k) => (k.length < shortest.length ? k : shortest));
  } else {
    const [best] = getCloseMatches(normQuery, keys, 1, cutoff);
    if (!best) return null;
    matchKey = best;
  }

  const matchedId = rev[matchKey];
  return idToNameEnglish[matchedId] ?? null;
}
