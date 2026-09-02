"""One-time migration: correct every already-stored event's start_date/
registration_start/registration_end, which were saved with the same
upstream-mislabeled-as-UTC bug that pokemon_events/api.py's
_fix_mislabeled_local_time() now corrects at ingestion time going forward
(see that function's docstring for the full story). This just applies the
identical correction to what's already on disk in data/events.json, once,
so existing events don't stay wrong until they happen to get re-scraped.

Idempotency note: this is NOT safe to run twice - a record already fixed
(post-migration, or freshly scraped by the now-fixed api.py) would get
"corrected" a second time, shifting it further off. Run once, right after
deploying the api.py fix and before the next scheduled scrape.

Usage: python3 migrate_fix_timezone.py [path/to/events.json]
Defaults to data/events.json relative to this file's directory.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pokemon_events.api import DEFAULT_EVENT_TIMEZONE, _fix_mislabeled_local_time
from pokemon_events.store import load_store, save_store

DATE_FIELDS = ("start_date", "registration_start", "registration_end")


def migrate(path: Path) -> None:
    backup_path = path.with_suffix(path.suffix + ".bak")
    shutil.copy2(path, backup_path)
    print(f"Backed up {path} -> {backup_path}")

    store = load_store(path)
    events = store.get("events", {})

    changed = 0
    for event in events.values():
        tz_name = event.get("timezone") or DEFAULT_EVENT_TIMEZONE
        before = {field: event.get(field) for field in DATE_FIELDS}
        for field in DATE_FIELDS:
            event[field] = _fix_mislabeled_local_time(event.get(field), tz_name)
        if any(event[field] != before[field] for field in DATE_FIELDS):
            changed += 1

    save_store(path, store)
    print(f"Migrated {changed} of {len(events)} event(s) in {path}")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "events.json"
    migrate(target)
