// OCR wrapper around ppu-paddle-ocr (PP-OCRv6 medium), normalizing its
// output into the same shape the rest of this pipeline works with: a flat
// list of tokens with pixel-space bbox edges + center + text + confidence.
// Browser build - loaded from CDN via the importmap in client-ocr.html so
// this page needs no bundler.
import { PaddleOcrService, V6_MEDIUM_MODEL } from "ppu-paddle-ocr/web";

let servicePromise = null;

// The very first recognize() call after initialize() resolves comes back
// with noticeably fewer detected boxes than every call after it - some
// part of onnxruntime-web's setup (WASM SIMD feature probing, memory pool
// growth, kernel selection) isn't captured by the initialize() promise
// itself and only finishes during that first real inference pass. Left
// unaddressed, this silently corrupts whichever crop happens to be OCR'd
// first each page load (reliably reproduced: the first stats card in a
// run comes back with under half its real tokens, dropping every stat
// row). Running one throwaway recognize() call on a tiny synthetic image
// right after initialize() absorbs that one-time cost before any real
// screenshot crop is processed.
async function warmUp(service) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.font = "32px sans-serif";
  ctx.fillText("Warmup", 10, 40);
  await service.recognize(canvas, { flatten: true });
}

function getService() {
  if (!servicePromise) {
    const service = new PaddleOcrService({
      model: V6_MEDIUM_MODEL,
      detection: { minimumAreaThreshold: 5 },
      recognition: { strategy: "per-box" },
    });
    servicePromise = service.initialize().then(() => warmUp(service)).then(() => service);
  }
  return servicePromise;
}

// Same two-tier confidence floor as engine.py's _drop_noise_detections:
// digit-containing tokens get a lower bar (a stray character fused onto an
// otherwise-correct total number can drag its score down; the total is
// what compute_evs_from_totals needs present at all), non-digit tokens
// need to clear a stricter bar since a low-confidence word is more likely
// hallucinated noise than a real, just-degraded label.
const MIN_CONFIDENCE_DIGITS = 0.5;
const MIN_CONFIDENCE_TEXT = 0.3;

let callCount = 0;

// Two back-to-back recognize() calls on canvases of the *exact same
// pixel dimensions* silently return the first call's result again,
// ignoring the second canvas's actual content - reproduced directly:
// draw two different screenshots into two same-sized canvases and
// recognize() each in turn, and the second result is just a copy of the
// first. This bites hard here because the moves-card crop and the
// stats-card crop for the same Pokemon are the exact same pixel size
// (both screens share one card grid), so every other call in the
// pipeline would otherwise silently return stale data from the call
// before it. Padding a strictly-increasing number of blank rows onto the
// bottom of every canvas guarantees no two calls in a page's lifetime
// ever share dimensions, without touching any real pixel content
// (detected box coordinates are unaffected, since they're relative to
// the canvas's own (0,0), not to where the blank padding gets added).
function withUniqueDimensions(canvas) {
  callCount += 1;
  const padded = document.createElement("canvas");
  padded.width = canvas.width;
  padded.height = canvas.height + callCount;
  padded.getContext("2d").drawImage(canvas, 0, 0);
  return padded;
}

export async function runOcr(canvas) {
  const service = await getService();
  const result = await service.recognize(withUniqueDimensions(canvas), { flatten: true });

  const tokens = [];
  for (const r of result.results) {
    const text = r.text.trim();
    if (!text) continue;
    // Drop tokens with no actual letters/digits at all (e.g. a bare "_"
    // or "-") - these are usually a mis-detection of the stat bar's
    // graphic, sometimes at deceptively high confidence, and carry no
    // information for row-grouping or number extraction anyway.
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    const threshold = /\d/.test(text) ? MIN_CONFIDENCE_DIGITS : MIN_CONFIDENCE_TEXT;
    if (r.confidence < threshold) continue;
    const { x, y, width, height } = r.box;
    tokens.push({
      text,
      confidence: r.confidence,
      x0: x,
      y0: y,
      x1: x + width,
      y1: y + height,
      cx: x + width / 2,
      cy: y + height / 2,
      h: height,
    });
  }
  return tokens;
}

export async function destroyOcr() {
  if (servicePromise) {
    const service = await servicePromise;
    await service.destroy();
    servicePromise = null;
  }
}
