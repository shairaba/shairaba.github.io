/* Shared helpers used by both index.html and event.html. */

const TYPE_META = {
  cup: { label: "Coppa di Lega", className: "type-cup", icon: "🏆" },
  challenge: { label: "Sfida di Lega", className: "type-challenge", icon: "⚡" },
  tournament: { label: "Torneo", className: "type-tournament", icon: "🎮" },
  league: { label: "Lega", className: "type-league", icon: "👥" },
};

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
  return TYPE_META[eventTypeKey(event)];
}

function displayName(event) {
  return event.name || event.activity_group_name || event.venue_name || "Evento senza nome";
}

function placeName(event) {
  return event.activity_group_name || event.venue_name || "";
}

function formatDate(event, opts) {
  if (!event.start_date) return "";
  const d = new Date(event.start_date);
  if (isNaN(d)) return event.start_date;
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: event.timezone || "Europe/Rome",
      ...opts,
    }).format(d);
  } catch {
    return d.toLocaleString("it-IT");
  }
}

function formatTime(event) {
  if (!event.start_date) return "";
  const d = new Date(event.start_date);
  if (isNaN(d)) return "";
  try {
    return new Intl.DateTimeFormat("it-IT", {
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
  const formatted = new Intl.DateTimeFormat("it-IT", {
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

function productBadges(products) {
  const LABELS = { vg: "Video Game", tcg: "GCC", pgo: "GO" };
  return (products || []).map((p) => LABELS[p] || p);
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
      <div class="event-card-icon ${meta.className}">${meta.icon}</div>
      <div class="event-card-body">
        <div class="event-card-title-row">
          <div class="event-card-title ${meta.className}">${esc(displayName(event))}</div>
          ${cost ? `<div class="event-card-cost">${esc(cost)}</div>` : ""}
        </div>
        <div class="event-card-subtitle">${esc(subtitleParts.join(" · "))}</div>
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
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayOfWeekAbbrev(year, month, day) {
  const d = new Date(year, month, day);
  return new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(d).replace(".", "");
}
