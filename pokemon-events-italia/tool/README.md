# Pokemon Event Scraper (tool)

Pulls upcoming Pokemon events (Video Game/VGC, TCG, and Pokemon GO)
nationwide across Italy from the official Pokemon Event Locator's
internal API into `../data/events.json` - the file the static site at
`../` reads.

## Why this needs your real Chrome profile

`events.pokemon.com` is protected by Imperva/Incapsula plus an
Akamai-style bot sensor (`reese84` cookie). Getting a fully automated
scraper working here took real live testing to nail down - the site's
own bootstrap API call kept 403'ing regardless of headed/headless mode,
regardless of using the real Google Chrome binary (`channel="chrome"`),
regardless of IP (residential or a GitHub Actions datacenter runner).

**The one thing that reliably works: driving a copy of this machine's
own, organically-aged Chrome profile**, not a fresh automation profile -
even with the exact same Chrome binary and headed settings. A brand-new
profile with zero history looks synthetic to whatever heuristic is
scoring these sessions; a real one doesn't. `chrome_profile.py` copies
just the session-relevant files (cookies, local storage, preferences -
not the multi-GB full profile) from `~/Library/Application
Support/Google/Chrome/Default` into `tool/.chrome-profile/`, and
`browser_client.py` drives that copy via
`launch_persistent_context(channel="chrome")`.

Even with a real profile, the site's session-level challenge doesn't
pass 100% of the time - this is natural variance, not something wrong
with the approach - so `PokemonEventLocatorClient.bootstrap()` retries
with growing backoff (4 attempts, 8s/16s/24s) before giving up.

Once bootstrapped, the actual API calls are cheap in-page `fetch()`
calls via `page.evaluate()` (not a Playwright `APIRequestContext`, which
doesn't share Chromium's own TLS/HTTP2 fingerprint) - confirmed live
that the **same session can be reused for many queries** (different
lat/long, different game filters) without re-navigating, which is why a
full nationwide, all-games sync is a couple dozen lightweight calls
after one bootstrap, not dozens of page loads.

**This is why there's no GitHub Actions workflow scraping on a
schedule** (unlike the sibling `vgc-tournament-explorer/`) - a CI runner
has no organically-aged browser profile to copy from, and this was
confirmed live (403s regardless of headed/headless, real Chrome binary,
or IP - residential or GitHub Actions datacenter). A self-hosted Actions
runner doesn't help either: it would need to be *this* machine anyway,
running whenever the schedule fires, which is the same constraint as
running locally in the first place.

### Local auto-run (`auto_run.py` + `launchd`)

Since this machine isn't reliably on/awake at a fixed hour, scraping is
triggered by *login* instead of a fixed clock time -
`~/Library/LaunchAgents/com.shairaba.pokemon-events-italia-autorun.plist`
runs `auto_run.py` on every login (`RunAtLoad`) plus once daily at 10:00
as a backup for whenever the machine happens to already be awake then
(`StartCalendarInterval`). `auto_run.py` checks `data/events.json`'s
`last_synced_at` and only actually invokes `cli.py run` if it's more
than 20h stale, so logging in several times a day doesn't re-trigger the
real-Chrome bootstrap more than once. On a successful run it also commits
and pushes `data/events.json` itself, unattended - no review step. This
was a deliberate choice after cloud alternatives (a custom Apify actor,
Oracle Cloud's Always Free tier) both hit real friction - Apify's shared
IPs likely being flagged by Incapsula independently of the profile
transplant, Oracle's signup fighting a false duplicate-account flag - so
this fell back to the one thing already known to work reliably: this
machine, own profile, but now fully hands-off. The commit step only ever
touches `data/events.json` via a pathspec on `git commit` (never `git add
-A`/`commit -a`), so it can't sweep up unrelated in-progress changes
elsewhere in this monorepo, and `cli.py run`'s own `SuspiciousEmptyFetchError`
already refuses to write the store at all on a fetch that looks broken -
there's nothing bad here to accidentally publish. Output/errors land in
`tool/data/raw/auto_run.log` (gitignored).

Manage the agent with:
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.shairaba.pokemon-events-italia-autorun.plist  # load
launchctl bootout gui/$(id -u)/com.shairaba.pokemon-events-italia-autorun                                  # unload
launchctl list com.shairaba.pokemon-events-italia-autorun                                                  # check status/last exit code
```

If the machine is fully shut down (not just asleep) at login time, this
still won't fire until the next login - there's no software-only way to
make macOS power itself on for this. You can still always run `cli.py
run` by hand any time, as before.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m playwright install chromium
```

Requires the real Google Chrome browser installed on this machine
(`channel="chrome"` - not the Playwright-bundled Chromium used for
`--headless` testing).

## Commands

```bash
# Fetch every game (vg/tcg/pgo) across nationwide anchor points, filter
# to Italy, and upsert into ../data/events.json. Safe to re-run any time
# - events missing from a fresh fetch are marked inactive (not deleted),
# so history isn't lost when an event's date passes.
.venv/bin/python cli.py run

# See what's currently in the store (counts, by region, by game).
.venv/bin/python cli.py status

# Fire one raw request (single point, single game) and dump the response
# to tool/data/raw/ for manual inspection, without touching the store -
# useful if the site's response shape ever changes and `run` starts
# erroring.
.venv/bin/python cli.py inspect

# Re-copy session state from the real local Chrome profile. Run this if
# `run` starts failing to bootstrap even after its built-in retries.
.venv/bin/python cli.py refresh-profile
```

Useful flags on `run`:
- `--filters vg,tcg,pgo` - which games to query (default: all three).
- `--range-km` - search radius per anchor point (default 150km).
- `--points "lat,lon;lat,lon"` - override the built-in nationwide anchor
  points (`sync.ITALY_SEARCH_POINTS`, one per major metro area/region)
  with your own, for a targeted re-run instead of a full nationwide sync.
- `--force-empty` - the `run` command refuses to proceed if a fetch comes
  back with fewer than half as many events as the store's current active
  count, since that's much more likely to mean a broken scrape (stale
  `versionInfo`, expired session, a WAF block) than a real drop in
  events. Pass this flag if a genuinely smaller result is expected.
