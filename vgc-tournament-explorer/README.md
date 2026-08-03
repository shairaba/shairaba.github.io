# VGC Tournament Explorer

Live site: https://shairaba.github.io/vgc-tournament-explorer/

Browse completed VGC tournaments from two sources - [Limitless
TCG](https://play.limitlesstcg.com/tournaments/completed?game=VGC) and
[pokestats.top](https://pokestats.top/championships/) (Battlefy Victory
Road) - grouped by tournament or by player, with the full team (species,
item, ability, nature, tera type, moves, and sprites) each player brought,
plus a dashboard of usage stats and results across the whole dataset.

## Pages

- **Home** — stats, recent tournaments, most active players, and a "recent
  major winners" grid (last 30 days, sorted by turnout, each showing the
  winner's team).
- **Tournaments** — searchable/filterable list (name, format, date range,
  minimum player count) linking to per-tournament standings.
- **Players** — searchable/filterable list linking to a player's full
  tournament history and the team they brought each time.
- **Dashboard** — per-format: most-used Pokémon (usage %), most common
  2-Pokémon cores, and a best-finishes leaderboard (wins / top 4 / top 8).

## How it works

- `index.html`, `tournaments.html`, `tournament.html`, `players.html`,
  `player.html`, `dashboard.html`, `app.js`, `style.css` — a static,
  backend-free frontend. Every page fetches plain JSON from `data/`
  client-side and renders it — no server, no build step, just files GitHub
  Pages serves as-is.
- `data/` — the published dataset: `tournaments.json` and `players.json`
  (lightweight indexes powering the searchable list pages), `dashboard.json`
  (per-format aggregates for the Dashboard page), plus one JSON file per
  tournament (`data/tournaments/<id>.json`) and per player
  (`data/players/<player_key>.json`) fetched on demand for detail pages.
- `tool/` — the Python pipeline that produces `data/`: fetches from
  Limitless's public tournament API and pokestats.top's (undocumented,
  reverse-engineered - see `tool/pokestats_api_reference.json`) tournament
  API into one local SQLite DB, then `export_static.py` dumps that DB into
  the JSON files above. See [`tool/README.md`](tool/README.md) for local
  usage.
- `.github/workflows/update-vgc-data.yml` (repo root) — runs daily: restores
  the SQLite DB from a GitHub Actions cache, syncs recent + backfilled
  Limitless tournaments and all pokestats.top tournaments, re-exports
  `data/`, and pushes the changes. This is what keeps the published site
  growing without anyone running anything locally. Trigger it manually from
  the Actions tab any time via "Run workflow" (`workflow_dispatch`).

## Regulation sets and games

The regulation letter alone determines which game a tournament is for - the
same lettering scheme is reused across three different games' history, not
three parallel per-game schemes (see `tool/limitless_extractor/formats.py`):

- **M-A, M-B** — Pokemon Champions (Mega Evolutions)
- **A through I** (23S1-23S3, SVE-SVI, VGC23) — Scarlet & Violet
- **Series 12** (VGC22) — Sword & Shield

This holds regardless of source: Limitless's own "M-B" tournaments and
pokestats.top's "M-B" tournaments are the same ruleset and are shown
together under one "Reg M-B" badge. Which *site* a tournament came from is
tracked separately (`tournaments.game` = `"limitless"` or `"pokestats"`) —
that's a technical detail for sprite-CDN selection only (Limitless's own CDN
has no Mega-Evolution sprites), not something surfaced in the UI.

## Notes

- Only the current regulation set (M-B) is fetched from Limitless by
  default — see `tool/README.md` for fetching other regulation sets.
  pokestats.top's full dataset (~120 tournaments across all regs) is small
  enough to fetch entirely every run.
- The DB itself never touches git (it's cached between Action runs via
  `actions/cache`); only the exported JSON in `data/` is committed, since
  that's the actual published content.
- Player identity is **not** unified across sources — a Limitless username
  and a pokestats/Battlefy player ID are different identity spaces with no
  way to cross-reference, so the same real person playing on both platforms
  shows up as two separate player pages. pokestats' own IDs also aren't
  always stable (some tournaments only expose a raw display name, which can
  collide or contain unusual characters) — see `pokestats_api_reference.json`
  for the details and how that's handled.
- `data/` will keep growing as more tournaments get backfilled. Player pages
  intentionally only embed lightweight sprite info (not full item/ability/
  moves) to avoid duplicating what's already in the tournament's own export;
  the full team is lazy-fetched from the tournament file when a row is
  expanded.
- A handful of big crossover events (charity tournaments, majors) get
  tracked independently by both Limitless and pokestats.top, landing as two
  separate rows for the same real tournament. `export_static.py` detects
  these (matching format + date + player count + name) and drops the
  pokestats copy from published output/aggregates, preferring Limitless's
  version. The DB itself keeps both rows untouched - this is purely an
  export-time presentation choice.
