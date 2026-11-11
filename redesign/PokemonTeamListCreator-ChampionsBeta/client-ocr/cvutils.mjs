// Minimal, dependency-free CV utilities operating on ImageData - a JS port
// of just the OpenCV operations engine.py's get_card_bounding_boxes and
// nature-chevron detection actually use (HSV threshold mask, morphological
// close, connected components -> bounding boxes). Avoids a second WASM
// dependency beyond what the OCR library already needs internally.

// Matches OpenCV's HSV convention: H 0-179, S 0-255, V 0-255 (not the
// H 0-360 / S,V 0-100 convention used elsewhere) so our already-tuned
// Python threshold values can be reused as-is.
export function rgbToHsv(r, g, b) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rf) h = 60 * (((gf - bf) / delta) % 6);
    else if (max === gf) h = 60 * ((bf - rf) / delta + 2);
    else h = 60 * ((rf - gf) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h / 2, s * 255, v * 255]; // H halved to match OpenCV's 0-179 range
}

export function hsvMask(imageData, [hLo, sLo, vLo], [hHi, sHi, vHi]) {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const [h, s, v] = rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    if (h >= hLo && h <= hHi && s >= sLo && s <= sHi && v >= vLo && v <= vHi) {
      mask[i] = 1;
    }
  }
  return { mask, width, height };
}

// Binary dilate then erode with a square kernel - same purpose as
// cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel): bridges small gaps
// within a region without growing its outer boundary.
export function morphClose(maskObj, kernelSize = 5) {
  const dilated = morph(maskObj, kernelSize, true);
  return morph(dilated, kernelSize, false);
}

function morph({ mask, width, height }, kernelSize, dilate) {
  const half = Math.floor(kernelSize / 2);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = dilate ? 0 : 1;
      for (let dy = -half; dy <= half && (dilate ? value === 0 : value === 1); dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const v = mask[ny * width + nx];
          if (dilate && v) { value = 1; break; }
          if (!dilate && !v) { value = 0; break; }
        }
        if (dilate && value === 1) break;
      }
      out[y * width + x] = value;
    }
  }
  return { mask: out, width, height };
}

// 8-connected component labeling via BFS, returning each blob's bounding
// box and pixel area - the same information cv2.findContours +
// cv2.boundingRect gives, just via flood-fill instead of contour tracing.
export function connectedComponents({ mask, width, height }) {
  const visited = new Uint8Array(width * height);
  const boxes = [];
  const stack = [];
  for (let start = 0; start < width * height; start++) {
    if (!mask[start] || visited[start]) continue;
    let minX = width, maxX = 0, minY = height, maxY = 0, area = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % width, y = Math.floor(idx / width);
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] && !visited[nIdx]) {
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        }
      }
    }
    boxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area });
  }
  return boxes;
}