- `--headless` - opt into headless mode. Never once gotten past the
  site's WAF in testing, regardless of profile; exists for re-testing if
  the site's bot protection ever changes.

If live automation is ever blocked again (IP reputation, a bot-detection
change, etc.), the fallback that's actually been used to seed real data
in this project is a browser-console script run by hand in a real
Chrome tab - ask for one to be regenerated if needed; it mirrors
`api.py`'s payload builder and loops the same nationwide points/games.

## Data model

`../data/events.json`: `{"schema_version", "last_synced_at", "events": {<guid>: {...}}}`,
keyed by event GUID for O(1) upsert, minified (not pretty-printed) since
this file is fetched directly by real visitors' browsers at nationwide
scale. Each event record: `guid, display_id, name, activity_type
(play_session|tournament), event_type_tags, series_name, category,
products (vg/tcg/pgo), status, start_date, registration_start,
registration_end, admission, details, event_website,
third_party_registration_website, contact_email, contact_phone,
venue_name, full_address, region, latitude, longitude, timezone,
activity_group_name, activity_group_display_id, attributes,
first_seen_at, last_seen_at, is_active`.

Raw fields are kept close to the API's own names/values rather than
translated into presentation strings - same convention as the sibling
project's `export_static.py`; the frontend (`../app.js`) owns labels and
formatting.

## Known quirks

- **The game filter needs two fields set together.** `screenData.variables.filters`
  alone does *not* change which game's events come back - the request
  also needs the matching entry in
  `LocationFilters.ProductTypes.List[].IsSelected` flipped, or the server
  silently keeps returning whatever the template's original selection
  was (caught live: querying "vg", "tcg", and "pgo" all returned the
  identical count until this was fixed). `api.py::build_payload` sets
  both.
- **`name` is often empty.** Recurring league sessions frequently have no
  event-specific name - only the venue/store name
  (`activity_group_name`/`venue_name`). The frontend falls back through
  `name -> activity_group_name -> venue_name`.
- **There's no reliable region/state field to filter on - but the
  country marker is reliable.** The API has no country/region param at
  all, only lat/long + range, so nationwide coverage also reaches into
  Switzerland/France/Germany/Austria near the borders.
  `filters.matches_italy()` deliberately just checks whether the address
  ends in `", IT"` or `", ITALY"` - simpler than parsing out a
  region/province, and it turned out to be *more* reliable: verified
  against a real nationwide sample, every genuinely foreign address ended
  in its own country's marker, while every real Italian address ended in
  the Italy marker even when the region/province portion was missing,
  misspelled, or a data-quality placeholder on the source's end (literal
  "ITALIA"/"ITALY" or "---------" where a real province should be).
  `region_from_address()` is separate best-effort enrichment for the
  stored `region` field (not a gate), checked three ways - spelled-out
  region name, spelled-out province *name*, or a bare two-letter province
  *code* - and returns `None` for the small fraction of addresses (~1.4%
  in testing) that don't resolve any of the three. Province-name matching
  is deliberately restricted to the address minus its first (street)
  segment, since a blanket whole-address search would false-positive on
  a street literally called "Via Roma" or "Corso Torino" in a town
  nowhere near either place.
- **`MaxRecords` isn't a hard cap** in practice - a request for 200
  returned 322 results in testing. `sync.py` defaults it generously high
  (1000) so one call covers the search radius without pagination.
- **`versionInfo.moduleVersion`/`apiVersion`** are OutSystems build-version
  stamps baked into `captured_request_template.json`. If the site
  redeploys, these could go stale and the request could start failing -
  if `run` starts erroring, run `inspect` and compare against a fresh
  capture (the live values are visible in the browser's Network tab
  under `moduleservices/moduleversioninfo` and `moduleservices/moduleinfo`
  when browsing the site directly).
