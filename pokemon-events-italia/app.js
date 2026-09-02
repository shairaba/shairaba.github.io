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
    types: "Tipo",
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
    filtersLabel: "Filtri",
    resetFilters: "Azzera filtri",
    backToTop: "Torna in cima",
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
    cookieNotice: "Questo sito salva solo le tue preferenze (tema, lingua e filtri di ricerca) sul tuo dispositivo, tramite un cookie tecnico e il local storage del browser. Nessun dato viene inviato a terzi o usato per tracciamento.",
    cookieAccept: "Ho capito",
    venueUpcomingCount: (n) => `${n} eventi in programma qui.`,
    venueNotFound: "Negozio non trovato.",
    viewVenueEvents: "Vedi tutti gli eventi di questo negozio",
    addFavorite: "Aggiungi ai preferiti",
    removeFavorite: "Rimuovi dai preferiti",
    favoritesOnly: "Solo preferiti",
    moreFilters: "Altro",
    addToCalendar: "Aggiungi al calendario",
    calendarGoogle: "Google Calendar",
    calendarOutlook: "Outlook",
    calendarIcs: "Apple Calendar / altro (.ics)",
    share: "Condividi",
    linkCopied: "Link copiato!",
    nearMe: "Vicino a me",
    locating: "Localizzazione…",
    locationDenied: "Permesso di posizione negato.",
    locationSearchPlaceholder: "Cerca una città o zona...",
    yourLocation: "La tua posizione",
    noLocationResults: "Nessun risultato",
    locationSearchError: "Ricerca posizione non riuscita.",
    clearLocation: "Cancella posizione",
    radiusLabel: "Raggio",
  },
  en: {
    locale: "en-US",
    brand: "Pokémon Event Locator but better",
    brandTagline: "VGC, TCG and GO events in Italy",
    heading: "Upcoming Pokémon events in Italy",
    metaCount: (n) => `${n} active events in Italy.`,
    types: "Type",
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
    filtersLabel: "Filters",
    resetFilters: "Reset filters",
    backToTop: "Back to top",
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
    cookieNotice: "This site only stores your preferences (theme, language, and search filters) on your device, via a technical cookie and browser local storage. No data is sent to third parties or used for tracking.",
    cookieAccept: "Got it",
    venueUpcomingCount: (n) => `${n} upcoming events here.`,
    venueNotFound: "Store not found.",
    viewVenueEvents: "See all events at this store",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    favoritesOnly: "Favorites only",
    moreFilters: "More",
    addToCalendar: "Add to calendar",
    calendarGoogle: "Google Calendar",
    calendarOutlook: "Outlook",
    calendarIcs: "Apple Calendar / other (.ics)",
    share: "Share",
    linkCopied: "Link copied!",
    nearMe: "Near me",
    locating: "Locating…",
    locationDenied: "Location permission denied.",
    locationSearchPlaceholder: "Search a city or area...",
    yourLocation: "Your location",
    noLocationResults: "No results",
    locationSearchError: "Location search failed.",
    clearLocation: "Clear location",
    radiusLabel: "Radius",
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
  // Nudges the back-to-top button up while the banner occupies the same
  // bottom-right corner (see .back-to-top / body.has-cookie-banner in
  // style.css) - only matters for the brief window before it's dismissed.
  document.body.classList.add("has-cookie-banner");
  document.getElementById("cookie-accept").addEventListener("click", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "1");
    banner.style.display = "none";
    document.body.classList.remove("has-cookie-banner");
  });
}

const FAVORITES_STORAGE_KEY = "favorites";

function getFavorites() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function isFavorite(guid) {
  return getFavorites().includes(guid);
}

/* Toggles guid in/out of the stored favorites list and returns the new
   state (true = now favorited) - the caller updates its own button/UI off
   that return value rather than re-reading storage. */
function toggleFavorite(guid) {
  const favs = getFavorites();
  const idx = favs.indexOf(guid);
  if (idx === -1) favs.push(guid);
  else favs.splice(idx, 1);
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
  } catch {}
  return favs.includes(guid);
}

const STAR_ICON_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" stroke-linejoin="round" stroke-linecap="round" stroke-width="1.8"><path d="M12 3.5l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3-5.6-3.4-5.6 3.4 1.4-6.3-4.8-4.2 6.4-.6z"></path></svg>`;

/* `large` switches to the bigger detail-page variant (next to the h1)
   instead of the small corner button used on cards. */
function favoriteButtonHtml(guid, { large = false } = {}) {
  const active = isFavorite(guid);
  const cls = ["favorite-btn"];
  if (large) cls.push("favorite-btn-lg");
  if (active) cls.push("is-favorite");
  return `<button type="button" class="${cls.join(" ")}" data-favorite-guid="${esc(guid)}" aria-pressed="${active}" aria-label="${esc(t(active ? "removeFavorite" : "addFavorite"))}">${STAR_ICON_SVG}</button>`;
}

