// JS port of engine.py's group_detections_into_lines, split_left_right,
// _group_rows_with_tokens, _extract_row_info, and parse_stats_card.
// OCR tokens here use the normalized shape from ocr.mjs's runOcr():
// {text, confidence, x0, y0, x1, y1, cx, cy, h}.
import { isCjk } from "./translate.mjs";

export function groupDetectionsIntoLines(tokens, yTolerance = 12) {
  if (!tokens.length) return [];
  const sorted = [...tokens].sort((a, b) => a.cy - b.cy);
  const lines = [];
  for (const tok of sorted) {
    let placed = false;
    for (const line of lines) {
      const lineCy = line.reduce((s, t) => s + t.cy, 0) / line.length;
      const tolerance = Math.max(yTolerance, tok.h * 0.6);
      if (Math.abs(tok.cy - lineCy) < tolerance) {
        line.push(tok);
        placed = true;
        break;
      }
    }
    if (!placed) lines.push([tok]);
  }
  const merged = lines.map((line) => {
    const lineSorted = [...line].sort((a, b) => a.cx - b.cx);
    const text = lineSorted.map((t) => t.text).join(" ");
    // cy/x0/h all anchored on the line's own *widest* token, not an
    // average/leftmost across every token merged into it - a stray single-
    // glyph misread (a move/type icon read as a lone character) can land
    // in the same line as the real text - confirmed for real: a Japanese
    // move row merged with a stray "四" positioned to its left and a
    // couple pixels off the real text's own cy, at confidence 0.67 (high
    // enough to survive isStrayLoneGlyph's <0.5 filter, unlike the
    // contamination case that filter was originally built for). Averaging
    // cy across both tokens, or anchoring x0/h on whichever happens to sit
    // leftmost, pulls the line's reported position measurably off the real
    // text's own - enough, in practice, to send movesCard.mjs's move-type
    // icon search (see formResolve.mjs's detectMoveTypeIcon) off target
    // and land on a neighboring, wrongly-colored patch of card instead.
    // The fuzzy text match is unaffected by this same contamination (a
    // short stray prefix barely dents a whole-string fuzzy ratio), so this
    // bug was invisible in the resolved move name, only in geometry
    // nothing else here reads. The real text token is virtually always far
    // wider than a single stray glyph, so anchoring everything on it
    // instead is robust to this without needing to identify the glyph as
    // noise at all.
    const widest = lineSorted.reduce((a, t) => (t.x1 - t.x0 > a.x1 - a.x0 ? t : a));
    return { cy: widest.cy, text, x0: widest.x0, h: widest.h };
  });
  return merged.sort((a, b) => a.cy - b.cy);
}

export function splitLeftRight(tokens, width, thresholdFrac = 0.48) {
  const left = [], right = [];
  for (const tok of tokens) {
    if (!tok.text.trim()) continue;
    (tok.cx < width * thresholdFrac ? left : right).push(tok);
  }
  return [left, right];
}

