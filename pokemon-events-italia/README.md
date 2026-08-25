# Eventi Pokémon Italia

Browse upcoming official Pokemon events (Video Game/VGC, TCG, and Pokemon
GO) across Italy - a searchable list, a day-by-day calendar, and an
interactive map, plus a full detail page per event - sourced from the
official Pokemon Event Locator.

## Pages

- `index.html` - three views (toggle in the top-right):
  - **Elenco** - a searchable/filterable card list (search, event type,
    date range, include past/inactive events).
  - **Calendario** - a month-nav + day-strip picker showing that day's
    events.
  - **Mappa** - a Leaflet map plotting each event at its venue.
- `event.html?guid=<id>` - full detail page for one event: date, venue,
  address (with an embedded mini-map), registration window, cost,
  description, and attributes. Reached by clicking any card, calendar
  row, or map marker.

## How it works

- `index.html`, `event.html`, `app.js`, `style.css` - a static,
  backend-free frontend. Fetches `data/events.json` client-side and
  renders it - no server, no build step, just files GitHub Pages serves
  as-is.
- `data/events.json` - the published dataset, keyed by event GUID, with
  `first_seen_at`/`last_seen_at`/`is_active` bookkeeping so re-scraping
  never loses history (an event whose date has passed just stops
  showing as active, rather than being deleted).
- `tool/` - the Python/Playwright pipeline that produces
  `data/events.json`. See [`tool/README.md`](tool/README.md) for setup
  and usage.

## Serving locally

```bash
cd pokemon-events-italia
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. (Opening `index.html`
directly via `file://` won't work - `fetch()` of local JSON is blocked
by CORS without a real server.)

## Refreshing the data

```bash
cd tool
.venv/bin/python cli.py run
```

Then commit `data/events.json` if you're happy with the diff. See
`tool/README.md` for what this actually does and its current limitations.

## Notes

- Each event carries a derived `region` field (e.g. "LOMBARDIA") from its
  address, for future region-based filtering.
- Not affiliated with The Pokemon Company International - this scrapes
  their public event locator for personal/community use.
