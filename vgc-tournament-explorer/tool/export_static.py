"""Export the SQLite DB to static JSON for the GitHub Pages site.

Deliberately dumps raw fields (species ids, format ids, etc.) rather than
presentation-ready strings - the static frontend (app.js) is responsible for
labels, sprite URLs, etc. Regenerates everything on every run; the dataset
is small enough (thousands, not millions, of rows) that a full re-export is
simpler and safer than incremental diffing.
"""

from __future__ import annotations

import json
import re
import shutil
from collections import Counter
from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path

from limitless_extractor import db

SITE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def dump(obj) -> str:
    return json.dumps(obj, separators=(",", ":"))


def _normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def find_cross_source_duplicates(tournaments: list[dict]) -> set[str]:
    """Big crossover events sometimes get submitted to / tracked by both
    Limitless and pokestats.top independently, landing as two separate rows
    for the same real tournament (e.g. "The Grand Champions Festival Encore"
    - same date, format, and player count, one from each source). Matching
    on (format, date, player count, normalized name) is a strong enough
    signature that false positives are effectively impossible - two
    unrelated tournaments coincidentally sharing an exact player count is
    already unlikely, let alone also the same day, format, and name.

    Returns the set of tournament IDs to drop from published output (the
    pokestats copy is preferred to drop, since Limitless's own API tends to
    have more reliable win/loss/tie records). The underlying DB keeps both
    rows untouched - this is purely an export-time presentation choice.
    """
    by_key: dict[tuple, list[dict]] = {}
    for t in tournaments:
        key = (t["format"], t["date"][:10], t["players"], _normalize_name(t["name"]))
        by_key.setdefault(key, []).append(t)

    exclude_ids: set[str] = set()
    for group in by_key.values():
        if len(group) < 2:
            continue
        sources = {t["game"] for t in group}
        if "limitless" in sources and "pokestats" in sources:
            keep = next(t for t in group if t["game"] == "limitless")
            for t in group:
                if t["id"] != keep["id"]:
                    exclude_ids.add(t["id"])
    return exclude_ids


def _entry_team(conn, tournament_id: str, player_key: str) -> list[dict]:
    rows = conn.execute(
        "SELECT slot, species_id, species_name, item, ability, nature, tera, moves "
        "FROM team_pokemon WHERE tournament_id = ? AND player_key = ? ORDER BY slot",
        (tournament_id, player_key),
    ).fetchall()
    team = []
    for r in rows:
        d = dict(r)
        d["moves"] = json.loads(d["moves"] or "[]")
        team.append(d)
    return team


def _entry_team_sprites_only(conn, tournament_id: str, player_key: str) -> list[dict]:
    """Just enough to draw the sprite icons. Player exports use this instead
    of the full team (item/ability/nature/moves) since that's already fully
    present in the tournament's own export - embedding it again in every
    player file roughly doubled total site size for no benefit (the full
    team, on a player page, is only ever needed when that row is expanded,
    at which point the frontend lazy-fetches the tournament file)."""
    rows = conn.execute(
        "SELECT slot, species_id, species_name "
        "FROM team_pokemon WHERE tournament_id = ? AND player_key = ? ORDER BY slot",
        (tournament_id, player_key),
    ).fetchall()
    return [dict(r) for r in rows]


