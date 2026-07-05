// JS port of engine.py's get_card_bounding_boxes / _resolve_merged_cards.
import { hsvMask, morphClose, connectedComponents } from "./cvutils.mjs";

function resolveMergedCards(rawBoxes) {
  if (!rawBoxes.length) return [];
  const singles = rawBoxes.filter((b) => b.width / b.height >= 3.0);
  const pool = singles.length ? singles : rawBoxes;
  const heights = pool.map((b) => b.height).sort((a, b) => a - b);
  const unitH = heights[Math.floor(heights.length / 2)];

  const resolved = [];
  for (const b of rawBoxes) {
    const ratio = b.height / unitH;
    if (ratio > 1.6) {
      const n = Math.max(2, Math.round(ratio));
      const pieceH = Math.floor(b.height / n);
      for (let i = 0; i < n; i++) {
        resolved.push({ x: b.x, y: b.y + i * pieceH, width: b.width, height: pieceH });
      }
    } else {
      resolved.push(b);
    }
  }
  return resolved.filter((b) => b.height >= 0.6 * unitH && b.height <= 1.4 * unitH);
}

export function getCardBoundingBoxes(imageData) {
  const { width: imgWidth, height: imgHeight } = imageData;
  const totalArea = imgWidth * imgHeight;

  const masked = hsvMask(imageData, [95, 15, 30], [150, 255, 240]);
  const closed = morphClose(masked, 5);
  const blobs = connectedComponents(closed);

  const rawBoxes = [];
  for (const b of blobs) {
    const area = b.width * b.height;
    const aspect = b.width / b.height;
    if (area > 0.015 * totalArea && area < 0.35 * totalArea && aspect > 1.3 && aspect < 4.6) {
      rawBoxes.push(b);
    }
  }

  let validCards = resolveMergedCards(rawBoxes);

  if (validCards.length !== 6) {
    validCards = [];
    const xPcts = [0.17, 0.508];
    const yPcts = [0.213, 0.425, 0.638];
    const cardW = Math.floor(imgWidth * 0.312);
    const cardH = Math.floor(imgHeight * 0.194);
    for (const yPct of yPcts) {
      for (const xPct of xPcts) {
        validCards.push({ x: Math.floor(imgWidth * xPct), y: Math.floor(imgHeight * yPct), width: cardW, height: cardH });
      }
    }
    return validCards;
  }

  const rowThreshold = Math.floor(imgHeight * 0.1);
  validCards.sort((a, b) => {
    const rowA = Math.floor(a.y / rowThreshold), rowB = Math.floor(b.y / rowThreshold);
    return rowA !== rowB ? rowA - rowB : a.x - b.x;
  });
  return validCards;
}
