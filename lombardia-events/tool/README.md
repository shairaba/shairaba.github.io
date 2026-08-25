# Lombardia VGC Event Scraper (tool)

Pulls upcoming Pokemon VGC (video game) league/tournament events in
Lombardy from the official Pokemon Event Locator's internal API into
`../data/events.json` - the file the static site at `../` reads.

## Why this needs a real browser, and why it runs locally

`events.pokemon.com` is protected by Imperva/Incapsula plus an
Akamai-style bot sensor (`reese84` cookie). Static assets and the page
itself load fine for any client, but the app's own internal API calls
(`screenservices/*`, including the one this tool needs) get 403'd when
the browser's fingerprint looks automated - most concretely, a
GPU-less/headless rendering environment (confirmed by testing from a
GitHub Actions runner: the app loaded completely, then its own first API
call failed with `403` and a WebGL "no available adapters" warning in
the console).

Two things fixed this:
- **Headed Chromium**, not headless - `browser_client.py` launches with
  `headless=False` by default (see `PokemonEventLocatorClient`). This is
  why the scraper runs from your own machine (real GPU, real display)
  rather than a CI runner.
- The CSRF token (`X-Csrftoken` header) is read fresh from the
  `nr2Users` cookie's `crf=` segment every run, not hardcoded - it's a
  double-submit-cookie value the server issues per session.

**This is why there's no GitHub Actions workflow scraping on a
schedule** (unlike the sibling `vgc-tournament-explorer/`) - CI runners
don't have a real GPU/display, and testing showed that's specifically
what gets the app's API calls blocked. Run this manually (or via your
own machine's local scheduler, e.g. `launchd`/`cron`) and commit the
result when you want to refresh the published data.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m playwright install chromium
```

## Commands

```bash
# Fetch, filter to Lombardy, and upsert into ../data/events.json.
# Safe to re-run any time - events missing from a fresh fetch are marked
# inactive (not deleted), so history isn't lost when an event's date passes.
.venv/bin/python cli.py run

# See what's currently in the store.
.venv/bin/python cli.py status

# Fire one raw request and dump the response to data/raw/ for manual
# inspection, without touching the store - useful if the site's response
# shape ever changes and `run` starts erroring.
.venv/bin/python cli.py inspect
```

Useful flags on `run`:
- `--latitude` / `--longitude` / `--range-km` - search center + radius in
  km. Defaults to the captured Milan point (45.468503, 9.1824027) with a
  150km radius, which covers most of Lombardy plus some of Piemonte,
  Emilia-Romagna, Liguria, and Veneto (filtered out client-side - see
  `filters.py`).
- `--extra-points "lat,lon;lat,lon"` - additional search centers merged
  in by event GUID, for covering any gap the default radius might miss
  (e.g. Sondrio/Valtellina, near the edge of a 150km circle from Milan).
- `--force-empty` - the `run` command refuses to proceed if a fetch comes
  back with fewer than half as many events as the store's current active
  count, since that's much more likely to mean a broken scrape (stale
  `versionInfo`, expired session, a WAF block) than a real drop in
  events. Pass this flag if a genuinely smaller result is expected.
- `--headless` - opt into headless mode. Expected to fail with a 403 per
  the above; exists for re-testing if the site's bot protection ever
  changes.

## Data model

`../data/events.json`: `{"schema_version", "last_synced_at", "events": {<guid>: {...}}}`,
keyed by event GUID for O(1) upsert. Each event record: `guid, display_id,
name, activity_type (play_session|tournament), event_type_tags, series_name,
category, products, status, start_date, registration_start,
registration_end, admission, details, event_website,
third_party_registration_website, contact_email, contact_phone, venue_name,
full_address, latitude, longitude, timezone, activity_group_name,
activity_group_display_id, attributes, first_seen_at, last_seen_at,
is_active`.

Raw fields are kept close to the API's own names/values rather than
translated into presentation strings - same convention as the sibling
project's `export_static.py`; the frontend (`../app.js`) owns labels and
formatting.

## Known quirks

- **`name` is often empty.** Recurring league sessions frequently have no
  event-specific name - only the venue/store name
  (`activity_group_name`/`venue_name`). The frontend falls back through
  `name -> activity_group_name -> venue_name`.
- **Region isn't a clean field.** There's no `state`/`region` param on the
  API - only lat/long + range. Matching happens against each event's
  free-text `full_address`, which comes in at least two different
  formats:
  - `"<street>, <city>, LOMBARDIA <postal>, IT"` - region name spelled out.
  - `"<street>, <postal> <city> <PROVINCE_CODE>, ITALY"` - no region name,
    just a two-letter province code (also note: country suffix varies
    between `"IT"` and `"ITALY"`).
  In a 322-event sample, ~15% of genuine Lombardy events (Milano, Como,
  Bergamo, Lecco) only had the second format - matching on the region
  name string alone silently drops them. `filters.py` checks both.
- **`MaxRecords` isn't a hard cap** in practice - a request for 200
  returned 322 results in testing. `sync.py` defaults it generously high
  (1000) so one call covers the search radius without pagination.
- **`versionInfo.moduleVersion`/`apiVersion`** are OutSystems build-version
  stamps baked into `captured_request_template.json`. If the site
  redeploys, these could go stale and the request could start failing -
  if `run` starts erroring, run `inspect` and compare against a fresh
  capture (see "Why this needs a real browser" above for how sessions are
  bootstrapped; the live values are visible in the browser's Network tab
  under `moduleservices/moduleversioninfo` and `moduleservices/moduleinfo`
  when browsing the site directly).
