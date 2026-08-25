const TYPE_LABELS = {
  tournament: "Torneo",
  play_session: "Lega",
};

const TAG_LABELS = {
  prerelease: "Prerelease",
  league_cup: "Coppa di Lega",
  league_challenge: "Sfida di Lega",
  play_session: "Lega",
  friendly_tournaments: "Torneo amichevole",
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

function typeLabel(event) {
  const tag = (event.event_type_tags || [])[0];
  if (tag && TAG_LABELS[tag]) return TAG_LABELS[tag];
  return TYPE_LABELS[event.activity_type] || event.activity_type || "Evento";
}

function displayName(event) {
  return event.name || event.activity_group_name || event.venue_name || "Evento senza nome";
}

function formatDate(event) {
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
    }).format(d);
  } catch {
    return d.toLocaleString("it-IT");
  }
}

async function loadEvents() {
  const data = await fetchJSON("data/events.json");
  return Object.values(data.events || {});
}

function applyFilters(events, filterState) {
  let rows = events;
  if (!filterState.includeInactive) rows = rows.filter((e) => e.is_active);
  if (filterState.q) {
    const q = filterState.q.toLowerCase();
    rows = rows.filter((e) =>
      [e.name, e.activity_group_name, e.venue_name, e.full_address]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q))
    );
  }
  if (filterState.type) rows = rows.filter((e) => e.activity_type === filterState.type);
  if (filterState.dateFrom) rows = rows.filter((e) => e.start_date && e.start_date.slice(0, 10) >= filterState.dateFrom);
  if (filterState.dateTo) rows = rows.filter((e) => e.start_date && e.start_date.slice(0, 10) <= filterState.dateTo);
  return rows.slice().sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
}

const MAX_ROWS = 300;

function renderList(filtered) {
  const tbody = document.getElementById("rows");
  const shown = filtered.slice(0, MAX_ROWS);
  if (!shown.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nessun evento trovato.</td></tr>';
  } else {
    tbody.innerHTML = shown
      .map((e) => {
        const link = e.event_website || e.third_party_registration_website;
        const nameHtml = link
          ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(displayName(e))}</a>`
          : esc(displayName(e));
        return `
        <tr>
          <td class="cell-date">${esc(formatDate(e))}</td>
          <td class="cell-name truncate">${nameHtml}</td>
          <td class="cell-type"><span class="badge">${esc(typeLabel(e))}</span></td>
          <td class="cell-place truncate">${esc(e.venue_name || "")}${e.full_address ? " &middot; " + esc(e.full_address) : ""}</td>
        </tr>`;
      })
      .join("");
  }
  document.getElementById("showing-note").textContent =
    filtered.length > MAX_ROWS ? `Mostrati ${MAX_ROWS} di ${filtered.length} eventi corrispondenti.` : "";
}

let map = null;
let markerLayer = null;

function renderMap(filtered) {
  if (!map) {
    map = L.map("map").setView([45.4642, 9.19], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }
  markerLayer.clearLayers();
  filtered.forEach((e) => {
    const marker = L.marker([e.latitude, e.longitude]);
    const link = e.event_website || e.third_party_registration_website;
    const nameHtml = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(displayName(e))}</a>`
      : esc(displayName(e));
    marker.bindPopup(
      `<div class="popup-title">${nameHtml}</div>` +
        `<div class="popup-meta">${esc(typeLabel(e))} &middot; ${esc(formatDate(e))}</div>` +
        `<div class="popup-meta">${esc(e.venue_name || "")}</div>`
    );
    marker.addTo(markerLayer);
  });
}

function currentFilterState() {
  return {
    q: document.getElementById("q").value.trim(),
    type: document.getElementById("type").value,
    dateFrom: document.getElementById("date-from").value,
    dateTo: document.getElementById("date-to").value,
    includeInactive: document.getElementById("include-inactive").checked,
  };
}

(async function main() {
  let allEvents = [];
  try {
    allEvents = await loadEvents();
  } catch (err) {
    document.getElementById("rows").innerHTML =
      '<tr><td colspan="4" class="empty-state">Impossibile caricare i dati degli eventi.</td></tr>';
    console.error(err);
    return;
  }

  const listView = document.getElementById("list-view");
  const mapView = document.getElementById("map-view");
  const listBtn = document.getElementById("view-list-btn");
  const mapBtn = document.getElementById("view-map-btn");

  function render() {
    const filtered = applyFilters(allEvents, currentFilterState());
    renderList(filtered);
    if (mapView.style.display !== "none") renderMap(filtered);
  }

  function showList() {
    listView.style.display = "";
    mapView.style.display = "none";
    listBtn.classList.add("active");
    mapBtn.classList.remove("active");
  }

  function showMap() {
    listView.style.display = "none";
    mapView.style.display = "";
    mapBtn.classList.add("active");
    listBtn.classList.remove("active");
    const filtered = applyFilters(allEvents, currentFilterState());
    renderMap(filtered);
    // Leaflet renders a blank/broken tile grid if initialized while its
    // container was display:none - invalidateSize() forces it to re-measure
    // now that the container is actually visible.
    setTimeout(() => map && map.invalidateSize(), 0);
  }

  listBtn.addEventListener("click", showList);
  mapBtn.addEventListener("click", showMap);

  if (qs("q")) document.getElementById("q").value = qs("q");
  if (qs("type")) document.getElementById("type").value = qs("type");

  document.getElementById("filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    render();
  });
  document.getElementById("type").addEventListener("change", render);
  document.getElementById("include-inactive").addEventListener("change", render);

  const activeCount = allEvents.filter((e) => e.is_active).length;
  document.getElementById("meta-note").textContent = `${activeCount} eventi attivi in Lombardia.`;

  render();
})();
