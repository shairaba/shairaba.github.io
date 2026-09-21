// Submits Italian VGC Locals results straight to the Google Form's response
// Sheet, without going through the Form's own (slow, clunky-for-300+-choice-
// dropdowns) UI - a tournament organizer fills in the tournament once here,
// then one card per top-cut player, and this page fires one POST per player
// at Google Forms' own "formResponse" endpoint.
//
// This is an unofficial-but-long-stable technique: every Form has a hidden
// formResponse endpoint (same URL as the public form with "viewform" swapped
// for "formResponse") that accepts a plain POST of entry.<id>=<value> pairs,
// same as if a person had submitted the real Form. Because that endpoint
// doesn't send CORS headers, we POST with fetch's mode:"no-cors" - the
// submission still goes through, but the page can't read back a real
// success/failure status, only "the browser didn't throw." See README.md
// for how FORM_CONFIG below was filled in.

const FORM_CONFIG = {
  actionUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdI7cp-R9sU4nyow3Fl47YybUCjR4YpUVdXwrUrkXKc6anvWA/formResponse",
  // Read directly from the live Form's page source (FB_PUBLIC_LOAD_DATA_,
  // the JS blob Forms embeds with each question's config) rather than via
  // the "Get pre-filled link" trick - see tool/README.md.
  //
  // IMPORTANT: tournament_date's entry id was captured while "Tournament
  // Date" was still a native Date-type question. That type needs different
  // (multi-part) POST parameters than the single plain value this file
  // sends - change that question to Short answer (YYYY-MM-DD) in the Form
  // editor before relying on this, and double check the id below still
  // matches afterward (changing a question's type usually keeps its id, but
  // isn't guaranteed).
  entryIds: {
    tournament_id: "1052581828",
    // Same entry id the old single "Tournament Name" question used - it was
    // renamed to "Tournament City" in place in the Form editor rather than
    // deleted/recreated, which keeps a question's entry id (confirmed via
    // FB_PUBLIC_LOAD_DATA_, same as every other id here).
    tournament_city: "2018702300",
    tournament_date: "799155856",
    tournament_type: "831540127",
    number_of_players: "352098513",
    // "Tournament Venue" on the live Form - shown as "Location" on this
    // site (see labelLocation in app.js) and used as both the display
    // name's venue part and the pokemon-events-italia link (see
    // handleLocationMatch() below).
    location: "585413590",
    to_name: "1016559905",
    player_name: "1338048164",
    placement: "260798448",
    mon_1: "2084010651",
    mon_2: "1001451554",
    mon_3: "396937890",
    mon_4: "2123359031",
    mon_5: "894358365",
    mon_6: "202833891",
  },
};

const MON_FIELD_KEYS = ["mon_1", "mon_2", "mon_3", "mon_4", "mon_5", "mon_6"];

// species-list.js (generated from tool/species_reference.py) defines
// SPECIES_LIST as [{n: displayName, i: speciesId}, ...]. spriteUrl/esc come
// from app.js (included before this file).
const SPECIES_NAME_SET = new Set(SPECIES_LIST.map((s) => s.n.toLowerCase()));
const SPECIES_BY_NAME_LOWER = new Map(SPECIES_LIST.map((s) => [s.n.toLowerCase(), s]));

const SPECIES_PICKER_MAX_RESULTS = 40;

function slugify(s) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// Mirrors tool/ingest.py's derive_top_cut_size(): <9 players -> top 2,
// 9-16 -> top 4, >=17 -> top 8.
function deriveTopCutSize(numberOfPlayers) {
  if (numberOfPlayers < 9) return 2;
  if (numberOfPlayers < 17) return 4;
  return 8;
}

function setFieldError(fieldEl, message) {
  fieldEl.classList.toggle("has-error", !!message);
  const errorEl = fieldEl.querySelector(".field-error");
  if (errorEl) errorEl.textContent = message || "";
  const inputEl = fieldEl.querySelector("input, select");
  if (inputEl) inputEl.classList.toggle("invalid", !!message);
}

