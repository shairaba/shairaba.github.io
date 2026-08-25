"""Turns a raw response blob (the shape console_script.js downloads -
{"data": {"EventList": {"List": [...]}}}, same envelope api.parse_event_list
already expects) into the same normalize -> filter -> upsert -> save
pipeline sync.py's Playwright-driven cmd_run uses, so the two ingestion
paths converge on identical store semantics."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from . import api, filters, store

# Mirrors sync.py's MIN_FETCH_RATIO - a fetch far smaller than what's
# already active is much more likely a broken/partial scrape than a real
# drop in events.
MIN_FETCH_RATIO = 0.5


class SuspiciousEmptyFetchError(RuntimeError):
    pass


def normalize_and_filter(raw_response: dict) -> list[dict]:
    normalized = []
    for raw in api.parse_event_list(raw_response):
        event = api.normalize_event(raw)
        if event is None:
            continue
        if not filters.matches_italy(event["full_address"]):
            continue
        normalized.append(event)
    return normalized


def ingest(raw_response: dict, store_path: Path, force_empty: bool = False) -> store.UpsertStats:
    events = normalize_and_filter(raw_response)

    data = store.load_store(store_path)
    active_count = sum(1 for e in data["events"].values() if e.get("is_active", True))

    if active_count > 0 and len(events) < active_count * MIN_FETCH_RATIO and not force_empty:
        raise SuspiciousEmptyFetchError(
            f"Parsed only {len(events)} events, but the store currently has {active_count} active - "
            "this looks like a broken/partial console-script run rather than a real drop in events."
        )

    run_at = datetime.now(timezone.utc).isoformat()
    stats = store.upsert_events(data, events, run_at)
    store.save_store(store_path, data)
    return stats
