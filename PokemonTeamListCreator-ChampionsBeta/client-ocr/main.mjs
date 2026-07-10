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
const reviewCard = document.getElementById("review-card");
const reviewListEl = document.getElementById("review-list");
const reviewConfirmBtn = document.getElementById("review-confirm");

// One key per uncertain-field entry (see pipeline.mjs/movesCard.mjs/
// natureDetect.mjs) - "move" entries are the only ones that need `index`
// to disambiguate (a card can have up to 4 uncertain moves).
function uncertainKey(u) {
  return `${u.mon}-${u.field}-${u.index ?? ""}`;
}

// Applies each uncertain field's pipeline-computed best guess and ranked
// alternatives as a single end-of-scan review screen (rather than either
// silently trusting a low-confidence guess or interrupting mid-scan per
// field - see movesCard.mjs's FIELD_CONFIDENCE_THRESHOLD comment for why).
// Resolves to a Map of uncertainKey -> chosen value once the user confirms;
// every entry defaults to the pipeline's own best guess if left untouched.
function reviewUncertainFields(monData, uncertainList) {
  return new Promise((resolve) => {
    reviewListEl.innerHTML = "";
    const selections = new Map(uncertainList.map((u) => [uncertainKey(u), u.value]));

    for (const u of uncertainList) {
      const key = uncertainKey(u);
      const monName = monData[u.mon]?.name || `Pokemon ${u.mon + 1}`;
      const fieldLabel = u.field === "move" ? `Move ${u.index + 1}` : u.field[0].toUpperCase() + u.field.slice(1);

      const row = document.createElement("div");
      row.className = "review-item";
      const title = document.createElement("div");
      title.className = "review-item-title";
      title.textContent = `${monName} - ${fieldLabel}`;
      row.appendChild(title);

      const btnRow = document.createElement("div");
      btnRow.className = "review-choices";
      // The current best guess is always offered as a choice, even if it
      // didn't make the pipeline's own ranked candidate list (e.g. a
      // partial nature-chevron read whose default "Serious" fallback isn't
      // one of the real alternatives detectNatureConfidence computed).
      const options = [...u.candidates];
      if (u.value && !options.some((c) => c.name === u.value)) {
        options.unshift({ name: u.value, confidence: 1 });
      }

      const manualInput = document.createElement("input");
      manualInput.type = "text";
      manualInput.placeholder = "Or type it yourself...";
      manualInput.className = "review-manual-input";

      // Back the manual-entry input with a native dropdown of every
      // legality-checked option for this field - the move/ability this
      // card's species can actually have, the species consistent with its
      // own ability+moves, or the items Champions actually lets a Pokemon
      // hold - same data the ranked candidates above were already filtered
      // against in pipeline.mjs, just offered in full here since the
      // manual box is the fallback for when none of the top 5 candidates
      // were the right one.
      const legalOptions =
        u.field === "move" ? u.legalMoves :
        u.field === "ability" ? u.legalAbilities :
        u.field === "name" ? u.legalSpecies :
        u.field === "item" ? u.legalItems :
        null;
      if (legalOptions?.length) {
        const datalistId = `review-datalist-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const datalist = document.createElement("datalist");
        datalist.id = datalistId;
        for (const opt of legalOptions) {
          const optEl = document.createElement("option");
          optEl.value = opt;
          datalist.appendChild(optEl);
        }
        manualInput.setAttribute("list", datalistId);
        row.appendChild(datalist);
      }

      for (const c of options.slice(0, 5)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "review-choice-btn";
        btn.textContent = c.name;
        if (c.name === selections.get(key)) btn.classList.add("selected");
        btn.addEventListener("click", () => {
          selections.set(key, c.name);
          [...btnRow.querySelectorAll("button")].forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          manualInput.value = "";
        });
        btnRow.appendChild(btn);
      }
      row.appendChild(btnRow);

      manualInput.addEventListener("input", () => {
        if (!manualInput.value.trim()) return;
        selections.set(key, manualInput.value.trim());
        [...btnRow.querySelectorAll("button")].forEach((b) => b.classList.remove("selected"));
      });
      row.appendChild(manualInput);

      reviewListEl.appendChild(row);
    }

    reviewCard.style.display = "";
    reviewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    reviewConfirmBtn.onclick = () => {
      reviewCard.style.display = "none";
      resolve(selections);
    };
  });
}

function applyReviewSelections(monData, uncertainList, selections) {
  for (const u of uncertainList) {
    const value = selections.get(uncertainKey(u));
    if (value === undefined) continue;
    if (u.field === "move") monData[u.mon].moves[u.index] = value;
    else monData[u.mon][u.field] = value;
  }
}

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
  reviewCard.style.display = "none";
  reviewListEl.innerHTML = "";
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

    const { monData, uncertain } = await processImages(imgMoves, imgStats, {
      idToNameByLang,
      pokedex,
      lang,
      onProgress: (_step, index) => setStatus(`Reading Pokemon ${index + 1} of 6...`),
    });

    if (uncertain.length) {
      setStatus(`Found ${uncertain.length} low-confidence read${uncertain.length === 1 ? "" : "s"} - please review below.`);
      const selections = await reviewUncertainFields(monData, uncertain);
      applyReviewSelections(monData, uncertain, selections);
    }

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
