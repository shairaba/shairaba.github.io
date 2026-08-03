"""Fetch VGC tournament data from Limitless TCG into the local SQLite DB.

Two things are fetched separately, since the API separates them:
  1. The tournament list (id, name, date, format, player count) - cheap, one
     page of up to 50 covers many tournaments.
  2. Standings/decklists per tournament - one request per tournament, and
     what most of the rate-limit budget goes toward.

Designed to be re-run repeatedly: everything is upserted by ID, so re-running
`list` just refreshes recent entries, and `standings` only fetches
tournaments that don't have standings yet.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from . import db
from . import pokestats as ps
from .api_client import RateLimitedClient
from .formats import FORMAT_LABELS, LATEST_FORMAT, format_label

GAME = "VGC"  # game param the Limitless API itself expects, unrelated to tournaments.game (source)
SOURCE = "limitless"


def _normalize_format(value: str | None) -> str | None:
    """--format all means no server-side filter; anything else is passed through."""
    if value is None or value.lower() == "all":
        return None
    return value


def _parse_date(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def fetch_list(conn, client: RateLimitedClient, start_page: int, max_pages: int | None,
                recent_days: int | None, format: str | None) -> int:
    """Page through the tournament list, upserting each tournament.

    Stops when: max_pages is reached, an empty page is returned (end of
    history), or (if recent_days is set) a tournament older than the cutoff
    is seen. `format` is passed straight to the API (server-side filter);
    None/"all" means every regulation set.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=recent_days) if recent_days else None
    page = start_page
    total = 0
    while True:
        if max_pages is not None and (page - start_page) >= max_pages:
            print(f"  reached page limit ({max_pages} pages)")
            break

        data = client.list_tournaments(game=GAME, format=format, page=page, limit=50)
        if not data:
            print(f"  page {page} empty, end of history")
            break

        stop = False
        for t in data:
            db.upsert_tournament(conn, {**t, "game": SOURCE})
            total += 1
            if cutoff and _parse_date(t["date"]) < cutoff:
                stop = True
        conn.commit()
        db.set_sync_state(conn, "deepest_page", str(page))
        newest = data[0]["date"][:10]
        oldest = data[-1]["date"][:10]
        print(f"  page {page}: {len(data)} tournaments ({oldest} .. {newest})")

        if stop:
            print(f"  reached cutoff ({recent_days} days), stopping list fetch")
            break
        page += 1

    return total


def fetch_standings(conn, client: RateLimitedClient, limit: int) -> int:
    rows = db.tournaments_missing_standings(conn, limit)
    if not rows:
        print("  nothing to fetch, all known tournaments already have standings")
        return 0
    print(f"  fetching standings for {len(rows)} tournament(s)...")
    fetched = 0
    for i, row in enumerate(rows, 1):
        try:
            standings = client.tournament_standings(row["id"])
        except Exception as exc:  # noqa: BLE001 - report and keep going
            print(f"  [{i}/{len(rows)}] {row['name'][:45]:45} FAILED: {exc}")
            continue
        db.save_standings(conn, row["id"], standings)
        fetched += 1
        print(f"  [{i}/{len(rows)}] {row['name'][:45]:45} players={len(standings)}")
    return fetched


def cmd_run(args, conn, client) -> None:
    fmt = _normalize_format(args.format)
    print(f"Fetching tournament list (recent {args.recent_days} days, format={format_label(fmt) if fmt else 'all'})...")
    fetch_list(conn, client, start_page=1, max_pages=args.pages, recent_days=args.recent_days, format=fmt)
    print("Fetching standings for tournaments missing them...")
    fetch_standings(conn, client, limit=args.standings_limit)


def cmd_backfill(args, conn, client) -> None:
    fmt = _normalize_format(args.format)
    deepest = int(db.get_sync_state(conn, "deepest_page") or "0")
    start_page = max(1, deepest - 1)  # small overlap to cover shifting pagination
    print(f"Backfilling tournament list from page {start_page} ({args.pages} pages, "
          f"format={format_label(fmt) if fmt else 'all'})...")
    fetch_list(conn, client, start_page=start_page, max_pages=args.pages, recent_days=None, format=fmt)
    print("Fetching standings for newly discovered tournaments...")
    fetch_standings(conn, client, limit=args.standings_limit)


