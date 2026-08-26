/* Shared helpers used by both index.html and event.html.

   i18n: only the UI chrome is translated (labels, buttons, section
   titles). Event content itself - names, descriptions, addresses - comes
   straight from the scraped source data, which is inherently Italian
   (written by Italian store owners for an Italian audience), and is
   deliberately left as-is rather than mistranslated. */

const TRANSLATIONS = {
  it: {
    locale: "it-IT",
    brand: "Pokémon Event Locator but better",
    brandTagline: "Eventi VGC, GCC e GO in Italia",
    heading: "Prossimi eventi Pokémon in Italia",
    metaCount: (n) => `${n} eventi attivi in Italia.`,
    searchPlaceholder: "Cerca per nome, negozio, città...",
    allTypes: "Tutti i tipi",
    typeCup: "Coppa di Lega",
    typeChallenge: "Sfida di Lega",
    typeTournament: "Torneo",
    typeLeague: "Lega",
    allRegions: "Tutte le regioni",
    from: "Da",
    to: "A",
    games: "Giochi",
    gameVg: "Video Game",
    gameTcg: "GCC",
    gamePgo: "GO",
    filterBtn: "Filtra",
    viewList: "Elenco",
    viewCalendar: "Calendario",
    viewMap: "Mappa",
    calViewStrip: "Giorni",
    calViewMonth: "Mese",
    prevMonth: "Mese precedente",
    nextMonth: "Mese successivo",
    noEventsFound: "Nessun evento trovato.",
    noEventsDay: "Nessun evento questo giorno.",
    showingNote: (shown, total) => `Mostrati ${shown} di ${total} eventi corrispondenti.`,
    eventsCount: (n) => `${n} eventi`,
    footnote: "Dati raccolti dal localizzatore eventi ufficiale Pokémon. Non affiliato a The Pokémon Company International.",
    backToList: "← Torna all'elenco",
    detailsArrow: "Dettagli →",
    takeMeThere: "Portami lì",
    eventWebsite: "Sito dell'evento",
    signUp: "Iscriviti",
    address: "Indirizzo",
    description: "Descrizione",
    characteristics: "Caratteristiche",
    dateTime: "Data e ora",
    regFrom: "Iscrizioni da",
    regTo: "Iscrizioni fino a",
    cost: "Costo",
    email: "Email",
    phone: "Telefono",
    inactiveNote: "Questo evento non risulta più attivo nel localizzatore ufficiale (probabilmente la data è passata).",
    loading: "Caricamento…",
    loadError: "Impossibile caricare i dati degli eventi.",
    noEventSpecified: "Evento non specificato.",
    eventNotFound: "Evento non trovato.",
    noEventName: "Evento senza nome",
    cookieNotice: "Questo sito salva solo le tue preferenze di tema e lingua sul tuo dispositivo (un cookie tecnico e il local storage del browser). Nessun dato viene inviato a terzi o usato per tracciamento.",
    cookieAccept: "Ho capito",
    venueUpcomingCount: (n) => `${n} eventi in programma qui.`,
    venueNotFound: "Negozio non trovato.",
    viewVenueEvents: "Vedi tutti gli eventi di questo negozio",
  },
  en: {
    locale: "en-US",
    brand: "Pokémon Event Locator but better",
    brandTagline: "VGC, TCG and GO events in Italy",
    heading: "Upcoming Pokémon events in Italy",
    metaCount: (n) => `${n} active events in Italy.`,
    searchPlaceholder: "Search by name, store, city...",
    allTypes: "All types",
    typeCup: "League Cup",
    typeChallenge: "League Challenge",
    typeTournament: "Tournament",
    typeLeague: "League",
    allRegions: "All regions",
    from: "From",
    to: "To",
    games: "Games",
    gameVg: "Video Game",
    gameTcg: "TCG",
    gamePgo: "GO",
    filterBtn: "Filter",
    viewList: "List",
    viewCalendar: "Calendar",
    viewMap: "Map",
    calViewStrip: "Days",
    calViewMonth: "Month",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    noEventsFound: "No events found.",
    noEventsDay: "No events this day.",
    showingNote: (shown, total) => `Showing ${shown} of ${total} matching events.`,
    eventsCount: (n) => `${n} events`,
    footnote: "Data collected from the official Pokémon event locator. Not affiliated with The Pokémon Company International.",
    backToList: "← Back to list",
    detailsArrow: "Details →",
    takeMeThere: "Take me there",
    eventWebsite: "Event website",
    signUp: "Sign up",
    address: "Address",
    description: "Description",
    characteristics: "Attributes",
    dateTime: "Date and time",
    regFrom: "Registration from",
    regTo: "Registration until",
    cost: "Cost",
    email: "Email",
    phone: "Phone",
    inactiveNote: "This event no longer shows as active on the official locator (the date has likely passed).",
    loading: "Loading…",
    loadError: "Could not load event data.",
    noEventSpecified: "No event specified.",
    eventNotFound: "Event not found.",
    noEventName: "Unnamed event",
    cookieNotice: "This site only stores your theme and language preference on your device (a technical cookie and browser local storage). No data is sent to third parties or used for tracking.",
    cookieAccept: "Got it",
    venueUpcomingCount: (n) => `${n} upcoming events here.`,
    venueNotFound: "Store not found.",
    viewVenueEvents: "See all events at this store",
  },
};

