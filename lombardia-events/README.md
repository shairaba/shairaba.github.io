# Eventi VGC Lombardia

Browse upcoming official Pokemon VGC (video game) league nights and
tournaments in Lombardy, Italy - a searchable/filterable list plus an
interactive map, sourced from the official Pokemon Event Locator.

## Pages

- `index.html` - one page, two views (toggle in the top-right): a
  sortable/filterable list (search, event type, date range, include
  past/inactive events), and a Leaflet map plotting each event at its
  venue.

## How it works

- `index.html`, `app.js`, `style.css` - a static, backend-free frontend.
  Fetches `data/events.json` client-side and renders it - no server, no
  build step, just files GitHub Pages serves as-is.
- `data/events.json` - the published dataset, keyed by event GUID, with
  `first_seen_at`/`last_seen_at`/`is_active` bookkeeping so re-scraping
  never loses history (an event whose date has passed just stops
  showing as active, rather than being deleted).
- `tool/` - the Python/Playwright pipeline that produces `data/events.json`.
  See [`tool/README.md`](tool/README.md) for setup and usage - notably,
  **this currently has to be run from a real machine with a GPU/display,
  not CI** (see that README for why).

## Serving locally

```bash
cd lombardia-events
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

Then commit `data/events.json` if you're happy with the diff. There's no
automated daily refresh (yet) - see `tool/README.md` for why GitHub
Actions isn't currently viable for the scrape step itself.

## Notes

- Coverage is a 150km radius from a fixed point near Milan by default,
  which comfortably covers Lombardy plus some spillover into
  neighboring regions (filtered out client-side by address). See
  `tool/README.md`'s "Known quirks" for the address-matching details
  and the `--extra-points` flag if a coverage gap ever shows up on the
  map (e.g. near Sondrio/Valtellina).
- Not affiliated with The Pokemon Company International - this scrapes
  their public event locator for personal/community use.
