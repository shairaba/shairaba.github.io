"""Orchestration: fetch -> normalize -> filter -> upsert -> save.

Coverage is nationwide by default: a fixed set of anchor points (one per
major metro area, roughly one per region) each searched with a 150km
radius, which together cover all 20 Italian regions with comfortable
overlap. Each point is queried once per game (video game / TCG / Pokemon
GO) - all within a *single* bootstrapped browser session (one navigation,
reused for every subsequent query), since testing confirmed the same
session can be reused for different lat/long and different product
filters without re-navigating. This keeps a full nationwide, all-games
sync to a couple dozen lightweight API calls instead of dozens of full
page loads.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timezone
from pathlib import Path

from . import api, filters, store
from .browser_client import PokemonEventLocatorClient, SearchParams

DEFAULT_STORE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "events.json"

# The site's own "load more" MaxRecords param doesn't appear to be a strict
# cap in practice (a request for 200 returned 322) - set generously high so
# one call covers the whole search radius rather than needing pagination.
DEFAULT_MAX_RECORDS = 1000

# Below this fraction of the store's current active count, a fetch is
# treated as suspiciously empty (likely a broken scrape - stale version
# info, expired session, WAF block) rather than a legitimate small result,
# and refuses to mass-deactivate everything without --force-empty.
MIN_FETCH_RATIO = 0.5

# Be a reasonable citizen toward the target site between queries within a
# session - these are cheap in-page fetch() calls, not full navigations,
# but there's no reason to hammer them back-to-back either.
QUERY_DELAY_SECONDS = 1.5

GAME_FILTERS = ["vg", "tcg", "pgo"]

# One anchor point per major metro area - together these cover all 20
# Italian regions at a 150km radius with comfortable overlap. A few
# (Bolzano, Trieste) sit close to a border on purpose, since a smaller
# radius from those anchors would otherwise leave a gap at the edge of the
# country - matches_italy() filters out whatever spillover into
# Switzerland/Austria/France/Slovenia that causes.
ITALY_SEARCH_POINTS = [
    ("Milano", "45.4642", "9.1900"),
    ("Torino", "45.0703", "7.6869"),
    ("Genova", "44.4056", "8.9463"),
    ("Bologna", "44.4949", "11.3426"),
    ("Venezia", "45.4408", "12.3155"),
    ("Bolzano", "46.4983", "11.3548"),
    ("Firenze", "43.7696", "11.2558"),
    ("Roma", "41.9028", "12.4964"),
    ("Napoli", "40.8518", "14.2681"),
    ("Bari", "41.1171", "16.8719"),
    ("Reggio Calabria", "38.1113", "15.6619"),
    ("Palermo", "38.1157", "13.3615"),
    ("Catania", "37.5079", "15.0830"),
    ("Cagliari", "39.2238", "9.1217"),
]


class SuspiciousEmptyFetchError(RuntimeError):
    pass


def fetch_italy_events(
    range_km: str,
    start_date: str,
    game_filters: list[str],
    max_records: int = DEFAULT_MAX_RECORDS,
    headless: bool = False,
    search_points: list[tuple[str, str, str]] | None = None,
) -> list[dict]:
    """Fetch + normalize + filter across every (point x game) combination,
    merged by GUID. `search_points` is a list of (label, lat, lon)."""
    points = search_points if search_points is not None else ITALY_SEARCH_POINTS
    all_normalized: dict[str, dict] = {}

    with PokemonEventLocatorClient(headless=headless) as client:
        first_label, first_lat, first_lon = points[0]
        bootstrap_search = SearchParams(
            latitude=first_lat, longitude=first_lon, range_km=range_km,
            start_date=start_date, filters=game_filters[0],
        )
        print(f"Bootstrapping session at {first_label}...")
        client.bootstrap(bootstrap_search)
        print("Session ready.")

        total_queries = len(points) * len(game_filters)
        done = 0
        for label, lat, lon in points:
            for game in game_filters:
                done += 1
                search = SearchParams(latitude=lat, longitude=lon, range_km=range_km, start_date=start_date, filters=game)
                payload = api.build_payload(search, max_records=max_records)
                response = client.post_json(payload)
                raw_events = api.parse_event_list(response)

                kept = 0
                for raw in raw_events:
                    normalized = api.normalize_event(raw)
                    if normalized is None:
                        continue
                    if not filters.matches_italy(normalized["full_address"]):
                        continue
                    all_normalized[normalized["guid"]] = normalized
                    kept += 1

                print(f"  [{done}/{total_queries}] {label} / {game}: {len(raw_events)} raw, {kept} kept")
                if done < total_queries:
                    time.sleep(QUERY_DELAY_SECONDS)

    return list(all_normalized.values())


def cmd_run(args) -> None:
    game_filters = [g.strip() for g in args.filters.split(",")] if args.filters else GAME_FILTERS

    search_points = None
    if args.points:
        search_points = []
        for entry in args.points.split(";"):
            lat, lon = entry.split(",")
            search_points.append((f"{lat.strip()},{lon.strip()}", lat.strip(), lon.strip()))

    print(f"Fetching events nationwide (games: {', '.join(game_filters)})...")
    events = fetch_italy_events(
        range_km=args.range_km,
        start_date=date.today().isoformat(),
        game_filters=game_filters,
        max_records=args.max_records,
        headless=args.headless,
        search_points=search_points,
    )
    print(f"Kept {len(events)} events after filtering to Italy.")

    store_path = Path(args.out)
    data = store.load_store(store_path)
    active_count = sum(1 for e in data["events"].values() if e.get("is_active", True))

    if active_count > 0 and len(events) < active_count * MIN_FETCH_RATIO and not args.force_empty:
        raise SuspiciousEmptyFetchError(
            f"Fetched only {len(events)} events, but the store currently has {active_count} active - "
            "this looks like a broken scrape (stale versionInfo, expired session, or a WAF block) rather "
            "than a real drop in events. Re-run with --force-empty if this is expected."
        )

    run_at = datetime.now(timezone.utc).isoformat()
    stats = store.upsert_events(data, events, run_at)
    store.save_store(store_path, data)
    print(
        f"Store updated: {stats.added} added, {stats.updated} updated, "
        f"{stats.unchanged} unchanged, {stats.marked_inactive} marked inactive."
    )
    print(f"Wrote {store_path}")


def cmd_status(args) -> None:
    store_path = Path(args.out)
    data = store.load_store(store_path)
    events = data.get("events", {})
    active = [e for e in events.values() if e.get("is_active", True)]
    print("Store status")
    print(f"  path:            {store_path}")
    print(f"  last synced at:  {data.get('last_synced_at')}")
    print(f"  total tracked:   {len(events)}")
    print(f"  active:          {len(active)}")
    if active:
        dates = sorted(e["start_date"] for e in active if e.get("start_date"))
        if dates:
            print(f"  date range:      {dates[0]}  ..  {dates[-1]}")
        from collections import Counter

        regions = Counter(e.get("region") or "(unknown)" for e in active)
        print("  by region:")
        for region, count in regions.most_common():
            print(f"    {region:24} {count}")
        games = Counter()
        for e in active:
            for p in e.get("products") or []:
                games[p] += 1
        print(f"  by game:         {dict(games)}")
