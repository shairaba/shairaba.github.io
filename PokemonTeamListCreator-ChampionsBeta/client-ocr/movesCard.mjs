// JS port of engine.py's "MOVES CARD" section: extracts name/ability/item
// from the left column and up to 4 moves from the right column, applying
// spell-correction/translation and the mega-stone/Rotom-form/Floette
// special cases.
import { groupDetectionsIntoLines, splitLeftRight, dropTinyText } from "./parseStats.mjs";
import {
  spellCorrect, slugify, formatName,
  looksLikeMegaStone, looksLikeMegaStoneRaw, detectRotomForm, resolveFormSuffix,
} from "./spellCorrect.mjs";

// idToNameByLang: {name: 'Pokes'|'Items'|'Abilities'|'Moves' -> {lang -> idToName}}
// i.e. idToNameByLang.name.en is pokesEn, idToNameByLang.item.fr is itemsFre, etc.
// Unlike the stats card, nothing this card actually reads (species name,
// ability, item, moves) is ever purely digits - a lone stray number (a
// misread "Lv. 50" indicator or similar page furniture) is always noise
// here, regardless of how tall it renders. This catches cases the height
// filter below can't: a noise token tall enough to survive that filter
// (e.g. "5" at height 60 next to a 138-tall species name, comfortably
// above the 0.35 ratio cutoff) still merged into the name's own row and
// corrupted the match query ("5 Sinistcha" fuzzy-matched to the wrong,
// unrelated "Sinistea" instead of "Sinistcha Masterpiece Form", since the
// stray prefix diluted the ratio against the correct longer entry).
function dropNonWordy(tokens) {
  return tokens.filter((t) => /\p{L}/u.test(t.text));
}

export function parseMovesCard(tokens, cardWidth, idToNameByLang, lang = "en") {
  const [leftRaw, rightRaw] = splitLeftRight(tokens, cardWidth, 0.45);
  // A looser ratio than the stats card's default: a long ability name
  // (e.g. "Good as Gold") can render noticeably smaller than the species
  // name via auto-shrink-to-fit, which the stats card's tighter 0.6 ratio
  // would wrongly drop as noise here.
  const leftLines = groupDetectionsIntoLines(dropNonWordy(dropTinyText(leftRaw, 0.35)));
  const rightLines = groupDetectionsIntoLines(dropNonWordy(dropTinyText(rightRaw, 0.35)));

  const nameRaw = leftLines[0]?.text ?? "";
  const name = nameRaw ? spellCorrect(nameRaw, "name", idToNameByLang.name, lang) : "Unknown";
  const abilityRaw = leftLines[1]?.text ?? "";
  let itemRaw = leftLines[2]?.text ?? "";
  itemRaw = itemRaw.replace(/@/g, "").trim();

  const ability = abilityRaw ? spellCorrect(abilityRaw, "ability", idToNameByLang.ability, lang) : "";

  let itemName;
  // Compared against the raw (untranslated) species text, not the
  // English-translated `name` - a custom mega stone's on-screen name
  // shares a prefix with the species name in whatever language the
  // screenshot is in, not with the English name.
  if (itemRaw && looksLikeMegaStone(slugify(itemRaw), slugify(nameRaw))) {
    itemName = formatName(slugify(itemRaw));
  } else if (itemRaw && looksLikeMegaStoneRaw(itemRaw, nameRaw, lang)) {
    // slugify() is ASCII-only and would empty out non-Latin text, so
    // there's no raw suffix to format here the way the English branch
    // above does - reconstruct the name from the (already-translated)
    // English species name and the "-ite" convention instead, since
    // that's what a real mega stone's English name would look like
    // anyway. A trailing "e" is dropped before adding "-ite" (matching
    // real examples: Sceptile -> Sceptilite, Gardevoir -> Gardevoirite
    // has no such vowel to drop) since "-ite" already starts with a vowel.
    const stem = name.endsWith("e") ? name.slice(0, -1) : name;
    const variant = itemRaw.trim().match(/([XY])$/);
    itemName = `${stem}ite` + (variant ? ` ${variant[1]}` : "");
  } else {
    itemName = itemRaw ? spellCorrect(itemRaw, "item", idToNameByLang.item, lang) : "";
  }

  const moves = rightLines.slice(0, 4).map((l) => spellCorrect(l.text, "move", idToNameByLang.move, lang));

  let finalName = name;
  if (finalName === "Rotom") {
    const rotomForm = detectRotomForm(moves);
    if (rotomForm) finalName = `Rotom-${rotomForm}`;
  } else if (finalName === "Floette" && slugify(itemName) === "floettite") {
    // Only the Eternal Flower form can hold Floettite - but the reverse
    // isn't reliable (Eternal Flower can be played without the stone), so
    // an ordinary Floette without it is left as-is rather than guessed at.
    finalName = "Floette-Eternal";
  } else {
    finalName = resolveFormSuffix(finalName);
  }

  return { name: finalName, ability, item: itemName, moves };
}
