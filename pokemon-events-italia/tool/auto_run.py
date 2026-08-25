"""Runs `cli.py run` if the store is stale, then commits and pushes the
result unattended - meant to be invoked by a launchd LaunchAgent (RunAtLoad
+ a daily StartCalendarInterval), not by hand.

Gated on staleness rather than running unconditionally so that logging in
multiple times a day (or the daily calendar tick landing right after a
login-triggered run) doesn't fire the real-Chrome bootstrap more than once
per day.

The commit step only ever touches data/events.json via a pathspec on
`git commit` (never `git add -A`/`commit -a`), so it can't sweep up
unrelated in-progress changes elsewhere in this monorepo. cli.py run's own
SuspiciousEmptyFetchError already refuses to write the store at all on a
fetch that looks broken, so there's nothing bad here to accidentally
publish.
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
STORE_PATH = HERE.parent / "data" / "events.json"
STORE_PATHSPEC = "pokemon-events-italia/data/events.json"
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


def commit_and_push() -> None:
    unchanged = subprocess.run(
        ["git", "diff", "--quiet", "--", STORE_PATHSPEC], cwd=REPO_ROOT
    )
    if unchanged.returncode == 0:
        print("No changes to data/events.json - nothing to commit.")
        return

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    commit = subprocess.run(
        ["git", "commit", "-m", f"Auto-sync Pokemon events data ({date_str})", "--", STORE_PATHSPEC],
        cwd=REPO_ROOT,
    )
    if commit.returncode != 0:
        print("git commit failed.", file=sys.stderr)
        return

    pull = subprocess.run(["git", "pull", "--rebase"], cwd=REPO_ROOT)
    if pull.returncode != 0:
        print(
            "git pull --rebase failed before push - commit made locally, "
            "resolve manually.",
            file=sys.stderr,
        )
        return

    push = subprocess.run(["git", "push"], cwd=REPO_ROOT)
    if push.returncode != 0:
        print("git push failed - commit made locally but not pushed.", file=sys.stderr)
    else:
        print(f"Committed and pushed: {date_str}")


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

    print("Sync complete.")
    commit_and_push()


if __name__ == "__main__":
    main()