// ---- Step 1: tournament details ----

let tournamentInfo = null; // filled in once step 1 validates

function validateStep1() {
  let ok = true;

  const cityField = document.getElementById("f-tournament-city");
  const cityVal = cityField.querySelector("input").value.trim();
  if (!cityVal) {
    setFieldError(cityField, t("fieldRequired"));
    ok = false;
  } else {
    setFieldError(cityField, "");
  }

  const dateField = document.getElementById("f-tournament-date");
  const dateVal = dateField.querySelector("input").value;
  if (!dateVal) {
    setFieldError(dateField, t("fieldRequired"));
    ok = false;
  } else {
    setFieldError(dateField, "");
  }

  const typeField = document.getElementById("f-tournament-type");
  const typeVal = typeField.querySelector("select").value;
  if (!typeVal) {
    setFieldError(typeField, t("fieldRequired"));
    ok = false;
  } else {
    setFieldError(typeField, "");
  }

  const playersField = document.getElementById("f-number-of-players");
  const playersRaw = playersField.querySelector("input").value;
  const playersVal = parseInt(playersRaw, 10);
  if (!playersRaw || !Number.isInteger(playersVal) || playersVal <= 0) {
    setFieldError(playersField, t("fieldPositiveNumber"));
    ok = false;
  } else {
    setFieldError(playersField, "");
  }

  const locationField = document.getElementById("f-location");
  const locationVal = locationField.querySelector("input").value.trim();
  if (!locationVal) {
    setFieldError(locationField, t("fieldRequired"));
    ok = false;
  } else {
    setFieldError(locationField, "");
  }

  const toField = document.getElementById("f-to-name");
  const toVal = toField.querySelector("input").value.trim();
  if (!toVal) {
    setFieldError(toField, t("fieldRequired"));
    ok = false;
  } else {
    setFieldError(toField, "");
  }

  if (!ok) return null;

  // Just a preview for step 2's summary/step-done text - ingest.py computes
  // the actual published display name server-side (build_tournament_name()
  // in ingest.py, using the same "City - Location" shape).
  const displayName = `${cityVal} - ${locationVal}`;

  // The type suffix keeps a VG Cup and a VG Challenge at the same
  // venue/date from colliding into a single tournament_id (and so a single
  // merged page) - without it, "same slug + same date" was the only
  // uniqueness check, which two genuinely different events can easily share.
  const typeSuffix = typeVal === "VG Cup" ? "cup" : "challenge";

  return {
    tournamentId: `${slugify(displayName)}-${dateVal}-${typeSuffix}`,
    tournamentCity: cityVal,
    tournamentName: displayName,
    tournamentDate: dateVal,
    tournamentType: typeVal,
    numberOfPlayers: playersVal,
    location: locationVal,
    toName: toVal,
    topCutSize: deriveTopCutSize(playersVal),
  };
}

function playerCardHtml(index, topCutSize) {
  const monFields = MON_FIELD_KEYS.map((key, i) => {
    const label = t("pokemonLabel", i + 1);
    return `
      <div class="field species-picker" data-mon-field="${key}">
        <label>${esc(label)}</label>
        <input type="text" data-mon-input="${key}" autocomplete="off" placeholder="${esc(t("searchPlaceholderShort"))}">
        <div class="species-picker-panel" data-mon-panel="${key}"></div>
        <span class="field-error"></span>
      </div>`;
  }).join("");

  // Placement isn't a separate field - it's implied by entry order (enter
  // trainers in their actual finishing order), computed in submitAll().
  // The heading below is display-only and localized; the actual placement
  // *value* submitted to the Sheet always uses the canonical English
  // ordinal() (see submitAll) regardless of UI language, since ingest.py's
  // find_winner() matches the literal string "1st".
  return `
    <div class="player-card" data-player-index="${index}">
      <div class="player-card-head">
        <h3>${esc(t("placeLabel", index + 1))}</h3>
      </div>
      <div class="field-row">
        <div class="field" data-field="player-name">
          <label>${esc(t("playerNameLabel"))}</label>
          <input type="text" data-player-name autocomplete="off">
        </div>
      </div>
      <div class="mon-grid">${monFields}</div>
    </div>`;
}

