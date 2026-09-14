# VGC Locals Italia

Live site: https://shairaba.github.io/vgc-locals-italia/

A results browser and pikalytics-style usage dashboard for **Italian VGC
local tournaments**, starting from regulation M-C. Unlike
[`vgc-tournament-explorer`](../vgc-tournament-explorer), which auto-scrapes
full-field results from Limitless TCG and pokestats.top, this app's data is
**manually submitted by tournament organizers** (via
[`submit.html`](submit.html), which posts straight to a Google Form/Sheet
behind the scenes), and only covers each event's **top cut** (top 2, 4, or 8,
depending on turnout - never the full entrant field) as a bare 6-species team
(no items, moves, abilities, or EVs).

## Read this before trusting the numbers

- **Top-cut usage, not full-field meta usage.** "43% usage" here means "in
  43% of top-cut teams across every local counted," not "43% of everyone who
  entered." A single 4-player top cut swings ~25% per player, which is why
  the dashboard's primary view pools every submitted local together rather
  than showing any one event's stats in isolation.
- **Manually entered, so it can be incomplete or wrong.** A TO could skip a
  player, mistype a placement, or simply never submit their event. There's
  no independent verification against an official bracket.
- **Small dataset.** Every tournament contributes at most 8 rows, so the
  totals here will be far smaller than a scraped-majors dataset for a long
  time.

## Pages

- **Tournaments** (`index.html`) - searchable/filterable (by name, VG
  Cup/Challenge) list of submitted locals: each card shows the tournament,
  entrant count &rarr; top cut size, and the winner's team. Click through to
  a tournament for every top-cut roster.
- **Tournament detail** (`tournament.html?id=<id>`) - every top-cut player's
  full team for one event, in placement order.
- **Dashboard** (`dashboard.html`) - the pooled, cross-tournament top-cut
  usage stats (the pikalytics-style view).
- **Submit results** (`submit.html`) - see "Submitting a tournament" below.

`app.js`, `style.css` are shared across all four pages (a static, backend-free
frontend, same convention as every other app in this repo: fetches `data/`
client-side and renders it, no server, no build step).

## How the data pipeline works

- `data/dashboard.json` - the overall, pooled-across-all-tournaments usage
  aggregate. `data/tournaments.json` - the lightweight index the
  Tournaments page renders (includes each tournament's winner + team so
  that page needs only one fetch). `data/tournaments/<id>.json` - full
  detail per tournament (every roster), fetched on demand by the detail
  page.
- `tool/` - the Python pipeline that produces `data/`: `ingest.py` fetches
  the Google Form's linked Sheet (published to web as CSV - a public,
  unauthenticated URL, no API credentials needed), validates each row's 6
  species against `species_reference.py`'s fixed list, groups rows by
  tournament, and writes the JSON above. See
  [`tool/README.md`](tool/README.md) for local run instructions, the Google
  Form/Sheet setup steps, and how to configure `submit.html`.
- `.github/workflows/update-vgc-locals-italia-data.yml` (repo root) - runs
  daily, re-ingests the Sheet, and pushes any changes to `data/`. Trigger it
  manually from the Actions tab any time via "Run workflow".

## Submitting a tournament

TOs use [`submit.html`](submit.html): enter the tournament once (name, date,
type, entrant count, your name), then each top-cut player's team - one card
per player, entered in their actual finishing order (no separate placement
field to fill in). Tournament ID and placement are filled in automatically.
The Form itself still exists as a fallback if the submission page's
unofficial submit-without-the-Form-UI trick ever breaks.
