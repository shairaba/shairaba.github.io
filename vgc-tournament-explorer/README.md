# VGC Tournament Explorer

Live site: https://shairaba.github.io/vgc-tournament-explorer/

Browse completed [Limitless TCG](https://play.limitlesstcg.com/tournaments/completed?game=VGC)
VGC tournaments, grouped by tournament or by player, with the full team
(species, item, ability, nature, tera type, moves, and sprites) each player
brought.

## How it works

- `index.html`, `tournaments.html`, `tournament.html`, `players.html`,
  `player.html`, `app.js`, `style.css` — a static, backend-free frontend.
  Every page fetches plain JSON from `data/` client-side and renders it — no
  server, no build step, just files GitHub Pages serves as-is.
- `data/` — the published dataset: `tournaments.json` and `players.json`
  (lightweight indexes powering the searchable list pages) plus one JSON
  file per tournament (`data/tournaments/<id>.json`) and per player
  (`data/players/<player_key>.json`) fetched on demand for detail pages.
- `tool/` — the Python pipeline that produces `data/`: fetches from
  Limitless's public tournament API into a local SQLite DB, then
  `export_static.py` dumps that DB into the JSON files above. See
  [`tool/README.md`](tool/README.md) for local usage.
- `.github/workflows/update-vgc-data.yml` (repo root) — runs daily: restores
  the SQLite DB from a GitHub Actions cache, syncs recent tournaments plus a
  batch of older history, re-exports `data/`, and pushes the changes. This
  is what keeps the published site growing without anyone running anything
  locally. Trigger it manually from the Actions tab any time via "Run
  workflow" (`workflow_dispatch`).

## Notes

- Only "Regulation Set M-B" (the current format) is fetched by default —
  see `tool/README.md` for fetching other regulation sets.
- The DB itself never touches git (it's cached between Action runs via
  `actions/cache`); only the exported JSON in `data/` is committed, since
  that's the actual published content.
- `data/` will keep growing as more tournaments get backfilled — each
  tournament/player's team data is small, but at scale (thousands of
  tournaments, tens of thousands of players) this could become a
  non-trivial chunk of repo size. Not a problem at current scale; worth
  revisiting (e.g. deduping team data between the tournament and player
  exports) if it ever becomes one.