// ---- Species picker (custom sprite dropdown) ----
//
// A plain text input + an absolutely-positioned panel of matches, each
// showing a sprite - native <select>/<datalist> can't show images per
// option, so this is a small custom combobox instead. Wired via delegated
// listeners (input/focus/keydown/mousedown on `document`) rather than
// per-card setup calls, since player cards are created dynamically.

function filterSpeciesList(query) {
  const q = query.trim().toLowerCase();
  if (!q) return SPECIES_LIST.slice(0, SPECIES_PICKER_MAX_RESULTS);
  const starts = [];
  const contains = [];
  for (const entry of SPECIES_LIST) {
    const nameLower = entry.n.toLowerCase();
    if (nameLower.startsWith(q)) starts.push(entry);
    else if (nameLower.includes(q)) contains.push(entry);
  }
  return starts.concat(contains).slice(0, SPECIES_PICKER_MAX_RESULTS);
}

function renderSpeciesOptions(panel, query) {
  const matches = filterSpeciesList(query);
  if (!matches.length) {
    panel.innerHTML = `<div class="species-picker-empty">${esc(t("speciesNoMatch"))}</div>`;
    return;
  }
  panel.innerHTML = matches
    .map(
      (entry, i) =>
        `<div class="species-option${i === 0 ? " active" : ""}" data-species-name="${esc(entry.n)}">${spriteChipHtml(entry.i, entry.n)}<span>${esc(entry.n)}</span></div>`
    )
    .join("");
}

function openAndFilterPanel(inputEl) {
  const field = inputEl.closest(".species-picker");
  const panel = field.querySelector(".species-picker-panel");
  renderSpeciesOptions(panel, inputEl.value);
  panel.classList.add("open");
}

function closeSpeciesPanel(panel) {
  panel.classList.remove("open");
}

function closeAllSpeciesPanels() {
  document.querySelectorAll(".species-picker-panel.open").forEach(closeSpeciesPanel);
}

function selectSpecies(panel, name) {
  const field = panel.closest(".species-picker");
  const input = field.querySelector("[data-mon-input]");
  input.value = name;
  setFieldError(field, "");
  closeSpeciesPanel(panel);
}

function handleSpeciesKeydown(e) {
  if (!e.target.matches("[data-mon-input]")) return;
  const field = e.target.closest(".species-picker");
  const panel = field.querySelector(".species-picker-panel");

  if (e.key === "Escape") {
    closeSpeciesPanel(panel);
    return;
  }
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !panel.classList.contains("open")) {
    openAndFilterPanel(e.target);
  }

  const options = Array.from(panel.querySelectorAll(".species-option"));
  if (!options.length) return;
  let idx = options.findIndex((o) => o.classList.contains("active"));

  if (e.key === "ArrowDown") {
    e.preventDefault();
    idx = Math.min(options.length - 1, idx + 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    idx = Math.max(0, idx - 1);
  } else if (e.key === "Enter") {
    if (idx >= 0) {
      e.preventDefault();
      selectSpecies(panel, options[idx].dataset.speciesName);
    }
    return;
  } else {
    return;
  }
  options.forEach((o, i) => o.classList.toggle("active", i === idx));
  options[idx].scrollIntoView({ block: "nearest" });
}

function handleDocumentMousedown(e) {
  const option = e.target.closest(".species-option");
  if (option) {
    // preventDefault keeps focus in the text input instead of letting the
    // mousedown blur it first, which would otherwise race the panel closed
    // before this selection applies.
    e.preventDefault();
    selectSpecies(option.closest(".species-picker-panel"), option.dataset.speciesName);
    return;
  }
  if (!e.target.closest(".species-picker")) {
    closeAllSpeciesPanels();
  }
}

