"""Runs `cli.py run` if the store is stale - meant to be invoked by a launchd
LaunchAgent (RunAtLoad + a daily StartCalendarInterval), not by hand.

Gated on staleness rather than running unconditionally so that logging in
multiple times a day (or the daily calendar tick landing right after a
login-triggered run) doesn't fire the real-Chrome bootstrap more than once
per day.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
STORE_PATH = HERE.parent / "data" / "events.json"
STALE_AFTER = timedelta(hours=20)


def is_stale() -> bool:
    if not STORE_PATH.exists():
        return True
    data = json.loads(STORE_PATH.read_text())
    last_synced_at = data.get("last_synced_at")
    if not last_synced_at:
        return True
    last_synced = datetime.fromisoformat(last_synced_at)
    return datetime.now(timezone.utc) - last_synced > STALE_AFTER


def main() -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] auto_run starting")
    if not is_stale():
        print("Store is fresh (< 20h old), skipping.")
        return

    result = subprocess.run(
        [str(HERE / ".venv" / "bin" / "python"), str(HERE / "cli.py"), "run"],
        cwd=HERE,
    )
    if result.returncode != 0:
        print(f"cli.py run exited with status {result.returncode}", file=sys.stderr)
        return

    print(
        "Sync complete. New data written to data/events.json but NOT committed - "
        "review the diff and commit by hand when you're happy with it."
    )


if __name__ == "__main__":
    main()
