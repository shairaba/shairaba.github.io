"""Flat JSON storage for scraped events.

A flat JSON file (keyed by event GUID) rather than SQLite: the event
entity has no relational structure to model (unlike the sibling
vgc-tournament-explorer's tournaments/entries/team_pokemon), the dataset is
small (hundreds, not thousands, of rows), and JSON is already the exact
shape the static visualizer needs - skipping a separate DB-to-JSON export
step entirely.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import NamedTuple

SCHEMA_VERSION = 1


class UpsertStats(NamedTuple):
    added: int
    updated: int
    unchanged: int
    marked_inactive: int


def load_store(path: Path) -> dict:
    if not path.exists():
        return {"schema_version": SCHEMA_VERSION, "last_synced_at": None, "events": {}}
    return json.loads(path.read_text())


def save_store(path: Path, store: dict) -> None:
    """Atomic write (temp file + os.replace) - there's no WAL/journal safety
    net the way SQLite has, so a crash mid-write must not corrupt the file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, prefix=".events-", suffix=".json.tmp")
    try:
        with os.fdopen(fd, "w") as f:
            # Minified, not pretty-printed: this file is fetched directly by
            # real visitors' browsers (no separate export/build step), and
            # at nationwide scale (thousands of events) indent=2 roughly
            # doubles the download size for no benefit to them. sort_keys
            # still keeps regenerated diffs reviewable.
            json.dump(store, f, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
        os.replace(tmp_path, path)
    except BaseException:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def upsert_events(store: dict, fetched_events: list[dict], run_at: str) -> UpsertStats:
    """Upsert by GUID. Events previously stored but absent from this run's
    fetch are marked inactive rather than deleted, so re-running never loses
    history (most commonly: an event's date passed and it naturally dropped
    out of the "upcoming" search - expected, not an error)."""
    events = store.setdefault("events", {})
    fetched_guids = {e["guid"] for e in fetched_events}

    added = updated = unchanged = 0
    for event in fetched_events:
        guid = event["guid"]
        existing = events.get(guid)
        if existing is None:
            events[guid] = {**event, "first_seen_at": run_at, "last_seen_at": run_at, "is_active": True}
            added += 1
        else:
            content_changed = any(existing.get(k) != v for k, v in event.items())
            events[guid] = {
                **existing,
                **event,
                "first_seen_at": existing.get("first_seen_at", run_at),
                "last_seen_at": run_at,
                "is_active": True,
            }
            updated += 1 if content_changed else 0
            unchanged += 0 if content_changed else 1

    marked_inactive = 0
    for guid, existing in events.items():
        if guid not in fetched_guids and existing.get("is_active", True):
            existing["is_active"] = False
            marked_inactive += 1

    store["schema_version"] = SCHEMA_VERSION
    store["last_synced_at"] = run_at
    return UpsertStats(added=added, updated=updated, unchanged=unchanged, marked_inactive=marked_inactive)
