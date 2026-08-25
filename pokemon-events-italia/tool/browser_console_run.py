"""Drives the user's real Chrome (via AppleScript, not CDP or a copied
profile) to run the original browser-console fallback script, then ingests
the downloaded response into data/events.json and commits+pushes it.

Requires a one-time manual step: Chrome's menu bar -> View -> Developer ->
Allow JavaScript from Apple Events (off by default; AppleScript's "execute
javascript" refuses to run without it).

    tool/.venv/bin/python browser_console_run.py

Unlike cli.py run (Playwright + a copied profile) this never touches
Playwright at all - it's the same manual console-script mechanism that
originally seeded this project's data, just triggered by a script instead
of a person pasting into DevTools.
"""

from __future__ import annotations

import subprocess
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import auto_run  # reuses commit_and_push()
from pokemon_events import console_ingest

EVENT_LOCATOR_URL = (
    f"https://events.pokemon.com/EventLocator/?locale=it-IT&range=25"
    f"&startdate={date.today().isoformat()}&iskm=true"
)
APPLESCRIPT_PATH = HERE / "pokemon_events" / "run_console_script.applescript"
JS_PATH = HERE / "pokemon_events" / "console_script.js"
DOWNLOADS_DIR = Path.home() / "Downloads"
DOWNLOAD_GLOB = "nationwide_response*.json"
DOWNLOAD_TIMEOUT_SECONDS = 300
STORE_PATH = HERE.parent / "data" / "events.json"
RAW_ARCHIVE_DIR = HERE / "data" / "raw"


def trigger_console_script() -> None:
    print("Opening events.pokemon.com in your real Chrome and running the console script...")
    result = subprocess.run(
        ["osascript", str(APPLESCRIPT_PATH), EVENT_LOCATOR_URL, str(JS_PATH)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        hint = ""
        if "not allowed" in result.stderr.lower() or "not authorized" in result.stderr.lower():
            hint = (
                "\nThis usually means Chrome's 'Allow JavaScript from Apple Events' setting "
                "is off - enable it via Chrome's menu bar: View > Developer > "
                "Allow JavaScript from Apple Events, then try again."
            )
        raise RuntimeError(f"AppleScript failed: {result.stderr.strip()}{hint}")
    print("Console script triggered. It runs ~42 sequential requests with delays - waiting for its download...")


def wait_for_download(after: float) -> Path:
    deadline = time.monotonic() + DOWNLOAD_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        candidates = [
            p for p in DOWNLOADS_DIR.glob(DOWNLOAD_GLOB)
            if p.stat().st_mtime >= after and not p.name.endswith(".crdownload")
        ]
        if candidates:
            newest = max(candidates, key=lambda p: p.stat().st_mtime)
            # give Chrome a moment to finish flushing the file to disk
            time.sleep(1)
            return newest
        time.sleep(2)
    raise TimeoutError(
        f"No {DOWNLOAD_GLOB} appeared in {DOWNLOADS_DIR} within {DOWNLOAD_TIMEOUT_SECONDS}s. "
        "Check the Chrome tab's console for errors (the script logs progress there)."
    )


def main() -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] browser_console_run starting")
    start = time.time()

    trigger_console_script()
    downloaded = wait_for_download(after=start)
    print(f"Got {downloaded}")

    import json

    raw_response = json.loads(downloaded.read_text())
    event_count = len(raw_response.get("data", {}).get("EventList", {}).get("List", []))
    print(f"Downloaded response contains {event_count} raw event records.")

    RAW_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    archived = RAW_ARCHIVE_DIR / f"console_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    archived.write_text(downloaded.read_text())
    downloaded.unlink()
    print(f"Archived raw response to {archived}, removed from Downloads.")

    try:
        stats = console_ingest.ingest(raw_response, STORE_PATH)
    except console_ingest.SuspiciousEmptyFetchError as exc:
        print(f"Refusing to write store: {exc}", file=sys.stderr)
        return

    print(
        f"Store updated: {stats.added} added, {stats.updated} updated, "
        f"{stats.unchanged} unchanged, {stats.marked_inactive} marked inactive."
    )

    auto_run.commit_and_push()


if __name__ == "__main__":
    main()
