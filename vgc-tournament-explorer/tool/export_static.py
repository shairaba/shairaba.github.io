"""Export the SQLite DB to static JSON for the GitHub Pages site.

Deliberately dumps raw fields (species ids, format ids, etc.) rather than
presentation-ready strings - the static frontend (app.js) is responsible for
labels, sprite URLs, etc. Regenerates everything on every run; the dataset
is small enough (thousands, not millions, of rows) that a full re-export is
simpler and safer than incremental diffing.
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from limitless_extractor import db

SITE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def dump(obj) -> str:
    return json.dumps(obj, separators=(",", ":"))


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


def export_tournaments_index(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT id, name, date, format, players FROM tournaments "
        "WHERE standings_fetched = 1 ORDER BY date DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def export_players_index(conn) -> list[dict]:
    rows = conn.execute(
        """
        SELECT p.player_key, p.name, p.country, COUNT(*) AS tournament_count
        FROM players p JOIN entries e ON e.player_key = p.player_key
        GROUP BY p.player_key ORDER BY tournament_count DESC
        """
    ).fetchall()
    players = [dict(r) for r in rows]

    format_rows = conn.execute(
        """
        SELECT e.player_key, t.format, COUNT(*) AS c
        FROM entries e JOIN tournaments t ON t.id = e.tournament_id
        GROUP BY e.player_key, t.format
        """
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


def export_player_detail(conn, player_key: str) -> dict:
    p = conn.execute("SELECT * FROM players WHERE player_key = ?", (player_key,)).fetchone()
    rows = conn.execute(
        """
        SELECT e.*, t.name AS tournament_name, t.date AS tournament_date, t.format AS tournament_format
        FROM entries e JOIN tournaments t ON t.id = e.tournament_id
        WHERE e.player_key = ? ORDER BY t.date DESC
        """,
        (player_key,),
    ).fetchall()
    out_entries = []
    for e in rows:
        d = dict(e)
        d["team"] = _entry_team(conn, e["tournament_id"], player_key)
        out_entries.append(d)
    return {**dict(p), "entries": out_entries}


def main() -> None:
    conn = db.get_connection()

    if SITE_DATA_DIR.exists():
        shutil.rmtree(SITE_DATA_DIR)
    (SITE_DATA_DIR / "tournaments").mkdir(parents=True)
    (SITE_DATA_DIR / "players").mkdir(parents=True)

    tournaments = export_tournaments_index(conn)
    (SITE_DATA_DIR / "tournaments.json").write_text(dump(tournaments))
    print(f"tournaments.json: {len(tournaments)} tournaments")

    players = export_players_index(conn)
    (SITE_DATA_DIR / "players.json").write_text(dump(players))
    print(f"players.json: {len(players)} players")

    for t in tournaments:
        detail = export_tournament_detail(conn, t["id"])
        (SITE_DATA_DIR / "tournaments" / f"{t['id']}.json").write_text(dump(detail))
    print(f"wrote {len(tournaments)} tournament detail files")

    for p in players:
        detail = export_player_detail(conn, p["player_key"])
        (SITE_DATA_DIR / "players" / f"{p['player_key']}.json").write_text(dump(detail))
    print(f"wrote {len(players)} player detail files")

    meta = {"generated_at": datetime.now(timezone.utc).isoformat()}
    (SITE_DATA_DIR / "meta.json").write_text(dump(meta))


if __name__ == "__main__":
    main()
