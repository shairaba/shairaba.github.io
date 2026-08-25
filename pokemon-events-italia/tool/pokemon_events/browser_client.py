"""Playwright-driven client for the official Pokemon Event Locator's
internal API (an OutSystems Reactive Web app at events.pokemon.com).

The endpoint sits behind Imperva/Incapsula plus an Akamai-style `reese84`
sensor cookie, and (this is the part that took real live testing to
isolate) the app's own bootstrap API call gets 403'd for any freshly
created automation profile - true for headless or headed, true for the
real Google Chrome binary, true from a residential IP or a datacenter one.
The one thing that reliably works is driving a copy of this machine's own,
organically-aged Chrome profile (see chrome_profile.py) via
`launch_persistent_context(channel="chrome")` - not a fresh throwaway
context. Once bootstrapped, the API itself is called as an in-page
`fetch()` via `page.evaluate()`, which runs inside the page's own JS
engine, so cookies, TLS/H2 fingerprint, and Origin/Referer all match
exactly with zero manual header replication. The same bootstrapped session
can then be reused for many subsequent queries (different lat/long,
different product filters) without re-navigating - verified live.
"""

from __future__ import annotations

import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import sync_playwright

from . import chrome_profile

EVENT_LOCATOR_URL = "https://events.pokemon.com/EventLocator/"
API_PATH = "/EventLocator/screenservices/EventLocator/MainFlow/Home/DataActionGetEventList"
COOKIE_WAIT_TIMEOUT = 15.0
COOKIE_WAIT_INTERVAL = 0.25
DEFAULT_PROFILE_DIR = Path(__file__).resolve().parent.parent / ".chrome-profile"


@dataclass
class SearchParams:
    """Drives both the initial page navigation and the POST payload, so the
    two can never drift apart - the real site's Referer header on its own
    POST reflects the same query params used to load the page."""

    latitude: str
    longitude: str
    range_km: str
    start_date: str
    filters: str = "vg"
    locale: str = "it-IT"

    def to_url(self) -> str:
        query = urllib.parse.urlencode(
            {
                "locale": self.locale,
                "range": self.range_km,
                "startdate": self.start_date,
                "iskm": "true",
                "latitude": self.latitude,
                "longitude": self.longitude,
                "filters": self.filters,
            }
        )
        return f"{EVENT_LOCATOR_URL}?{query}"


class SessionNotReadyError(RuntimeError):
    """Raised when the anti-bot challenge cookies never showed up in time."""


class PokemonEventLocatorClient:
    def __init__(self, headless: bool = False, profile_dir: Path | None = None):
        """headless=True is accepted but not recommended: it's never once
        gotten past the site's WAF in testing, regardless of profile. Real
        headed Chrome, with a real profile, is the only combination that's
        worked. profile_dir defaults to a cached copy of this machine's real
        Chrome profile (see chrome_profile.py) - created automatically on
        first use if missing; run `cli.py refresh-profile` to force an
        update once cookies go stale."""
        self.headless = headless
        self.profile_dir = profile_dir or DEFAULT_PROFILE_DIR
        self._playwright = None
        self._context = None
        self._page = None

    def __enter__(self) -> "PokemonEventLocatorClient":
        chrome_profile.ensure_profile(self.profile_dir)
        self._playwright = sync_playwright().start()
        self._context = self._playwright.chromium.launch_persistent_context(
            str(self.profile_dir),
            channel="chrome",
            headless=self.headless,
            geolocation={"latitude": 45.4642, "longitude": 9.1900},
            permissions=["geolocation"],
        )
        self._page = self._context.pages[0] if self._context.pages else self._context.new_page()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._context is not None:
            self._context.close()
        if self._playwright is not None:
            self._playwright.stop()

    def bootstrap(self, search: SearchParams, max_attempts: int = 4) -> None:
        """Navigate to the real page and wait for the anti-bot cookies to
        show up. `networkidle` is not used here - this page keeps background
        network activity going (map tiles, analytics) that can prevent the
        network from ever going fully idle, so `domcontentloaded` plus
        explicit cookie polling is the more reliable readiness signal.

        Even with a real Chrome profile, the site's session-level challenge
        doesn't pass 100% of the time - observed live as natural variance,
        not something a single retry-with-backoff can't smooth over. Each
        retry reloads fresh (a stuck attempt can leave the page on an
        interstitial challenge page that a plain cookie re-check would never
        recover from) with a growing cooldown between attempts."""
        last_error: SessionNotReadyError | None = None
        for attempt in range(1, max_attempts + 1):
            self._page.goto(search.to_url(), wait_until="domcontentloaded", timeout=45000)
            try:
                self._wait_for_cookie("reese84")
                self._wait_for_cookie("nr2Users")
                return
            except SessionNotReadyError as exc:
                last_error = exc
                if attempt < max_attempts:
                    cooldown = 8.0 * attempt
                    print(f"  bootstrap attempt {attempt}/{max_attempts} failed, retrying in {cooldown:.0f}s...")
                    time.sleep(cooldown)
        raise SessionNotReadyError(
            f"Bootstrap failed after {max_attempts} attempts. Last error: {last_error}"
        ) from last_error

    def _wait_for_cookie(self, name: str) -> str:
        deadline = time.monotonic() + COOKIE_WAIT_TIMEOUT
        while time.monotonic() < deadline:
            for cookie in self._context.cookies():
                if cookie["name"] == name:
                    return cookie["value"]
            time.sleep(COOKIE_WAIT_INTERVAL)
        raise SessionNotReadyError(
            f"Cookie {name!r} never appeared within {COOKIE_WAIT_TIMEOUT}s - "
            "the anti-bot challenge likely didn't complete."
        )

    def _read_csrf_token(self) -> str:
        """The `nr2Users` cookie the server sets on page load encodes
        `crf=<token>;uid=...;unm=...` (URL-encoded) - this is a classic
        double-submit-cookie CSRF pattern where the same value must be
        echoed back as the X-Csrftoken header on POSTs. Read fresh every
        call rather than hardcoded, since it's session-specific."""
        for cookie in self._context.cookies():
            if cookie["name"] == "nr2Users":
                decoded = urllib.parse.unquote(cookie["value"])
                for part in decoded.split(";"):
                    if part.startswith("crf="):
                        token = part[len("crf="):]
                        if token:
                            return token
        raise SessionNotReadyError("nr2Users cookie missing or has no crf= segment.")

    def post_json(self, payload: dict, max_retries: int = 2) -> dict:
        csrf_token = self._read_csrf_token()
        last_error: Exception | None = None
        for attempt in range(1, max_retries + 1):
            try:
                result = self._page.evaluate(
                    """async ({ path, payload, csrfToken }) => {
                        const res = await fetch(path, {
                            method: "POST",
                            headers: {
                                "Accept": "application/json",
                                "Content-Type": "application/json; charset=UTF-8",
                                "X-Csrftoken": csrfToken,
                            },
                            body: JSON.stringify(payload),
                        });
                        const text = await res.text();
                        return { ok: res.ok, status: res.status, text };
                    }""",
                    {"path": API_PATH, "payload": payload, "csrfToken": csrf_token},
                )
            except Exception as exc:  # noqa: BLE001 - report and retry
                last_error = exc
                time.sleep(1.5 * attempt)
                continue

            if not result["ok"]:
                last_error = RuntimeError(
                    f"POST {API_PATH} failed: HTTP {result['status']} - {result['text'][:500]}"
                )
                time.sleep(1.5 * attempt)
                continue

            import json

            return json.loads(result["text"])

        raise RuntimeError(f"Failed to fetch event list after {max_retries} attempts") from last_error
