// Full client-side pipeline: two already-loaded images (moves screen,
// stats screen) in -> a Showdown-style pokepaste string out. Orchestrates
// every piece ported so far, mirroring engine.py's PokePasteEngine.process_images
// + render_pokepaste.
import { getCardBoundingBoxes } from "./cardDetect.mjs";
import { runOcr } from "./ocr.mjs";
import { parseStatsCard } from "./parseStats.mjs";
import { detectNatureConfidence } from "./natureDetect.mjs";
import { computeEvsFromTotals } from "./evCalc.mjs";
import { parseMovesCard } from "./movesCard.mjs";
import { detectHeaderIcons, resolveAlternateForm, detectMoveTypeIcon } from "./formResolve.mjs";
import { getLearnset, getAbilities, getSpeciesCandidates } from "./movesetMatch.mjs";
import { getLegalItems, filterLegalItems } from "./championsItems.mjs";
import { getMoveType } from "./moveTypes.mjs";

const SCALE = 3;
const OVERLAP = 0.03;
const STAT_KEYS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];
const TOTAL_EV_BUDGET = 66;

function makeCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function fullPageImageData(img) {
  const canvas = makeCanvas(img.naturalWidth ?? img.width, img.naturalHeight ?? img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawFullCard(img, box) {
  const canvas = makeCanvas(box.width * SCALE, box.height * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width * SCALE, box.height * SCALE);
  return canvas;
}

// Runs OCR on left/right halves separately (with a small overlap margin)
// so the text detector can't fuse a token spanning both stat columns -
// see cardDetect/parseStats notes for why. Returns tokens in full-card
// (scale=3) pixel space.
async function ocrCardHalves(img, box, lang) {
  const tokens = [];
  for (const [x0frac, x1frac] of [[0, 0.5 + OVERLAP], [0.5 - OVERLAP, 1]]) {
    const cropX = box.width * x0frac;
    const cropW = box.width * (x1frac - x0frac);
    const canvas = makeCanvas(cropW * SCALE, box.height * SCALE);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, box.x + cropX, box.y, cropW, box.height, 0, 0, cropW * SCALE, box.height * SCALE);
    const cropTokens = await runOcr(canvas, lang);
    for (const t of cropTokens) { t.x0 += cropX * SCALE; t.x1 += cropX * SCALE; t.cx += cropX * SCALE; }
    tokens.push(...cropTokens);
  }
  return tokens;
}

// idToNameByLang: {name, item, ability, move} -> {lang -> idToName},
// e.g. idToNameByLang.name.en === the global `pokesEn` object once loaded.
// pokedex: the global `pokedex` object (Showdown-style base stats).
// onProgress(step, index): optional, called as each of the 6 Pokemon is
// being read (index 0-5) so the page can show status.
export async function processImages(imgMoves, imgStats, { idToNameByLang, pokedex, lang = "en", onProgress }) {
  const movesBoxes = getCardBoundingBoxes(fullPageImageData(imgMoves));
  const statsBoxes = getCardBoundingBoxes(fullPageImageData(imgStats));
  if (movesBoxes.length !== 6 || statsBoxes.length !== 6) {
    throw new Error(
      `Slicing mismatch. Found ${movesBoxes.length} move cards and ${statsBoxes.length} stat cards (expected 6 each).`
    );
  }

  const monData = [];
  const uncertain = [];
  for (let i = 0; i < 6; i++) {
    onProgress?.("read", i);
    const moveBox = movesBoxes[i];
    const statBox = statsBoxes[i];

    const moveTokens = await ocrCardHalves(imgMoves, moveBox, lang);
    const { name: baseName, ability: parsedAbility, item: parsedItem, moves, uncertain: moveUncertain } =
      await parseMovesCard(moveTokens, moveBox.width * SCALE, idToNameByLang, lang);
    // Mutable, unlike the other destructured fields above - the "exactly
    // one legal candidate left" auto-accept below (see the uncertain-field
    // loop) needs to overwrite these in place rather than only affect
    // what's shown in the review screen.
    let ability = parsedAbility;
    let item = parsedItem;

    // Only needed for detectMoveTypeIcon below, but drawn unconditionally
    // (cheap - a canvas draw, no OCR/network involved) rather than only
    // when a move actually turns out uncertain, same as statCanvas.
    const moveCanvas = drawFullCard(imgMoves, moveBox);
    const moveImageData = moveCanvas.getContext("2d").getImageData(0, 0, moveCanvas.width, moveCanvas.height);

    const statCanvas = drawFullCard(imgStats, statBox);
    const statImageData = statCanvas.getContext("2d").getImageData(0, 0, statCanvas.width, statCanvas.height);
    const statTokens = await ocrCardHalves(imgStats, statBox, lang);
    const { statRows, gaps } = parseStatsCard(statTokens, statBox.width * SCALE);
    const { nature, uncertain: natureUncertain, candidates: natureCandidates } =
      detectNatureConfidence(statImageData, gaps, statBox.height * SCALE);

    // Regional variants (Alolan/Galarian/Hisuian/Paldean) and gender-
    // stat variants (Basculegion/Indeedee/...) never show up in the
    // on-screen name text itself - only in the small icon badges next to
    // it (type icons for regional forms, the gender icon otherwise) - so
    // this reads pixels instead of more OCR. Harmless no-op for every
    // other species (resolveAlternateForm returns baseName unchanged).
    //
    // The name token has to be picked carefully here: the sprite artwork
    // to its left is sometimes misread as a short, plausible-looking
    // word too (e.g. "SNB" for Basculegion's fish sprite, positioned even
    // further left than the real name), so a confidence floor is added
    // on top of the usual height filter - a real species name has read
    // at ~1.00 confidence in every sample seen so far, while sprite
    // noise consistently reads markedly lower.
    const headerTokens = statTokens
      .filter((t) => t.cy < statImageData.height * 0.25 && t.confidence >= 0.9)
      .sort((a, b) => a.x0 - b.x0);
    const icons = detectHeaderIcons(statImageData, headerTokens[0]);
    const name = resolveAlternateForm(baseName, icons, pokedex);

    // Only known once the species itself is resolved (just above), which
    // parseMovesCard - working from a single card's OCR text alone - can't
    // do on its own; used below to keep the "move"/"ability" review picker
    // from ever offering an option this species can't actually have (a
    // plain OCR-text fuzzy match has no notion of which species it's even
    // reading for, so it matches against every move/ability in the game).
    const legalMoves = await getLearnset(name);
    const legalAbilities = await getAbilities(name);

    for (const u of moveUncertain) {
      if (u.field === "name") {
        // Sanity-checked the same way move/ability candidates are below -
        // every species genuinely consistent with this card's own ability
        // and moves (not just a top-k ranked guess), narrowing the
        // candidate buttons and backing the manual-entry dropdown. ability/
        // moves here are this loop's own local variables, so they already
        // reflect any auto-accept resolution the move/ability branch below
        // made earlier in this same pass - movesCard.mjs always pushes
        // ability/move entries ahead of the name entry, so those are
        // guaranteed to already have run. Unlike move/ability, this never
        // auto-accepts even when narrowed to a single species - a "name"
        // resolution also carries a regional/gender-form suffix (handled
        // below, from icon pixels this check has no way to redo), so
        // that's left for the reviewer to confirm rather than guessed at.
        const legalSpecies = await getSpeciesCandidates(ability, moves);
        const filteredSpecies = legalSpecies ? u.candidates.filter((c) => legalSpecies.includes(c.name)) : u.candidates;
        // The "name" field's own value/candidates are computed inside
        // parseMovesCard, before this card's regional-form/gender-variant
        // suffix (just resolved above from icon pixels read off the
        // *stats* card - parseMovesCard never sees those pixels) is known.
        // Patched to the fully-resolved name here so a reviewer who
        // accepts the review screen's default for an otherwise-uncertain
        // name field doesn't silently regress a correctly-suffixed species
        // (e.g. "Basculegion-F") back down to its suffix-less base form.
        uncertain.push({
          ...u, mon: i, value: name,
          candidates: filteredSpecies.length ? filteredSpecies : u.candidates,
          legalSpecies: legalSpecies ?? [],
        });
        continue;
      }

      if (u.field === "item") {
        // Champions-legal items (see championsItems.mjs) are a curated,
        // much narrower list than the bundled item database the initial
        // OCR fuzzy-match ran against - that database is a generic, every-
        // generation Pokemon items list, most of which Champions doesn't
        // actually support holding at all.
        const legalItems = await getLegalItems();
        const legalCandidateNames = await filterLegalItems(u.candidates.map((c) => c.name));
        const filtered = u.candidates.filter((c) => legalCandidateNames.includes(c.name));
        if (filtered.length === 1) {
          item = filtered[0].name;
          continue;
        }
        uncertain.push({ ...u, mon: i, candidates: filtered.length ? filtered : u.candidates, legalItems });
        continue;
      }

      // "move" and "ability" both get the same treatment: narrow the
      // fuzzy-match candidate list down to what this species can actually
      // have, falling back to the original (unfiltered) list rather than
      // an empty one if nothing survives - a species missing from the
      // learnset/abilities data entirely, or a genuinely miscategorized
      // card, should still show its original guesses rather than nothing.
      // And if that narrowing leaves exactly one legal candidate, there's
      // nothing left to actually ask a reviewer to choose between - the
      // OCR text was merely fuzzy, not ambiguous, once cross-checked
      // against what the species can legally have - so this resolves it
      // immediately instead of adding it to the review screen.
      let legalOptions = null, mutateField = null;
      if (u.field === "move") { legalOptions = legalMoves; mutateField = (v) => { moves[u.index] = v; }; }
      else if (u.field === "ability") { legalOptions = legalAbilities; mutateField = (v) => { ability = v; }; }

      if (mutateField) {
        let filtered = legalOptions ? u.candidates.filter((c) => legalOptions.includes(c.name)) : u.candidates;
        let narrowedByType = false;

        // A second, independent cross-check for "move" specifically: the
        // small type icon shown next to the move's own text on the card
        // (the card never shows a move's type as text anywhere else). Only
        // tried once species-legality has already left real ambiguity -
        // no point spending a pixel search on a row that's already down to
        // one candidate - and, like every other signal here, narrows/re-
        // ranks rather than dictates: detectMoveTypeIcon's classification
        // is corroborated against real screenshots but not perfectly
        // reliable on every screenshot resolution/quality (see its own
        // docstring), so a detected type that matches zero of the already-
        // legal candidates is far more likely a bad pixel read than proof
        // every candidate is wrong - falls back to the untyped list rather
        // than ever discarding a real candidate over it.
        if (u.field === "move" && filtered.length > 1) {
          const detectedType = detectMoveTypeIcon(moveImageData, u);
          if (detectedType) {
            const typeFiltered = [];
            for (const c of filtered) {
              if ((await getMoveType(c.name)) === detectedType) typeFiltered.push(c);
            }
            if (typeFiltered.length) { filtered = typeFiltered; narrowedByType = true; }
          }
        }

        if ((legalOptions || narrowedByType) && filtered.length === 1) {
          mutateField(filtered[0].name);
          continue;
        }
        uncertain.push({
          ...u, mon: i,
          candidates: filtered.length ? filtered : u.candidates,
          ...(u.field === "move" ? { legalMoves: legalOptions ?? [] } : { legalAbilities: legalOptions ?? [] }),
        });
      } else {
        uncertain.push({ ...u, mon: i });
      }
    }
    if (natureUncertain) uncertain.push({ field: "nature", mon: i, value: nature, candidates: natureCandidates });

    // Prefer EVs derived from the (reliably-read) total stats over the
    // small, failure-prone EV digit read directly off the bar - see
    // evCalc.mjs for why. Fall back to the OCR'd digit only if that
    // derivation isn't possible at all.
    const calculated = computeEvsFromTotals(pokedex[name], statRows, nature);
    let evSource;
    if (calculated) {
      evSource = calculated.evs;
      if (calculated.totalSum !== TOTAL_EV_BUDGET) {
        console.warn(
          `[EV check] ${name}'s calculated EVs sum to ${calculated.totalSum}, not the usual ` +
          `${TOTAL_EV_BUDGET} - using them anyway, but worth a look against the screenshot.`
        );
      }
    } else {
      console.warn(`[EV check] Could not verify ${name}'s EVs against its base stats - falling back to the OCR'd EV digits.`);
      evSource = Object.fromEntries(STAT_KEYS.filter((k) => k in statRows).map((k) => [k, statRows[k].ev]));
    }

    const evItems = STAT_KEYS.filter((k) => evSource[k] > 0).map((k) => `${evSource[k]} ${k}`);
    const evStr = evItems.join(" / ");

    // Same "usually add up to 66" heuristic the console warning above
    // already uses, now also surfaced in the manual-review popup (as a
    // plain re-typeable value, not ranked candidates - there's no discrete
    // set of "legal" EV spreads to offer buttons for the way there is for
    // a move or item) instead of only a console message nobody but a
    // developer would ever see. A real team can legitimately not spend the
    // full budget (confirmed for real: a level-50 Gholdengo genuinely
    // summing to 63), so this is a nudge to double-check against the
    // screenshot, not a hard validation error - accepting the default on
    // confirm leaves the OCR's own best guess untouched either way.
    const evSum = STAT_KEYS.reduce((sum, k) => sum + (evSource[k] || 0), 0);
    if (evSum !== TOTAL_EV_BUDGET) {
      uncertain.push({ field: "evStr", mon: i, value: evStr, candidates: [] });
    }

    monData.push({ name, item, ability, nature, evStr, moves });
  }

  return { monData, uncertain };
}

export function renderPokepaste(monData) {
  const blocks = monData.map((mon) => {
    const lines = [];
    lines.push(mon.item ? `${mon.name} @ ${mon.item}` : mon.name);
    if (mon.ability) lines.push(`Ability: ${mon.ability}`);
    lines.push("Level: 50");
    if (mon.evStr) lines.push(`EVs: ${mon.evStr}`);
    lines.push(`${mon.nature} Nature`);
    for (const move of mon.moves) lines.push(`- ${move}`);
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}