function goToStep2() {
  const info = validateStep1();
  if (!info) return;
  tournamentInfo = info;

  document.getElementById("tournament-form").hidden = true;
  const step2 = document.getElementById("step-2");
  step2.hidden = false;

  document.getElementById("step-2-summary").textContent = t(
    "stepTwoSummary",
    info.tournamentName,
    info.tournamentType,
    info.numberOfPlayers,
    info.topCutSize
  );

  const cardsHtml = Array.from({ length: info.topCutSize }, (_, i) =>
    playerCardHtml(i, info.topCutSize)
  ).join("");
  document.getElementById("player-cards").innerHTML = cardsHtml;
}

function backToStep1() {
  document.getElementById("step-2").hidden = true;
  document.getElementById("tournament-form").hidden = false;
}

// ---- Step 2: player rosters + submission ----

function validatePlayerCard(cardEl) {
  let ok = true;
  MON_FIELD_KEYS.forEach((key) => {
    const fieldEl = cardEl.querySelector(`[data-mon-field="${key}"]`);
    const input = fieldEl.querySelector("input");
    const val = input.value.trim();
    if (!val) {
      setFieldError(fieldEl, t("fieldRequired"));
      ok = false;
    } else if (!SPECIES_NAME_SET.has(val.toLowerCase())) {
      setFieldError(fieldEl, t("fieldUnknownSpecies"));
      ok = false;
    } else {
      setFieldError(fieldEl, "");
    }
  });
  return ok;
}

function buildPayload(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    const entryId = FORM_CONFIG.entryIds[key];
    params.append(`entry.${entryId}`, value);
  }
  return params;
}