function groupRowsWithTokens(tokens, yTolerance = 12) {
  if (!tokens.length) return [];
  const sorted = [...tokens].sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const tok of sorted) {
    let placed = false;
    for (const row of rows) {
      const rowCy = row.reduce((s, t) => s + t.cy, 0) / row.length;
      const tol = Math.max(yTolerance, tok.h * 0.6);
      if (Math.abs(tok.cy - rowCy) < tol) {
        row.push(tok);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([tok]);
  }
  for (const row of rows) row.sort((a, b) => a.cx - b.cx);
  return rows.sort((a, b) => {
    const cyA = a.reduce((s, t) => s + t.cy, 0) / a.length;
    const cyB = b.reduce((s, t) => s + t.cy, 0) / b.length;
    return cyA - cyB;
  });
}

// Left column is always HP/Attack/Defense top-to-bottom; right column is
// always Sp.Atk/Sp.Def/Speed top-to-bottom, regardless of language - this
// is the game's fixed layout, not something read off the screen.
const LEFT_STAT_ORDER = ["HP", "Atk", "Def"];
const RIGHT_STAT_ORDER = ["SpA", "SpD", "Spe"];

// A level-50 stat total (this game's fixed level) never legitimately falls
// outside this range even at the extremes (base stat 1 with a lowering
// nature and 0 EVs on the low end; base stat 255 with a boosting nature
// and every EV point on the high end) - used below to pick which digit
// boundary is the real total/EV split.
const MIN_PLAUSIBLE_TOTAL = 10;
const MAX_PLAUSIBLE_TOTAL = 450;

// PP-OCRv6 frequently reads a stat's total and EV as one fused digit
// string with no separator (e.g. "720" for total=72/ev=0, or "1061" for
// total=106/ev=1) - it silently drops the thin progress-bar graphic that
// sits between them on-screen instead of reporting it as a gap. Since a
// real total is always <=3 digits and falls in the range above, the
// longest plausible prefix is usually the total (matching how it was
// rendered) and the remainder the EV - but for a low-base-stat Pokemon a
// *short* real total fused with its EV can itself look like a longer,
// still-plausible total (e.g. Torkoal's Speed total 40 fused with ev 0
// reads as "400", which is coincidentally also in-range as a 3-digit
// total on its own). Digit-string shape alone can't always tell these
// apart, so every plausible split is returned, longest-total-first as
// the primary guess; evCalc.mjs falls back to the shorter ones if the
// primary guess turns out to have no valid EV for this species' actual
// base stat.
function splitFusedDigits(digits) {
  const candidates = [];
  for (let totalLen = Math.min(digits.length, 3); totalLen >= 1; totalLen--) {
    const total = parseInt(digits.slice(0, totalLen), 10);
    if (total < MIN_PLAUSIBLE_TOTAL || total > MAX_PLAUSIBLE_TOTAL) continue;
    const evStr = digits.slice(totalLen);
    candidates.push({ total, ev: evStr ? parseInt(evStr, 10) : 0, confirmed: evStr.length > 0 });
  }
  if (!candidates.length) candidates.push({ total: parseInt(digits, 10), ev: 0, confirmed: false });
  return candidates;
}

function extractRowInfo(rowTokens) {
  // The stat-type icon at the row's far left is sometimes misread as
  // stray single/double-character noise that happens to contain digits
  // (e.g. "4", "17") - always positioned well before the real label, so
  // anchoring on the label's own right edge (the rightmost token that
  // contains a letter) and discarding any "numeric" token that sits to
  // its left filters that noise out without needing to recognize it by
  // content.
  const wordyTokens = rowTokens.filter((t) => /\p{L}/u.test(t.text));
  const numericTokens = rowTokens.filter((t) => /\d/.test(t.text));
  if (!numericTokens.length) return null;

  let realNumeric = numericTokens;
  let labelEndX = null;
  // A label can itself have digits fused into its own OCR box alongside a
  // separate trailing token for the rest (observed for real: Kingambit's
  // Attack row came back as "こうげき205" + a separate "32", rather than
  // one "20532" run or a clean "label" + "number" pair) - the real total
  // was 205, fused across both. The x0>=labelEndX filter below correctly
  // keeps the label-bearing token out of realNumeric (its own x0 is always
  // < its own x1/labelEndX), but discarding it outright loses that leading
  // digit fragment - "32" alone then reads as the whole total instead of
  // "205"+"32" recombined as they were on-screen. Recovered here so it can
  // be stitched back onto whatever's left in realNumeric below.
  let labelDigitSuffix = "";
  if (wordyTokens.length) {
    labelEndX = Math.max(...wordyTokens.map((t) => t.x1));
    const labelToken = wordyTokens.find((t) => t.x1 === labelEndX);
    const digitMatch = labelToken?.text.match(/(\d+)$/);
    if (digitMatch) labelDigitSuffix = digitMatch[1];
    const filtered = numericTokens.filter((t) => t.x0 >= labelEndX);
    if (filtered.length) realNumeric = filtered;
  }

  const cy = rowTokens[0].cy;
  const totalTok = realNumeric[0];
  let total, ev, confirmed, alt = [];

  if (labelDigitSuffix && realNumeric.length === 1) {
    // The label token's own trailing digits plus whatever single token
    // survived the labelEndX filter are two fragments of one fused run,
    // not an independent total+EV pair - reassemble and split them the
    // same way a single all-in-one fused token would be.
    const combined = labelDigitSuffix + totalTok.text.match(/\d+/)[0];
    const candidates = splitFusedDigits(combined);
    ({ total, ev, confirmed } = candidates[0]);
    alt = candidates.slice(1);
  } else if (realNumeric.length >= 2) {
    // Two distinct tokens - the game's layout always renders total before
    // EV left-to-right, so no fused-digit ambiguity to resolve... in the
    // common case. But when detection itself fragments the row oddly, the
    // "total" token can end up being unrelated noise rather than a real
    // total at all (observed for real: a Speed row came back as two
    // tokens, "7" and "18432" - the second one is *already* a clean
    // "184"+"32" fused total+EV run on its own, and "7" is noise with
    // nothing to do with it; blindly trusting both tokens at face value
    // read this as total=7/ev=18432, nowhere near a real level-50 stat).
    // A total outside the plausible range is the tell that totalTok isn't
    // trustworthy - when that happens, the second token is tried alone
    // first (splitFusedDigits handles it exactly like the single-fused-
    // token case below would), with the two tokens' digits concatenated
    // together offered only as a lower-priority alternative, in case they
    // really were meant to be read as one number split across two boxes.
    const naiveTotal = parseInt(totalTok.text.match(/\d+/)[0], 10);
    if (naiveTotal >= MIN_PLAUSIBLE_TOTAL && naiveTotal <= MAX_PLAUSIBLE_TOTAL) {
      total = naiveTotal;
      ev = parseInt(realNumeric[1].text.match(/\d+/)[0], 10);
      confirmed = true;
    } else {
      const secondDigits = realNumeric[1].text.match(/\d+/)[0];
      const combined = totalTok.text.match(/\d+/)[0] + secondDigits;
      const candidates = [...splitFusedDigits(secondDigits), ...splitFusedDigits(combined)];
      ({ total, ev, confirmed } = candidates[0]);
      alt = candidates.slice(1);
    }
  } else {
    // A single token: it may already contain a separator (e.g. an em-dash
    // in "71—1"), in which case each digit-run is unambiguous, or it may
    // be a genuinely fused run needing the plausible-range split above.
    const runs = [...totalTok.text.matchAll(/\d+/g)].map((m) => m[0]);
    if (runs.length >= 2 && parseInt(runs[0], 10) >= MIN_PLAUSIBLE_TOTAL && parseInt(runs[0], 10) <= MAX_PLAUSIBLE_TOTAL) {
      total = parseInt(runs[0], 10);
      ev = parseInt(runs[1], 10);
      confirmed = true;
    } else {
      const candidates = splitFusedDigits(runs.join(""));
      ({ total, ev, confirmed } = candidates[0]);
      alt = candidates.slice(1);
    }
  }

  // The real label - if not fused into totalTok itself - is whichever
  // wordy token in the row ends closest to totalTok's start: an icon-
  // outline misread (e.g. a lone "C") sits far to the left near the row's
  // stat icon, while the genuine label always sits immediately adjacent
  // to the number. Picking by "closest x1" instead of "any wordy token
  // whose x1 doesn't overlap totalTok" is what makes this robust at low
  // screenshot resolutions, where OCR's own box edges get imprecise
  // enough for a real label to end up measured a few dozen pixels *past*
  // where the number box starts (seen e.g. with "Sp. Def" measured
  // ending 43px into "13210"'s box on a low-res crop) - a fixed overlap
  // tolerance would have to be uncomfortably large to cover that, and
  // could then risk admitting real icon noise elsewhere instead.
  //
  // Candidates are restricted to tokens that look like an actual word -
  // no digits at all, and at least 3 letters - rather than just "any
  // token with a letter in it". That excludes totalTok itself even when
  // it happens to carry a single stray misread letter (e.g. "154—25I",
  // where the trailing "I" is noise, not a fused label - naively
  // treating totalTok-has-a-letter as "label fused into the number"
  // wrongly discarded the real, separate "Attack" label token in that
  // exact row). It also still excludes lone icon-outline noise like "C"
  // (a letter, but only one). Only when nothing passes this bar - a
  // genuinely fused "Sp. Def 165 — 20" style token, which is mostly
  // digits - does gapLabelTokens end up empty, correctly routing to
  // parseStatsCard's borrow-from-another-row fallback instead.
  //
  // The >=3 floor is a Latin-script assumption that doesn't hold for CJK
  // labels - Chinese stat labels ("攻击"/"防御"/"特攻"/"特防"/"速度") are
  // genuinely only 2 characters each, and a fixed >=3 count silently
  // excluded every single one, leaving every row on a real Chinese
  // screenshot "unreliable" and empty-gapped - which (since HP is the only
  // row detectNature can afford to skip) broke nature detection completely
  // for that language, not just at the margins. CJK text doesn't need the
  // same length floor: a stray icon-outline misread has never once come
  // back as coherent multi-character CJK text anywhere in this pipeline's
  // testing (icon noise reads as stray Latin letters, or - separately, in
  // the moves-card noise this same distinction protects against - as a
  // single low-confidence CJK glyph, which >=2 still excludes), so >=2 CJK
  // characters is a safe, much lower floor than Latin needs.
  const labelCandidates = wordyTokens.filter((t) => {
    if (/\d/.test(t.text)) return false;
    const letterCount = (t.text.match(/\p{L}/gu) ?? []).length;
    return isCjk(t.text) ? letterCount >= 2 : letterCount >= 3;
  });
  const gapLabelTokens = labelCandidates.length
    ? [labelCandidates.reduce((closest, t) => (t.x1 > closest.x1 ? t : closest))]
    : [];

  if (gapLabelTokens.length) {
    // A real, separate label token - its measured edges give a
    // trustworthy label width and label-to-number gap directly.
    const labelStartX = Math.min(...gapLabelTokens.map((t) => t.x0));
    const labelEnd = Math.max(...gapLabelTokens.map((t) => t.x1));
    return {
      total, ev, confirmed, cy, alt,
      reliable: true,
      // Kept only so parseStatsCard can flag a row whose label and
      // number boxes overlap (negative) as unfit to *lend* its geometry
      // to another row, even though its own total/EV read fine - see
      // there for why.
      gapExtra: totalTok.x0 - labelEnd,
      gap: [labelEnd - 0.35 * (labelEnd - labelStartX), totalTok.x0],
    };
  }

  // A fused label+number token (e.g. "Sp. Atk 900" or "Speed18432"): the
  // token's own x0 is still the true label start, but interpolating the
  // split point by character count is unreliable - digits and (for CJK
  // screenshots) label characters both tend to render wider than a
  // uniform per-character estimate assumes, in whichever direction pulls
  // the true split away from the estimate, and the chevron icon between
  // label and number isn't a character at all, so it's invisible to any
  // count-based estimate regardless. parseStatsCard borrows the *number
  // column's position* from another, reliable row in the same column
  // when one exists (see there for why that's a more robust anchor than
  // reconstructing this row's own label width); the crude interpolation
  // below is only a last resort for when every row in the column fused
  // (seen in practice on some Japanese screenshots, where every stat row
  // fuses this way and there's no reliable row anywhere in the column to
  // borrow from instead). The window is widened on both sides of the
  // estimated split rather than trusting it precisely, since it's been
  // observed landing up to ~10% of the box width off in either direction.
  const digitMatch = totalTok.text.match(/\d/);
  let gap = null;
  if (digitMatch && digitMatch.index > 0) {
    const boxWidth = totalTok.x1 - totalTok.x0;
    const splitX = totalTok.x0 + (digitMatch.index / totalTok.text.length) * boxWidth;
    gap = [splitX - boxWidth * 0.15, splitX + boxWidth * 0.12];
  }
  return { total, ev, confirmed, cy, alt, reliable: false, gap };
}

// The stat card's real text (species name, labels, totals, EVs) is all
// rendered at one consistent large size; every noise token seen so far
// (icon-outline misreads, the boost/lower chevron glyph misread as a
// stray character) comes in well under half that size. Dropping anything
// that small before row-grouping removes the noise at its source, rather
// than trying to filter it back out per-row after it's already merged
// into a row or formed a bogus row of its own (which corrupts the
// positional HP/Atk/Def or SpA/SpD/Spe index assignment).
// ratio: how far below the reference "real text" height a token can be
// before it's treated as noise. The stats card's labels/totals/EVs all
// render at one consistent size, so a fairly tight 0.6 safely separates
// them from icon-outline/chevron misread noise there. The moves card has
// more legitimate size variance of its own (a long ability name like
// "Good as Gold" can render noticeably smaller than the species name
// above it via auto-shrink-to-fit) while its noise stays tiny (well under
// half that), so movesCard.mjs calls this with a looser ratio instead of
// this default.
export function dropTinyText(tokens, ratio = 0.6) {
  if (!tokens.length) return tokens;
  // The tallest token in a column is usually a stat label/total, but the
  // species name header (also in this column) sometimes renders taller
  // still (e.g. capital letters with descenders) - if the single tallest
  // token is way out ahead of the next-tallest, it's that header, not a
  // representative "real text" size, so fall back to the runner-up
  // instead of letting it drag the whole threshold up and wrongly filter
  // out genuine stat rows.
  const heights = [...new Set(tokens.map((t) => t.h))].sort((a, b) => b - a);
  const referenceH = heights.length > 1 && heights[0] > heights[1] * 1.2 ? heights[1] : heights[0];
  return tokens.filter((t) => t.h >= referenceH * ratio);
}

// Returns { statRows: {key: {total, ev, cy, confirmed}}, gaps: {key: [x0, x1, cy]} }
export function parseStatsCard(tokens, cardWidth) {
  const [leftRaw, rightRaw] = splitLeftRight(tokens, cardWidth, 0.48);
  let leftRows = groupRowsWithTokens(dropTinyText(leftRaw));
  let rightRows = groupRowsWithTokens(dropTinyText(rightRaw));

  // The species name (and any stray icon text) sometimes lands in these
  // groups as an extra leading row - the 3 real stat rows are always the
  // bottommost ones.
  if (leftRows.length > 3) leftRows = leftRows.slice(-3);
  if (rightRows.length > 3) rightRows = rightRows.slice(-3);

  const statRows = {};
  const gaps = {};

  for (const [order, rows] of [[LEFT_STAT_ORDER, leftRows], [RIGHT_STAT_ORDER, rightRows]]) {
    const column = {};
    for (let i = 0; i < Math.min(order.length, rows.length); i++) {
      const key = order[i];
      const info = extractRowInfo(rows[i]);
      if (!info) continue;
      statRows[key] = { total: info.total, ev: info.ev, cy: info.cy, confirmed: info.confirmed, alt: info.alt };
      column[key] = info;
    }

    // A fused row can't reconstruct where its own label ends and its
    // number column begins, but the *number column's pixel position*
    // turns out to be near-constant across rows in the same column
    // regardless of label length or language - the game right-aligns
    // (or otherwise fixes) that column, so "Sp. Atk"'s total and
    // "Speed"'s total start at close to the same x even though the
    // labels are very different lengths. Borrowing that absolute
    // position (and the typical gap width leading into it) from any
    // reliable row in the column is far more robust than trying to
    // rebuild the fused row's own label width first and derive the
    // number position from *that* - reconstructing the label was tried
    // and kept landing tens of pixels off in one direction or another
    // depending on how the borrowed label's length/abbreviation style
    // compared to the fused one's.
    //
    // HP is excluded as a source to borrow from: real games never
    // translate "HP" even on a fully localized screenshot, so its own
    // number column can sit at a different x than the other, actually-
    // localized labels' columns.
    //
    // A row can measure as "reliable" (a real, separate label token was
    // found) yet still have its box overlap the number's box at low
    // resolutions (see the "closest x1" note above) - fine for reading
    // that row's own total/EV, but it leaves gapExtra negative (there's
    // supposed to be real empty space plus a chevron icon between label
    // and number, never overlap), which is a red flag its geometry
    // shouldn't be trusted to describe *other* rows' layout either.
    const reliableRows = Object.entries(column)
      .filter(([key, c]) => key !== "HP" && c.reliable && c.gapExtra >= 0)
      .map(([, c]) => c);
    const median = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    };
    const refNumberStartX = median(reliableRows.map((c) => c.gap[1]));
    const refGapWidth = median(reliableRows.map((c) => c.gap[1] - c.gap[0]));

    for (const [key, c] of Object.entries(column)) {
      if (c.reliable) {
        gaps[key] = [c.gap[0], c.gap[1], c.cy];
      } else if (refNumberStartX !== null && refGapWidth !== null) {
        gaps[key] = [refNumberStartX - refGapWidth, refNumberStartX, c.cy];
      } else if (c.gap !== null) {
        gaps[key] = [c.gap[0], c.gap[1], c.cy];
      }
    }
  }

  return { statRows, gaps };
}
