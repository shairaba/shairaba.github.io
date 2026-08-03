"""Thin, rate-limited client for the public Limitless TCG tournament API.

Docs: https://docs.limitlesstcg.com/developer/tournaments
No API key is required for the /tournaments endpoints used here. The API
enforces a "50 requests per 5 minutes" limit per client, so this client
throttles itself well under that and backs off on 429 responses.
"""

from __future__ import annotations

import time

import requests

API_BASE = "https://play.limitlesstcg.com/api"
USER_AGENT = "vgc-tournament-extractor/1.0 (personal use; contact via github)"


class RateLimitedClient:
    def __init__(self, min_interval: float = 6.5, max_retries: int = 5):
        # 50 req / 5 min = 6s/req average; 6.5s keeps a safety margin.
        self.min_interval = min_interval
        self.max_retries = max_retries
        self._last_request_time = 0.0
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_time
        wait = self.min_interval - elapsed
        if wait > 0:
            time.sleep(wait)

    def get(self, path: str, params: dict | None = None):
        url = f"{API_BASE}{path}"
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            self._throttle()
            try:
                resp = self.session.get(url, params=params, timeout=30)
            finally:
                self._last_request_time = time.monotonic()

            if resp.status_code == 429:
                retry_after = float(resp.headers.get("Retry-After", 30))
                print(f"  rate limited, sleeping {retry_after:.0f}s...")
                time.sleep(retry_after)
                continue

            if resp.status_code >= 500:
                last_error = RuntimeError(f"{resp.status_code} from {url}")
                print(f"  server error {resp.status_code}, retrying ({attempt}/{self.max_retries})...")
                time.sleep(min(2 ** attempt, 30))
                continue

            resp.raise_for_status()
            return resp.json()

        raise RuntimeError(f"Failed to fetch {url} after {self.max_retries} attempts") from last_error

    def list_tournaments(self, game: str = "VGC", format: str | None = None, page: int = 1, limit: int = 50):
        params = {"game": game, "page": page, "limit": limit}
        if format:
            params["format"] = format
        return self.get("/tournaments", params=params)

    def tournament_standings(self, tournament_id: str):
        return self.get(f"/tournaments/{tournament_id}/standings")