/* Wires every [data-favorite-guid] button inside container. stopPropagation
   is required, not cosmetic: on list/calendar cards this button sits inside
   the whole-card click target that navigates to the event detail page (see
   wireEventCardClicks) - without it, tapping the star would also fire the
   card's own navigation. `onChange` lets a caller (e.g. the "favorites
   only" filter) re-render itself when a toggle might change what should be
   visible. */
function wireFavoriteButtons(container, onChange) {
  container.querySelectorAll("[data-favorite-guid]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const guid = btn.dataset.favoriteGuid;
      const active = toggleFavorite(guid);
      btn.classList.toggle("is-favorite", active);
      btn.setAttribute("aria-pressed", String(active));
      btn.setAttribute("aria-label", t(active ? "removeFavorite" : "addFavorite"));
      if (onChange) onChange(guid, active);
    });
  });
}

/* Haversine distance in km - used by the "near me" sort, which needs
   straight-line distance from the visitor's geolocation to each event's
   lat/long, not routing distance (that would need a routing API). */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceKm(km) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/* .ics export ("Add to calendar") - the scraped data has no explicit event
   end time, so DTEND is start_date plus an assumed typical event length
   rather than left equal to DTSTART (a zero-length event confuses some
   calendar apps). Emits UTC Z-suffixed timestamps (start_date is already
   absolute UTC, see the scraper's output) instead of a floating local time
   with a VTIMEZONE block - simpler, and every mainstream calendar app
   converts a Z timestamp to the viewer's own local time correctly. */