def cmd_standings(args, conn, client) -> None:
    fetch_standings(conn, client, limit=args.limit)


def cmd_pokestats(args, conn, client) -> None:
    ps_client = ps.PokestatsClient()
    regs = ps_client.list_regs()
    print(f"Found {len(regs)} regulation set(s) on pokestats.top")
    for r in regs:
        reg = r["reg"]
        fmt = ps.REG_TO_FORMAT.get(reg)
        if fmt is None:
            print(f"  {reg}: unrecognized reg, skipping")
            continue
        tournaments = ps_client.list_tournaments(reg)
        for t in tournaments:
            db.upsert_tournament(conn, ps.translate_tournament(reg, t))
        conn.commit()
        print(f"  {reg} ({fmt}): {len(tournaments)} tournaments")

    rows = conn.execute(
        "SELECT id FROM tournaments WHERE game = 'pokestats' AND standings_fetched = 0"
    ).fetchall()
    print(f"Fetching standings for {len(rows)} pokestats.top tournament(s)...")
    for i, row in enumerate(rows, 1):
        native_id = row["id"].removeprefix("pokestats_")
        try:
            raw_standings = ps_client.standings(native_id)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}/{len(rows)}] {native_id} FAILED: {exc}")
            continue
        standings = ps.translate_standings(native_id, raw_standings)
        db.save_standings(conn, row["id"], standings)
        print(f"  [{i}/{len(rows)}] {native_id} players={len(standings)}")


def cmd_status(args, conn, client) -> None:
    s = db.status(conn)
    print("Sync status")
    print(f"  tournaments known:          {s['tournaments_known']}")
    print(f"  tournaments with standings: {s['tournaments_with_standings']}")
    print(f"  players seen:               {s['players']}")
    print(f"  tournament entries:         {s['entries']}")
    print(f"  standings date range:       {s['oldest_fetched']}  ..  {s['newest_fetched']}")
    print(f"  deepest list page paged:    {s['deepest_page_paged']}")
    print("  by source/format:")
    for row in db.status_by_format(conn):
        label = format_label(row["format"])
        print(f"    {row['game'] or '(none)':10} {row['format'] or '(none)':10} {label:14} {row['count']}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Limitless TCG VGC tournament extractor")
    sub = parser.add_subparsers(dest="command", required=True)

    format_help = ("regulation set to filter by, e.g. " + ", ".join(FORMAT_LABELS) +
                   ", or 'all' for every format. Defaults to the latest (" + LATEST_FORMAT + ").")

    p_run = sub.add_parser("run", help="Fetch recent tournaments and their standings (safe to re-run)")
    p_run.add_argument("--recent-days", type=int, default=90, help="how far back to page the list")
    p_run.add_argument("--pages", type=int, default=None, help="cap on list pages fetched this run")
    p_run.add_argument("--standings-limit", type=int, default=200,
                        help="max tournaments to fetch standings for this run")
    p_run.add_argument("--format", type=str, default=LATEST_FORMAT, help=format_help)
    p_run.set_defaults(func=cmd_run)

    p_backfill = sub.add_parser("backfill", help="Page further back into history, beyond what's been fetched")
    p_backfill.add_argument("--pages", type=int, default=20, help="how many additional list pages to fetch")
    p_backfill.add_argument("--standings-limit", type=int, default=200,
                             help="max tournaments to fetch standings for this run")
    p_backfill.add_argument("--format", type=str, default=LATEST_FORMAT, help=format_help)
    p_backfill.set_defaults(func=cmd_backfill)

    p_standings = sub.add_parser("standings", help="Fetch standings for tournaments still missing them")
    p_standings.add_argument("--limit", type=int, default=200)
    p_standings.set_defaults(func=cmd_standings)

    p_status = sub.add_parser("status", help="Show how much data has been fetched so far")
    p_status.set_defaults(func=cmd_status)

    p_pokestats = sub.add_parser(
        "pokestats",
        help="Fetch Pokemon Champions tournaments from pokestats.top (Battlefy Victory Road). "
        "Small dataset (~100 tournaments total) - fetches everything in one run, safe to re-run.",
    )
    p_pokestats.set_defaults(func=cmd_pokestats)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    conn = db.get_connection()
    db.init_db(conn)
    client = RateLimitedClient()

    args.func(args, conn, client)


if __name__ == "__main__":
    main()