const LANG_STORAGE_KEY = "lang";

function getLang() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return stored && TRANSLATIONS[stored] ? stored : "it";
}

function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

function t(key, ...args) {
  const entry = TRANSLATIONS[getLang()][key];
  return typeof entry === "function" ? entry(...args) : entry;
}

function currentLocale() {
  return TRANSLATIONS[getLang()].locale;
}

/* Walks the DOM applying the current language to every element tagged
   with data-i18n (textContent), data-i18n-placeholder, or
   data-i18n-aria-label - static markup only. Dynamic JS-rendered content
   (cards, calendar, popups) reads t() directly at render time instead. */
function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = getLang();
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === getLang());
  });
}

/* Wires the IT/EN toggle present in both pages' topbar. `onChange` runs
   after the language switches and static markup is retranslated, so each
   page can re-render its own dynamic content (cards, calendar, detail). */
function initLangToggle(onChange) {
  applyTranslations();
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      applyTranslations();
      if (onChange) onChange();
    });
  });
}

/* Light/dark toggle, present in both pages' topbar. The initial theme is
   already applied to <html> by an inline blocking script in each page's
   <head> (reads the same cookie, before first paint) - this only needs to
   flip that attribute and re-save the cookie on click; the switch's
   sun/moon icons and knob position are driven entirely by CSS off the
   [data-theme] attribute. */
function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  });
}

const COOKIE_CONSENT_KEY = "cookieConsent";

/* Minimal GDPR-style notice: this site only sets a `theme` cookie and two
   localStorage keys (lang, calMode) for its own preferences - no analytics,
   no third-party tracking - but ePrivacy still calls for informing visitors
   before/while that storage happens. Shown once; "Got it" just records
   acknowledgement so it doesn't reappear, it doesn't gate the preferences
   themselves (they're strictly functional, not used for tracking). */
function initCookieConsent() {
  const banner = document.getElementById("cookie-banner");
  if (!banner || localStorage.getItem(COOKIE_CONSENT_KEY) === "1") return;
  banner.style.display = "";
  document.getElementById("cookie-accept").addEventListener("click", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "1");
    banner.style.display = "none";
  });
}

const TYPE_META = {
  cup: { labelKey: "typeCup", className: "type-cup", iconImg: "icons/league-cup.png" },
  challenge: { labelKey: "typeChallenge", className: "type-challenge", iconImg: "icons/league-challenge.png" },
  tournament: { labelKey: "typeTournament", className: "type-tournament", iconImg: "icons/default-badge.png" },
  league: { labelKey: "typeLeague", className: "type-league", iconImg: "icons/default-badge.png" },
};

/* Cup/Challenge use the official badge artwork instead of an emoji -
   iconImg takes priority over the plain-text icon when both could apply. */
function typeIconHtml(meta) {
  if (meta.iconImg) return `<img src="${esc(meta.iconImg)}" alt="" class="type-icon-img">`;
  return meta.icon || "";
}

const GAME_META = {
  vg: { labelKey: "gameVg", className: "game-pill-vg" },
  tcg: { labelKey: "gameTcg", className: "game-pill-tcg" },
  pgo: { labelKey: "gamePgo", className: "game-pill-pgo" },
};