function submitOnePlayer(playerFields) {
  const payload = buildPayload({
    tournament_id: tournamentInfo.tournamentId,
    tournament_city: tournamentInfo.tournamentCity,
    tournament_date: tournamentInfo.tournamentDate,
    tournament_type: tournamentInfo.tournamentType,
    number_of_players: tournamentInfo.numberOfPlayers,
    location: tournamentInfo.location,
    to_name: tournamentInfo.toName,
    ...playerFields,
  });
  // no-cors: the POST fires and Google records it, but the response is
  // opaque - we genuinely can't tell success from failure from here.
  return fetch(FORM_CONFIG.actionUrl, {
    method: "POST",
    mode: "no-cors",
    body: payload,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitAll() {
  const cards = Array.from(document.querySelectorAll(".player-card"));

  let allValid = true;
  let firstInvalid = null;
  cards.forEach((card) => {
    const valid = validatePlayerCard(card);
    if (!valid) {
      allValid = false;
      if (!firstInvalid) firstInvalid = card;
    }
  });
  if (!allValid) {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const submitBtn = document.getElementById("submit-all-btn");
  submitBtn.disabled = true;
  const progressEl = document.getElementById("progress-line");

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    progressEl.textContent = t("progressLine", i + 1, cards.length);

    const monFields = {};
    MON_FIELD_KEYS.forEach((key) => {
      monFields[key] = card.querySelector(`[data-mon-input="${key}"]`).value.trim();
    });

    await submitOnePlayer({
      player_name: card.querySelector("[data-player-name]").value.trim(),
      placement: ordinal(i + 1),
      ...monFields,
    });

    // A small gap between requests, out of courtesy to Google's endpoint -
    // not strictly required for this few submissions, but cheap to do.
    await sleep(250);
  }

  progressEl.textContent = "";
  document.getElementById("step-2").hidden = true;
  document.getElementById("step-done").hidden = false;
  document.getElementById("done-summary").textContent = t("doneSummary", cards.length, tournamentInfo.tournamentName);
}

function resetAll() {
  document.getElementById("tournament-form").reset();
  document.getElementById("player-cards").innerHTML = "";
  document.getElementById("step-done").hidden = true;
  document.getElementById("step-2").hidden = true;
  document.getElementById("tournament-form").hidden = false;
  document.getElementById("submit-all-btn").disabled = false;
  tournamentInfo = null;
}

// locations-list.js (generated from tool/locations.py, sourced from
// pokemon-events-italia's own venue data) defines LOCATIONS_LIST as
// [{label, venue_name, vid, city}, ...]. "label" ("Venue (Region)") is only
// shown in the suggestion dropdown, to disambiguate venues that share a
// name across regions while a TO is still typing - once they pick one,
// handleLocationMatch() below rewrites the field down to the plain
// "venue_name" (no region), since that's what actually gets posted to the
// Sheet (a TO should see a clean "Dark Comics" there, not "Dark Comics
// (Piemonte)"). ingest.py's resolve_location() matches on that same plain
// venue_name; typing something that doesn't match anything still works, it
// just won't get a link (see hintLocation). "city" (best-effort, parsed
// from that venue's street address - can be missing or occasionally off)
// only drives the Tournament City auto-fill below, never validation.
const LOCATIONS_BY_LABEL_LOWER =
  typeof LOCATIONS_LIST === "undefined" ? new Map() : new Map(LOCATIONS_LIST.map((loc) => [loc.label.toLowerCase(), loc]));

function populateLocationOptions() {
  const datalist = document.getElementById("location-options");
  if (!datalist || typeof LOCATIONS_LIST === "undefined") return;
  datalist.innerHTML = LOCATIONS_LIST.map((loc) => `<option value="${esc(loc.label)}">`).join("");
}

// Once the Location field's value exactly matches a suggestion, this (a)
// rewrites it down to the plain venue name (dropping "(Region)" - see the
// LOCATIONS_BY_LABEL_LOWER comment above) and (b) fills in Tournament City
// from that venue's parsed city, so a TO picking a known venue doesn't have
// to type the same city twice. City is only overwritten when it's empty or
// still holds a previous auto-fill (tracked via data-autofilled) - a value
// the TO typed themselves is never clobbered.
function handleLocationMatch(locationInput) {
  const match = LOCATIONS_BY_LABEL_LOWER.get(locationInput.value.trim().toLowerCase());
  if (!match) return;
  locationInput.value = match.venue_name;

  if (!match.city) return;
  const cityInput = document.querySelector("#f-tournament-city input");
  if (!cityInput) return;
  if (cityInput.value.trim() === "" || cityInput.dataset.autofilled === "1") {
    cityInput.value = match.city;
    cityInput.dataset.autofilled = "1";
    setFieldError(document.getElementById("f-tournament-city"), "");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  populateLocationOptions();
  document.getElementById("to-step-2-btn").addEventListener("click", goToStep2);
  document.getElementById("back-to-step-1-btn").addEventListener("click", backToStep1);
  document.getElementById("submit-all-btn").addEventListener("click", submitAll);
  document.getElementById("submit-another-btn").addEventListener("click", resetAll);

  // Delegated so dynamically-created player cards' species pickers work
  // without any per-card wiring call.
  document.addEventListener("input", (e) => {
    if (e.target.matches("#f-location input")) {
      handleLocationMatch(e.target);
      return;
    }
    if (e.target.matches("#f-tournament-city input")) {
      // A real keystroke from the TO - stop treating this field as ours to
      // overwrite.
      delete e.target.dataset.autofilled;
      return;
    }
    if (!e.target.matches("[data-mon-input]")) return;
    openAndFilterPanel(e.target);
    setFieldError(e.target.closest(".species-picker"), "");
  });
  document.addEventListener(
    "focus",
    (e) => {
      if (e.target.matches("[data-mon-input]")) openAndFilterPanel(e.target);
    },
    true
  );
  document.addEventListener("keydown", handleSpeciesKeydown);
  document.addEventListener("mousedown", handleDocumentMousedown);

  // No onChange re-render: step 1's labels retranslate in place via
  // data-i18n automatically, and step 2's player cards (if already
  // generated) are deliberately left in whichever language they were
  // created in rather than rebuilt - rebuilding mid-entry would risk
  // wiping out species/player-name values the TO already typed in.
  initLangToggle();
});
