"""Client + translation layer for pokestats.top's Championships (Battlefy
"Victory Road") data.

pokestats.top has no documented public API; these endpoints were found by
inspecting network requests made by their React frontend
(https://pokestats.top/championships/). Full details in
pokestats_api_reference.json alongside this file.

Tournament/player IDs are prefixed "pokestats_" at ingestion so they can
share the same `tournaments`/`players`/`entries`/`team_pokemon` tables as
Limitless data with zero risk of collision, and no schema changes.
`tournaments.game` stores the data source ("pokestats" vs "limitless") -
purely a technical marker for sprite-CDN selection (see sprites.py); it does
NOT indicate which game/franchise a tournament is for - that's derived from
the regulation letter alone, uniformly across sources (see formats.py).

Entries are translated into the exact shapes `db.upsert_tournament` and
`db.save_standings` already expect (mirroring Limitless's raw API shapes),
so no DB-layer changes were needed to support a second source.
"""

from __future__ import annotations

import re
import time

import requests

from .sprites import pokestats_species_slug

API_BASE = "https://pokestats.top/api/championships"
USER_AGENT = "vgc-tournament-extractor/1.0 (personal use; contact via github)"
SOURCE = "pokestats"

REG_TO_FORMAT = {
    "Champions Reg.M-B": "M-B",
    "Champions Reg.M-A": "M-A",
    "Gen9 Reg.I": "SVI",
    "Gen9 Reg.H": "SVH",
    "Gen9 Reg.G": "SVG",
    "Gen9 Reg.F": "SVF",
}


class PokestatsClient:
    def __init__(self, min_interval: float = 1.5, max_retries: int = 4):
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

    def get(self, path: str):
        url = f"{API_BASE}{path}"
        for attempt in range(1, self.max_retries + 1):
            self._throttle()
            try:
                resp = self.session.get(url, timeout=30)
            finally:
                self._last_request_time = time.monotonic()
            if resp.status_code == 429:
                time.sleep(10)
                continue
            if resp.status_code >= 500:
                time.sleep(min(2**attempt, 20))
                continue
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != 0:
                raise RuntimeError(f"pokestats API error for {url}: {body.get('msg')}")
            return body["data"]
        raise RuntimeError(f"Failed to fetch {url} after {self.max_retries} attempts")

    def list_regs(self) -> list[dict]:
        return self.get("/regs")

    def list_tournaments(self, reg: str) -> list[dict]:
        from urllib.parse import quote

        return self.get(f"/reg/{quote(reg, safe='')}")

    def standings(self, tournament_id: str) -> list[dict]:
        return self.get(f"/{tournament_id}/standings")


def tournament_id_prefix(native_id: str) -> str:
    return f"pokestats_{native_id}"


def player_key_prefix(native_id: str) -> str:
    return f"pokestats_{native_id}"


def is_in_person(native_tournament_id: str) -> bool:
    """pokestats' "Championships" tracker covers both online Victory Road
    (Battlefy) tournaments and official in-person TPCi events (Regional/
    International Championships, Special Events, Worlds). IDs cleanly
    distinguish the two: online tournaments are "vr..."-prefixed, in-person
    ones are bare zero-padded numbers like "0000190-0" - verified as a
    perfect 1:1 split against name patterns ("Regional Championship" etc.)
    across the full dataset, so this is the authoritative signal rather than
    matching on the (translatable, inconsistently formatted) name."""
    return bool(re.match(r"^\d+(-\d+)?$", native_tournament_id))


def translate_tournament(reg: str, t: dict) -> dict | None:
    fmt = REG_TO_FORMAT.get(reg)
    if fmt is None:
        return None
    return {
        "id": tournament_id_prefix(t["id"]),
        "name": t.get("name") or t["id"],
        "date": f"{t['start_date']}T00:00:00.000Z",
        "format": fmt,
        "game": SOURCE,
        "players": t.get("players") or 0,
        "organizerId": None,
        "is_in_person": 1 if is_in_person(t["id"]) else 0,
    }


def _parse_record(record: str) -> tuple[int | None, int | None, int | None]:
    parts = (record or "").split("-")
    if len(parts) != 3:
        return None, None, None
    try:
        return int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None, None, None


def _safe_id_component(value: str) -> str:
    """Some tournaments have no stable per-player ID and fall back to the raw
    display name (see _parse_player_field), which can contain characters
    (slashes, etc.) that break as a filename/URL path segment. IDs from a
    real Battlefy ObjectId pass through unchanged since they're already
    [a-z0-9]."""
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")
    return slug or "unknown"


def _parse_player_field(native_tournament_id: str, player_field: str) -> tuple[str, str]:
    """Returns (display_name, native_player_id).

    Even in "vr"-prefixed tournaments, the ID half isn't always a real
    Battlefy ObjectId - some resolve to a raw display name/nickname instead
    (spaces, unicode, punctuation and all). Always sanitize: it's a no-op for
    real hex IDs and makes everything else safe as a filename/URL segment.
    """
    if native_tournament_id.startswith("vr") and "\n" in (player_field or ""):
        name, native_id = player_field.split("\n", 1)
        return name, _safe_id_component(native_id)
    return player_field, _safe_id_component(player_field)


def translate_standings(native_tournament_id: str, standings: list[dict]) -> list[dict]:
    out = []
    seen_keys: set[str] = set()
    for e in standings:
        name, native_player_id = _parse_player_field(native_tournament_id, e.get("player", ""))
        player_key = player_key_prefix(native_player_id)
        if player_key in seen_keys:
            # Rare upstream data quirk: some large tournaments resolve two
            # different entrants to the same "id" (e.g. a bare display name
            # instead of a stable Battlefy ID). Disambiguate deterministically
            # rather than dropping/overwriting one of them. "_dup" not "#":
            # this ends up as a URL path segment, and "#" would be parsed as
            # a fragment separator, breaking fetch() for the file.
            player_key = f"{player_key}_dup{e.get('placing')}"
        seen_keys.add(player_key)
        wins, losses, ties = _parse_record(e.get("record", ""))
        decklist = []
        for mon in e.get("pokemons") or []:
            species_name = mon.get("pokemon") or ""
            if not species_name:
                continue
            decklist.append(
                {
                    "id": pokestats_species_slug(species_name),
                    "name": species_name,
                    "item": mon.get("item") or None,
                    "ability": mon.get("ability") or None,
                    "attacks": mon.get("moves") or [],
                    "nature": mon.get("nature") or None,
                    "tera": mon.get("tera_type") or None,
                }
            )
        out.append(
            {
                "player": player_key,
                "name": name,
                "country": e.get("nat") or None,
                "placing": e.get("placing"),
                "record": {"wins": wins, "losses": losses, "ties": ties},
                "decklist": decklist,
                "deck": {},
                "drop": None,
            }
        )
    return out