function gamePillsHtml(products) {
  return (products || [])
    .filter((p) => GAME_META[p])
    .map((p) => `<span class="game-pill ${GAME_META[p].className}">${t(GAME_META[p].labelKey)}</span>`)
    .join("");
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

/* series_name carries the specific competitive series (e.g. "VGC League
   Cup Round 1", "VGC League Challenge September") - checked ahead of the
   coarser activity_type (play_session vs tournament) since it's a much
   more specific signal when present. Text match only, by design - events
   like "VGC Worlds Celebration" (tagged league_challenge internally but
   without that text in series_name) intentionally fall through to the
   generic Torneo/Lega classification below. */
function eventTypeKey(event) {
  const series = event.series_name || "";
  if (/league cup/i.test(series)) return "cup";
  if (/league challenge/i.test(series)) return "challenge";
  return event.activity_type === "tournament" ? "tournament" : "league";
}

function typeMeta(event) {
  const meta = TYPE_META[eventTypeKey(event)];
  return { ...meta, label: t(meta.labelKey) };
}

function displayName(event) {
  return event.name || event.activity_group_name || event.venue_name || t("noEventName");
}

function placeName(event) {
  return event.activity_group_name || event.venue_name || "";
}

function formatDate(event, opts) {
  if (!event.start_date) return "";
  const d = new Date(event.start_date);
  if (isNaN(d)) return event.start_date;
  const locale = currentLocale();
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: event.timezone || "Europe/Rome",
      ...opts,
    }).format(d);
  } catch {
    return d.toLocaleString(locale);
  }
}

function formatTime(event) {
  if (!event.start_date) return "";
  const d = new Date(event.start_date);
  if (isNaN(d)) return "";
  try {
    return new Intl.DateTimeFormat(currentLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: event.timezone || "Europe/Rome",
    }).format(d);
  } catch {
    return "";
  }
}

/* Local calendar-day key (in the event's own timezone), for grouping -
   NOT a plain UTC date slice, since a late-evening Italy event could
   otherwise land under the wrong day. */
function localDateKey(event) {
  if (!event.start_date) return null;
  const d = new Date(event.start_date);
  if (isNaN(d)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: event.timezone || "Europe/Rome",
    }).format(d); // en-CA gives YYYY-MM-DD
  } catch {
    return event.start_date.slice(0, 10);
  }
}

function formatDayHeading(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  const formatted = new Intl.DateTimeFormat(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

async function loadEvents() {
  const data = await fetchJSON("data/events.json");
  return Object.values(data.events || {});
}

/* Admission comes through inconsistently formatted ("10", "10 €", "10€",
   or absent for most recurring free league nights) - normalize to a single
   "N€" shape rather than assert "free" when it's simply unspecified. */
function formatAdmission(event) {
  const raw = (event.admission || "").trim();
  if (!raw) return null;
  const numeric = raw.replace(/€/g, "").trim();
  return numeric ? `${numeric}€` : raw;
}

function googleMapsDirectionsUrl(event) {
  return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
}

/* Shared event-card markup for both the List view and the Calendar day
   list. `showDate` prepends the date to the subtitle line (List spans many
   days; Calendar's day-strip already establishes the date, so it only
   needs the time there). */
function eventCardHtml(event, { showDate = true } = {}) {
  const meta = typeMeta(event);
  const subtitleParts = [];
  if (showDate) subtitleParts.push(formatDate(event, { year: undefined }));
  else subtitleParts.push(formatTime(event));
  const place = placeName(event);
  if (place) subtitleParts.push(place);

  const cost = formatAdmission(event);
  const inactiveClass = event.is_active === false ? " event-card-inactive" : "";
  return `
    <div class="event-card${inactiveClass}" data-guid="${esc(event.guid)}" role="button" tabindex="0">
      <div class="event-card-icon ${meta.className}">${typeIconHtml(meta)}</div>
      <div class="event-card-body">
        <div class="event-card-title-row">
          <div class="event-card-title ${meta.className}">${esc(displayName(event))}</div>
          ${cost ? `<div class="event-card-cost">${esc(cost)}</div>` : ""}
        </div>
        <div class="event-card-subtitle">${esc(subtitleParts.join(" · "))}</div>
        <div class="event-card-games">${gamePillsHtml(event.products)}</div>
        ${event.full_address ? `<div class="event-card-address">${esc(event.full_address)}</div>` : ""}
      </div>
    </div>`;
}

function wireEventCardClicks(container) {
  container.querySelectorAll("[data-guid]").forEach((el) => {
    const go = () => {
      location.href = `event.html?guid=${encodeURIComponent(el.dataset.guid)}`;
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });
}

/* Calendar date math - plain y/m/d tuples (no timezone conversion needed
   here since we're just building a navigable day-strip, not rendering an
   event's own local time). */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function dateKeyFor(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function monthLabel(year, month) {
  const d = new Date(year, month, 1);
  const label = new Intl.DateTimeFormat(currentLocale(), { month: "long", year: "numeric" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayOfWeekAbbrev(year, month, day) {
  const d = new Date(year, month, day);
  return new Intl.DateTimeFormat(currentLocale(), { weekday: "short" }).format(d).replace(".", "");
}