const ICS_DEFAULT_DURATION_HOURS = 3;

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildICS(event) {
  const start = new Date(event.start_date);
  const end = new Date(start.getTime() + ICS_DEFAULT_DURATION_HOURS * 3600000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pokemon Event Locator but better//IT",
    "BEGIN:VEVENT",
    `UID:${event.guid}@pokemon-events-italia`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(displayName(event))}`,
    event.full_address ? `LOCATION:${icsEscape(event.full_address)}` : "",
    event.details ? `DESCRIPTION:${icsEscape(event.details)}` : "",
    event.event_website ? `URL:${icsEscape(event.event_website)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/* Opens the .ics as a normal navigation (window.open) rather than a forced
   <a download> save: iOS/iPadOS Safari recognizes the text/calendar mime
   type and shows its native "Add to Calendar" sheet directly when it's
   navigated to like this, which a forced download attribute can prevent.
   Desktop browsers still just download it, same outcome as before - this
   is the fallback option for Apple Calendar and anything else without its
   own web deep link (below). */
function openICS(event) {
  const blob = new Blob([buildICS(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* Google Calendar and Outlook both have a documented "add event" deep
   link that takes plain query params - no auth, no API key, just a URL
   that pre-fills their own compose form in a new tab. Both accept the
   event's own timezone-less UTC instant, so the same start/end used for
   the .ics above works unchanged. */
function googleCalendarUrl(event) {
  const start = new Date(event.start_date);
  const end = new Date(start.getTime() + ICS_DEFAULT_DURATION_HOURS * 3600000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: displayName(event),
    dates: `${icsDate(start)}/${icsDate(end)}`,
  });
  if (event.full_address) params.set("location", event.full_address);
  if (event.details) params.set("details", event.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookCalendarUrl(event) {
  const start = new Date(event.start_date);
  const end = new Date(start.getTime() + ICS_DEFAULT_DURATION_HOURS * 3600000);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: displayName(event),
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (event.full_address) params.set("location", event.full_address);
  if (event.details) params.set("body", event.details);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/* "Add to calendar" as a small popover menu (Google / Outlook / Apple &
   others) instead of one button that just downloads an .ics - most
   visitors use Google or Apple Calendar day to day and would rather land
   straight in their own calendar's compose screen than handle a raw
   downloaded file. idPrefix lets a page host more than one of these
   (not currently needed, but avoids an id clash for free). */
function calendarMenuHtml(idPrefix = "calendar-menu") {
  return `
    <div class="calendar-menu-wrap">
      <button type="button" id="${idPrefix}-btn" class="btn btn-secondary" aria-haspopup="true" aria-expanded="false">${CALENDAR_ICON_SVG}<span>${esc(t("addToCalendar"))}</span></button>
      <div id="${idPrefix}" class="calendar-menu" hidden>
        <button type="button" class="calendar-menu-item" data-cal="google">${esc(t("calendarGoogle"))}</button>
        <button type="button" class="calendar-menu-item" data-cal="outlook">${esc(t("calendarOutlook"))}</button>
        <button type="button" class="calendar-menu-item" data-cal="ics">${esc(t("calendarIcs"))}</button>
      </div>
    </div>`;
}

/* Tracked on `document` itself (not a module-level variable, so multiple
   pages/calls don't need to share one) - renderDetail() re-runs this on
   every language toggle, and without removing the previous call's
   document-level listener first, each toggle would stack one more
   permanently-attached close handler pointing at the now-detached old menu
   DOM (harmless individually, but an unbounded leak over repeated toggles). */
function wireCalendarMenu(container, event, idPrefix = "calendar-menu") {
  const btn = container.querySelector(`#${idPrefix}-btn`);
  const menu = container.querySelector(`#${idPrefix}`);
  if (!btn || !menu) return;
  const close = () => {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    btn.setAttribute("aria-expanded", String(willOpen));
  });
  menu.querySelectorAll("[data-cal]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      if (item.dataset.cal === "google") window.open(googleCalendarUrl(event), "_blank", "noopener");
      else if (item.dataset.cal === "outlook") window.open(outlookCalendarUrl(event), "_blank", "noopener");
      else openICS(event);
      close();
    });
  });
  if (document.__calendarMenuClose) document.removeEventListener("click", document.__calendarMenuClose);
  document.__calendarMenuClose = close;
  document.addEventListener("click", close);
}

const SHARE_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

/* Native share sheet where available (mobile browsers, mostly); desktop
   browsers largely don't implement navigator.share, so this falls back to
   copying the link instead of silently doing nothing. Returns a result
   string rather than showing any UI itself, since the two callers
   (event.html, venue.html) show that result differently (swap their own
   button's label briefly). */
async function shareOrCopy(shareData) {
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(shareData.url);
    return "copied";
  } catch {
    return "failed";
  }
}

/* Floating bottom-right button, hidden until the page is scrolled down a
   bit, that smooth-scrolls back to the top. Present on all three pages. */
function initBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  const toggle = () => btn.classList.toggle("visible", window.scrollY > 400);
  window.addEventListener("scroll", toggle, { passive: true });
  toggle();
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* Proper display casing for the 20 Italian regions - the stored `region`
   field is always plain uppercase (see tool/pokemon_events/filters.py), and
   a generic "capitalize the first letter, lowercase the rest" doesn't work
   for multi-word/hyphenated names (would give "Emilia-romagna",
   "Trentino-alto adige", "Valle d'aosta" instead of the correct casing). */
const REGION_LABELS = {
  "PIEMONTE": "Piemonte",
  "VALLE D'AOSTA": "Valle d'Aosta",
  "LOMBARDIA": "Lombardia",
  "TRENTINO-ALTO ADIGE": "Trentino-Alto Adige",
  "VENETO": "Veneto",
  "FRIULI-VENEZIA GIULIA": "Friuli-Venezia Giulia",
  "LIGURIA": "Liguria",
  "EMILIA-ROMAGNA": "Emilia-Romagna",
  "TOSCANA": "Toscana",
  "UMBRIA": "Umbria",
  "MARCHE": "Marche",
  "LAZIO": "Lazio",
  "ABRUZZO": "Abruzzo",
  "MOLISE": "Molise",
  "CAMPANIA": "Campania",
  "PUGLIA": "Puglia",
  "BASILICATA": "Basilicata",
  "CALABRIA": "Calabria",
  "SICILIA": "Sicilia",
  "SARDEGNA": "Sardegna",
};

function regionLabel(region) {
  return REGION_LABELS[region] || (region.charAt(0) + region.slice(1).toLowerCase());
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

/* Escapes text (same as esc()) then turns any http(s):// or bare www. URL
   into a clickable link - event descriptions are free text typed by store
   owners and often include a registration form or Facebook event link.
   Trailing punctuation ("...form https://forms.gle/xyz." or "(see
   https://example.com)") is pulled back outside the <a> since it's
   normally sentence punctuation, not part of the URL. */
function linkify(text) {
  const escaped = esc(text);
  return escaped.replace(/\b((?:https?:\/\/|www\.)[^\s<]+)/gi, (match) => {
    const trailing = match.match(/[.,;:!?)\]}'"]+$/);
    const clean = trailing ? match.slice(0, -trailing[0].length) : match;
    const suffix = trailing ? trailing[0] : "";
    const href = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${clean}</a>${suffix}`;
  });
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

/* Admission comes through inconsistently formatted: a plain number ("10",
   "10,00"), a spelled-out currency ("10 euro", "6.00 EUR", "10 chf"), a €
   symbol before or after ("€ 10", "10€"), a non-numeric status ("FREE",
   "GRATUITO", "a breve", "?"), absent entirely for most recurring free
   league nights, or - rarely - two tiers for pre-registered vs walk-in
   pricing ("Euro 20,00 (preiscritti) - Euro 25,00 (non preiscritti)").
   Normalizes the common numeric shapes to a single "N€"; the two-tier case
   keeps both amounts with their own label rather than collapsing to one
   number (the old blanket strip-€-then-append-€ turned that whole sentence
   into "...(non preiscritti)€"); anything else is left exactly as the
   source wrote it rather than gluing a stray "€" onto text that doesn't
   need one.

   `compact` condenses the two-tier case to a short "10–15€" range instead
   of the full "10€ (preiscritti) · 15€ (non preiscritti)" - for the
   event-card pill, which is a fixed-height, non-wrapping badge that the
   full labeled text would overflow (confirmed live: it spilled past the
   card edge and squeezed the venue name onto extra lines). The event
   detail page's own meta grid has room to spare, so it always gets the
   full breakdown.

   Every amount also drops a bare ",00"/".00" - "10,00" displays as "10",
   but "9.99" keeps its decimals since those actually matter. */
function stripZeroDecimals(amount) {
  return amount.replace(/[.,]00$/, "");
}

function formatAdmission(event, { compact = false } = {}) {
  const raw = (event.admission || "").trim();
  if (!raw) return null;

  const tierRe = /(?:euro\s*|€\s*)?([\d.,]+)\s*(?:€)?\s*\(?(non\s*preiscritt[ei]|preiscritt[ei])\)?/gi;
  const tiers = [...raw.matchAll(tierRe)];
  if (tiers.length >= 2) {
    if (compact) {
      const amounts = tiers.map(([, amount]) => stripZeroDecimals(amount));
      return `${amounts[0]}–${amounts[amounts.length - 1]}€`;
    }
    return tiers
      .map(([, amount, label]) => `${stripZeroDecimals(amount)}€ (${label.replace(/\s+/g, " ").toLowerCase()})`)
      .join(" · ");
  }

  if (/^[\d.,]+$/.test(raw)) return `${stripZeroDecimals(raw)}€`;
  const symbolMatch = raw.match(/^€?\s*([\d.,]+)\s*€?$/);
  if (symbolMatch) return `${stripZeroDecimals(symbolMatch[1])}€`;
  const wordMatch = raw.match(/^([\d.,]+)\s*(?:euro|eur|chf)$/i);
  if (wordMatch) return `${stripZeroDecimals(wordMatch[1])}€`;

  return raw;
}

function googleMapsDirectionsUrl(event) {
  return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
}

/* Small inline icons (Feather-style: 24x24 viewBox, currentColor stroke) for
   the card's date and address rows - same visual language as the
   theme-toggle's sun/moon icons. */
const CALENDAR_ICON_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
const MAP_PIN_ICON_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

/* Shared event-card markup for both the List view and the Calendar day
   list. `showDate` shows the full date (List spans many days); Calendar's
   day-strip already establishes the date, so it only needs the time there.
   The card's heading is always the venue/store name, never the specific
   event name - most events have no distinct name anyway (falls back to the
   venue), and the ones that do still show it on the event detail page. */
function eventCardHtml(event, { showDate = true, distanceKm: distKm } = {}) {
  const meta = typeMeta(event);
  const venue = placeName(event) || t("noEventName");
  const dateText = showDate ? formatDate(event, { year: undefined }) : formatTime(event);
  const gamesHtml = gamePillsHtml(event.products);

  const cost = formatAdmission(event, { compact: true });
  const inactiveClass = event.is_active === false ? " event-card-inactive" : "";
  return `
    <div class="event-card${inactiveClass}" data-guid="${esc(event.guid)}" role="button" tabindex="0">
      ${favoriteButtonHtml(event.guid)}
      <div class="event-card-icon ${meta.className}">${typeIconHtml(meta)}</div>
      <div class="event-card-body">
        <div class="event-card-title-row">
          <div class="event-card-title ${meta.className}">${esc(venue)}</div>
          ${cost ? `<div class="event-card-cost">${esc(cost)}</div>` : ""}
        </div>
        ${gamesHtml ? `<div class="event-card-games">${gamesHtml}</div>` : ""}
        ${typeof distKm === "number" ? `<div class="event-card-meta-row">${MAP_PIN_ICON_SVG}<span>${esc(formatDistanceKm(distKm))}</span></div>` : ""}
        <div class="event-card-meta-row">${CALENDAR_ICON_SVG}<span>${esc(dateText)}</span></div>
        ${event.full_address ? `<div class="event-card-meta-row event-card-meta-address">${MAP_PIN_ICON_SVG}<span>${esc(event.full_address)}</span></div>` : ""}
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
