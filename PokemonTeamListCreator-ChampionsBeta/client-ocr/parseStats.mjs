// JS port of engine.py's group_detections_into_lines, split_left_right,
// _group_rows_with_tokens, _extract_row_info, and parse_stats_card.
// OCR tokens here use the normalized shape from ocr.mjs's runOcr():
// {text, confidence, x0, y0, x1, y1, cx, cy, h}.

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
    const avgCy = line.reduce((s, t) => s + t.cy, 0) / line.length;
    return { cy: avgCy, text };
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
  if (wordyTokens.length) {
    labelEndX = Math.max(...wordyTokens.map((t) => t.x1));
    const filtered = numericTokens.filter((t) => t.x0 >= labelEndX);
    if (filtered.length) realNumeric = filtered;
  }

  const cy = rowTokens[0].cy;
  const totalTok = realNumeric[0];
  let total, ev, confirmed, alt = [];

  if (realNumeric.length >= 2) {
    // Two distinct tokens - the game's layout always renders total before
    // EV left-to-right, so no fused-digit ambiguity to resolve.
    total = parseInt(totalTok.text.match(/\d+/)[0], 10);
    ev = parseInt(realNumeric[1].text.match(/\d+/)[0], 10);
    confirmed = true;
  } else {
    // A single token: it may already contain a separator (e.g. an em-dash
    // in "71—1"), in which case each digit-run is unambiguous, or it may
    // be a genuinely fused run needing the plausible-range split above.
    const runs = [...totalTok.text.matchAll(/\d+/g)].map((m) => m[0]);
    if (runs.length >= 2) {
      total = parseInt(runs[0], 10);
      ev = parseInt(runs[1], 10);
      confirmed = true;
    } else {
      const candidates = splitFusedDigits(runs[0]);
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
  const labelCandidates = wordyTokens.filter(
    (t) => !/\d/.test(t.text) && (t.text.match(/\p{L}/gu) ?? []).length >= 3
  );
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
      labelWidth: labelEnd - labelStartX,
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
  // count-based estimate regardless. parseStatsCard fills in
  // labelWidth/gapExtra from another, reliable row in the same column
  // when one exists; the crude interpolation below is only a last resort
  // for when every row in the column fused (seen in practice on some
  // Japanese screenshots, where every stat row fuses this way and there's
  // no reliable row anywhere in the column to borrow from instead). The
  // window is widened on both sides of the estimated split rather than
  // trusting it precisely, since it's been observed landing up to ~10%
  // of the box width off in either direction.
  const digitMatch = totalTok.text.match(/\d/);
  let gap = null;
  if (digitMatch && digitMatch.index > 0) {
    const boxWidth = totalTok.x1 - totalTok.x0;
    const splitX = totalTok.x0 + (digitMatch.index / totalTok.text.length) * boxWidth;
    gap = [splitX - boxWidth * 0.15, splitX + boxWidth * 0.12];
  }
  return { total, ev, confirmed, cy, alt, reliable: false, tokenX0: totalTok.x0, gap };
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
  const referenceH = heights.length > 1 && heights[0] > heights[1] * 1.4 ? heights[1] : heights[0];
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

    // Other rows in this column almost always share the same label font
    // and the same small icon-glyph gap before the number, regardless of
    // which stat they are - so a fused row can borrow those two measured
    // quantities from any reliable row instead of guessing its own split
    // point by character count. HP is excluded as a *source* to borrow
    // from: real games never translate "HP" even on a fully localized
    // screenshot, so it's always short, Latin, fixed-width text - a poor
    // stand-in for a same-column label that's actually in the
    // screenshot's own language (e.g. borrowing "HP"'s 2-character width
    // for a 4-character Japanese "こうげき" badly undershoots it, missing
    // the real gap entirely).
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
    const refLabelWidth = median(reliableRows.map((c) => c.labelWidth));
    const refGapExtra = median(reliableRows.map((c) => c.gapExtra));

    for (const [key, c] of Object.entries(column)) {
      if (c.reliable) {
        gaps[key] = [c.gap[0], c.gap[1], c.cy];
      } else if (refLabelWidth !== null && refGapExtra !== null) {
        const labelEnd = c.tokenX0 + refLabelWidth;
        gaps[key] = [labelEnd - 0.35 * refLabelWidth, labelEnd + refGapExtra, c.cy];
      } else if (c.gap !== null) {
        gaps[key] = [c.gap[0], c.gap[1], c.cy];
      }
    }
  }

  return { statRows, gaps };
}