def export_tournaments_index(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT id, name, date, format, game, players, is_in_person FROM tournaments "
        "WHERE standings_fetched = 1 ORDER BY date DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def export_players_index(conn, exclude_ids: set[str] = frozenset()) -> list[dict]:
    exclude_clause = f"AND e.tournament_id NOT IN ({','.join('?' * len(exclude_ids))})" if exclude_ids else ""
    exclude_params = list(exclude_ids)

    rows = conn.execute(
        f"""
        SELECT p.player_key, p.name, p.country, COUNT(*) AS tournament_count
        FROM players p JOIN entries e ON e.player_key = p.player_key
        WHERE 1 = 1 {exclude_clause}
        GROUP BY p.player_key ORDER BY tournament_count DESC
        """,
        exclude_params,
    ).fetchall()
    players = [dict(r) for r in rows]

    # Flat by format - the regulation letter alone determines the game
    # (see formats.py), so it's unambiguous without nesting by source.
    format_rows = conn.execute(
        f"""
        SELECT e.player_key, t.format, COUNT(*) AS c
        FROM entries e JOIN tournaments t ON t.id = e.tournament_id
        WHERE 1 = 1 {exclude_clause}
        GROUP BY e.player_key, t.format
        """,
        exclude_params,
    ).fetchall()
    formats_by_player: dict[str, dict[str, int]] = {}
    for r in format_rows:
        formats_by_player.setdefault(r["player_key"], {})[r["format"] or ""] = r["c"]
    for p in players:
        p["formats"] = formats_by_player.get(p["player_key"], {})

    return players


def export_tournament_detail(conn, tournament_id: str) -> dict:
    t = conn.execute("SELECT * FROM tournaments WHERE id = ?", (tournament_id,)).fetchone()
    entries = conn.execute(
        "SELECT * FROM entries WHERE tournament_id = ? ORDER BY (placing IS NULL), placing ASC",
        (tournament_id,),
    ).fetchall()
    out_entries = []
    for e in entries:
        d = dict(e)
        d["team"] = _entry_team(conn, tournament_id, e["player_key"])
        out_entries.append(d)
    return {**dict(t), "entries": out_entries}


def export_player_detail(conn, player_key: str, exclude_ids: set[str] = frozenset()) -> dict:
    p = conn.execute("SELECT * FROM players WHERE player_key = ?", (player_key,)).fetchone()
    rows = conn.execute(
        """
        SELECT e.*, t.name AS tournament_name, t.date AS tournament_date,
               t.format AS tournament_format, t.game AS tournament_game
        FROM entries e JOIN tournaments t ON t.id = e.tournament_id
        WHERE e.player_key = ? ORDER BY t.date DESC
        """,
        (player_key,),
    ).fetchall()
    rows = [r for r in rows if r["tournament_id"] not in exclude_ids]
    out_entries = []
    for e in rows:
        d = dict(e)
        d["team"] = _entry_team_sprites_only(conn, e["tournament_id"], player_key)
        out_entries.append(d)
    return {**dict(p), "entries": out_entries}


def export_dashboard(conn, exclude_ids: set[str] = frozenset()) -> dict:
    """Per-format aggregate stats: top Pokemon usage, top 2-mon cores, and a
    best-finishes leaderboard. Formats are never combined - "M-B" in
    Champions and "M-B" in VGC would otherwise get silently averaged
    together despite being different, incomparable rulesets (see
    formats.py). Note: species_id is slugified differently per data source
    (see sprites.py) - for formats with entries from both sources (like
    M-B), the same real Pokemon could in rare cases (punctuation-heavy
    names) count as two different species_id values here.
    """
    exclude_clause = f"AND t.id NOT IN ({','.join('?' * len(exclude_ids))})" if exclude_ids else ""
    exclude_params = list(exclude_ids)

    formats = [
        r["format"]
        for r in conn.execute(
            "SELECT DISTINCT format FROM tournaments WHERE standings_fetched = 1 AND format IS NOT NULL"
        ).fetchall()
    ]

    dashboard: dict[str, dict] = {}
    for fmt in formats:
        team_rows = conn.execute(
            f"""
            SELECT tp.tournament_id, tp.player_key, tp.species_id, tp.species_name
            FROM team_pokemon tp JOIN tournaments t ON t.id = tp.tournament_id
            WHERE t.format = ? {exclude_clause}
            """,
            [fmt, *exclude_params],
        ).fetchall()

        teams: dict[tuple[str, str], list[str]] = {}
        name_lookup: dict[str, str] = {}
        usage_counter: Counter[str] = Counter()
        for r in team_rows:
            key = (r["tournament_id"], r["player_key"])
            teams.setdefault(key, []).append(r["species_id"])
            name_lookup[r["species_id"]] = r["species_name"]
        for species_list in teams.values():
            usage_counter.update(set(species_list))

        total_teams = len(teams)

        top_pokemon = [
            {
                "species_id": species_id,
                "species_name": name_lookup.get(species_id, species_id),
                "count": count,
                "usage_pct": round(100 * count / total_teams, 1) if total_teams else 0,
            }
            for species_id, count in usage_counter.most_common(30)
        ]

        core_counter: Counter[tuple[str, str]] = Counter()
        for species_list in teams.values():
            for pair in combinations(sorted(set(species_list)), 2):
                core_counter[pair] += 1
        top_cores = [
            {
                "species": [
                    {"species_id": a, "species_name": name_lookup.get(a, a)},
                    {"species_id": b, "species_name": name_lookup.get(b, b)},
                ],
                "count": count,
                "usage_pct": round(100 * count / total_teams, 1) if total_teams else 0,
            }
            for (a, b), count in core_counter.most_common(20)
        ]

        finish_rows = conn.execute(
            f"""
            SELECT e.player_key, p.name, p.country,
                   SUM(CASE WHEN e.placing = 1 THEN 1 ELSE 0 END) AS wins,
                   SUM(CASE WHEN e.placing IS NOT NULL AND e.placing <= 4 THEN 1 ELSE 0 END) AS top4,
                   SUM(CASE WHEN e.placing IS NOT NULL AND e.placing <= 8 THEN 1 ELSE 0 END) AS top8,
                   COUNT(*) AS tournaments
            FROM entries e
            JOIN tournaments t ON t.id = e.tournament_id
            JOIN players p ON p.player_key = e.player_key
            WHERE t.format = ? {exclude_clause}
            GROUP BY e.player_key
            HAVING wins > 0 OR top4 > 0
            ORDER BY wins DESC, top4 DESC, top8 DESC
            LIMIT 25
            """,
            [fmt, *exclude_params],
        ).fetchall()
        best_finishes = [dict(r) for r in finish_rows]

        dashboard[fmt] = {
            "total_teams": total_teams,
            "top_pokemon": top_pokemon,
            "top_cores": top_cores,
            "best_finishes": best_finishes,
        }

    return dashboard


def main() -> None:
    conn = db.get_connection()

    if SITE_DATA_DIR.exists():
        shutil.rmtree(SITE_DATA_DIR)
    (SITE_DATA_DIR / "tournaments").mkdir(parents=True)
    (SITE_DATA_DIR / "players").mkdir(parents=True)

    tournaments = export_tournaments_index(conn)
    exclude_ids = find_cross_source_duplicates(tournaments)
    if exclude_ids:
        print(f"Excluding {len(exclude_ids)} cross-source duplicate tournament(s) (same event on both sites):")
        for t in tournaments:
            if t["id"] in exclude_ids:
                print(f"  {t['id']}: {t['name']} ({t['date'][:10]}, {t['game']})")
        tournaments = [t for t in tournaments if t["id"] not in exclude_ids]

    (SITE_DATA_DIR / "tournaments.json").write_text(dump(tournaments))
    print(f"tournaments.json: {len(tournaments)} tournaments")

    players = export_players_index(conn, exclude_ids)
    (SITE_DATA_DIR / "players.json").write_text(dump(players))
    print(f"players.json: {len(players)} players")

    for t in tournaments:
        detail = export_tournament_detail(conn, t["id"])
        (SITE_DATA_DIR / "tournaments" / f"{t['id']}.json").write_text(dump(detail))
    print(f"wrote {len(tournaments)} tournament detail files")

    for p in players:
        detail = export_player_detail(conn, p["player_key"], exclude_ids)
        (SITE_DATA_DIR / "players" / f"{p['player_key']}.json").write_text(dump(detail))
    print(f"wrote {len(players)} player detail files")

    dashboard = export_dashboard(conn, exclude_ids)
    (SITE_DATA_DIR / "dashboard.json").write_text(dump(dashboard))
    print(f"dashboard.json: {len(dashboard)} formats")

    meta = {"generated_at": datetime.now(timezone.utc).isoformat()}
    (SITE_DATA_DIR / "meta.json").write_text(dump(meta))


if __name__ == "__main__":
    main()
