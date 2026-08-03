# VGC Tournament Extractor (tool)

Pulls completed VGC tournament results (standings + full team lists) from
[Limitless TCG](https://play.limitlesstcg.com/tournaments/completed?game=VGC)
into a local SQLite database. This is the data pipeline behind the published
site at `../` (see the [top-level README](../README.md) for how that fits
together and how the daily GitHub Action works).

Uses Limitless's official public API (no key required) rather than scraping
HTML — see https://docs.limitlesstcg.com/developer/tournaments.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Fetching data

The API is rate-limited to 50 requests/5min without a key, so fetching is
deliberately incremental and safe to re-run at any time — everything is
upserted by ID, and only tournaments still missing standings are fetched.

```bash
# Fetch recent tournaments + their standings. Defaults to the current
# regulation set (M-B) and the last 90 days. Re-run any time to pick up
# new tournaments and catch up any standings that didn't finish fetching.
.venv/bin/python cli.py sync run

# Page further back into history, beyond what's already been fetched.
# Re-run repeatedly (e.g. once a day) to gradually backfill older results.
.venv/bin/python cli.py sync backfill --pages 20

# Fetch every regulation set instead of just the current one:
.venv/bin/python cli.py sync run --format all --recent-days 365
.venv/bin/python cli.py sync backfill --format all --pages 20

# See what's been fetched so far:
.venv/bin/python cli.py sync status
```

Useful flags:
- `--format <ID>` — filter by regulation set (`M-B`, `SVI`, `SVH`, ... or
  `all`). Defaults to the latest regulation set.
- `--recent-days N` (`run` only) — how far back to page the tournament list.
- `--standings-limit N` — cap on how many tournaments' standings to fetch in
  one run, to keep a single invocation from running for hours.

## Browsing locally

```bash
.venv/bin/python cli.py serve
```

Then open http://127.0.0.1:5050 for a full server-rendered dashboard
(search/filter, expandable team lists with sprites) reading directly from
the SQLite DB — handy for exploring data that hasn't been published yet.

## Publishing to the static site

```bash
.venv/bin/python export_static.py
```

Dumps the DB into `../data/` as JSON (`tournaments.json`, `players.json`,
plus one file per tournament/player) — that's what the static site at `../`
actually reads. This runs automatically every day via the GitHub Action; run
it manually only if you want to preview a local change before it publishes.

## Data model

SQLite database at `data/limitless.db` (gitignored — never committed):
- `tournaments` — one row per tournament
- `players` — one row per player (keyed by their stable Limitless username)
- `entries` — one row per (tournament, player): placing, record, deck
- `team_pokemon` — one row per Pokémon per (tournament, player): species,
  item, ability, nature, tera type, moves

## Notes

- "Regulation Set M-B" is the current VGC format as of this writing. Older
  regulation sets have very different legal Pokémon, so team data across
  formats isn't directly comparable — hence the format filter everywhere.
- Some tournaments use `CUSTOM` rules (not a standard regulation set) and
  will show up as such.
- Not every tournament has a Pokémon submitted per player, or a team list at
  all (e.g. the organizer didn't require decklist submission, or a player
  didn't finish) — those show up as fewer than 6 Pokémon or no team at all.
