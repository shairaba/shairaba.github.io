"""Orchestration: fetch -> normalize -> filter -> upsert -> save."""

from __future__ import annotations

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


class SuspiciousEmptyFetchError(RuntimeError):
    pass


def fetch_lombardy_events(
    search: SearchParams,
    max_records: int = DEFAULT_MAX_RECORDS,
    headless: bool = False,
    extra_points: list[tuple[str, str]] | None = None,
) -> list[dict]:
    """Fetch + normalize + filter, optionally merging extra search points
    (by GUID) to cover coverage gaps a single radius might miss."""
    all_normalized: dict[str, dict] = {}

    search_points = [(search.latitude, search.longitude)] + (extra_points or [])
    with PokemonEventLocatorClient(headless=headless) as client:
        for latitude, longitude in search_points:
            point_search = SearchParams(
                latitude=latitude,
                longitude=longitude,
                range_km=search.range_km,
                start_date=search.start_date,
                filters=search.filters,
                locale=search.locale,
            )
            client.bootstrap(point_search)
            payload = api.build_payload(point_search, max_records=max_records)
            response = client.post_json(payload)
            raw_events = api.parse_event_list(response)

            distinct_states = sorted({(e.get("Address") or {}).get("Full_address", "").split(",")[-1].strip() for e in raw_events})
            print(f"  [{latitude},{longitude}] fetched {len(raw_events)} raw events. Country suffixes seen: {distinct_states}")

            for raw in raw_events:
                normalized = api.normalize_event(raw)
                if normalized is None:
                    continue
                if not filters.matches_lombardy(normalized["full_address"]):
                    continue
                all_normalized[normalized["guid"]] = normalized

    return list(all_normalized.values())


def cmd_run(args) -> None:
    search = SearchParams(
        latitude=args.latitude,
        longitude=args.longitude,
        range_km=args.range_km,
        start_date=date.today().isoformat(),
        filters=args.filters,
    )
    extra_points = None
    if args.extra_points:
        extra_points = []
        for pair in args.extra_points.split(";"):
            lat, lon = pair.split(",")
            extra_points.append((lat.strip(), lon.strip()))

    print("Fetching Lombardy events...")
    events = fetch_lombardy_events(
        search, max_records=args.max_records, headless=args.headless, extra_points=extra_points
    )
    print(f"Kept {len(events)} events matching Lombardy after filtering.")

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
