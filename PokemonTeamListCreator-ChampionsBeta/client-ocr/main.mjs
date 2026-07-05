import { processImages, renderPokepaste } from "./pipeline.mjs";
import { loadResourceBundle, loadPokedex } from "./loadResources.mjs";

const RESOURCES_BASE = "./Resources";

const movesInput = document.getElementById("img-moves");
const statsInput = document.getElementById("img-stats");
const langSelect = document.getElementById("lang-select");
const generateBtn = document.getElementById("btn-generate");
const copyBtn = document.getElementById("copy-btn");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind ?? "";
}

function refreshGenerateButton() {
  generateBtn.disabled = !(movesInput.files[0] && statsInput.files[0]);
}
movesInput.addEventListener("change", refreshGenerateButton);
statsInput.addEventListener("change", refreshGenerateButton);

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not read ${file.name} as an image.`));
    img.src = URL.createObjectURL(file);
  });
}

generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  copyBtn.disabled = true;
  outputEl.value = "";
  const lang = langSelect.value;

  try {
    setStatus("Loading screenshots...");
    const [imgMoves, imgStats] = await Promise.all([
      loadImageFile(movesInput.files[0]),
      loadImageFile(statsInput.files[0]),
    ]);

    setStatus("Loading name/move/item/ability data...");
    const [idToNameByLang, pokedex] = await Promise.all([
      loadResourceBundle(RESOURCES_BASE, [lang]),
      loadPokedex(RESOURCES_BASE),
    ]);

    const monData = await processImages(imgMoves, imgStats, {
      idToNameByLang,
      pokedex,
      lang,
      onProgress: (_step, index) => setStatus(`Reading Pokemon ${index + 1} of 6...`),
    });

    outputEl.value = renderPokepaste(monData);
    copyBtn.disabled = false;
    setStatus("Paste code successfully generated.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    generateBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(outputEl.value);
  const original = copyBtn.textContent;
  copyBtn.textContent = "Copied!";
  setTimeout(() => { copyBtn.textContent = original; }, 1200);
});
