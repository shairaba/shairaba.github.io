// Full client-side pipeline: two already-loaded images (moves screen,
// stats screen) in -> a Showdown-style pokepaste string out. Orchestrates
// every piece ported so far, mirroring engine.py's PokePasteEngine.process_images
// + render_pokepaste.
import { getCardBoundingBoxes } from "./cardDetect.mjs";
import { runOcr } from "./ocr.mjs";
import { parseStatsCard } from "./parseStats.mjs";
import { detectNature } from "./natureDetect.mjs";
import { computeEvsFromTotals } from "./evCalc.mjs";
import { parseMovesCard } from "./movesCard.mjs";

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
async function ocrCardHalves(img, box) {
  const tokens = [];
  for (const [x0frac, x1frac] of [[0, 0.5 + OVERLAP], [0.5 - OVERLAP, 1]]) {
    const cropX = box.width * x0frac;
    const cropW = box.width * (x1frac - x0frac);
    const canvas = makeCanvas(cropW * SCALE, box.height * SCALE);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, box.x + cropX, box.y, cropW, box.height, 0, 0, cropW * SCALE, box.height * SCALE);
    const cropTokens = await runOcr(canvas);
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
  for (let i = 0; i < 6; i++) {
    onProgress?.("read", i);
    const moveBox = movesBoxes[i];
    const statBox = statsBoxes[i];

    const moveTokens = await ocrCardHalves(imgMoves, moveBox);
    const { name, ability, item, moves } = parseMovesCard(moveTokens, moveBox.width * SCALE, idToNameByLang, lang);

    const statCanvas = drawFullCard(imgStats, statBox);
    const statImageData = statCanvas.getContext("2d").getImageData(0, 0, statCanvas.width, statCanvas.height);
    const statTokens = await ocrCardHalves(imgStats, statBox);
    const { statRows, gaps } = parseStatsCard(statTokens, statBox.width * SCALE);
    const nature = detectNature(statImageData, gaps, statBox.height * SCALE);

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

    monData.push({ name, item, ability, nature, evStr: evItems.join(" / "), moves });
  }

  return monData;
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
