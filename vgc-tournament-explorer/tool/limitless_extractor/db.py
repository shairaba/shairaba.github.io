"""SQLite storage layer for extracted VGC tournament data."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "limitless.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    format TEXT,
    game TEXT,
    players INTEGER,
    organizer_id INTEGER,
    is_in_person INTEGER NOT NULL DEFAULT 0,
    standings_fetched INTEGER NOT NULL DEFAULT 0,
    standings_fetched_at TEXT
);

CREATE TABLE IF NOT EXISTS players (
    player_key TEXT PRIMARY KEY,
    name TEXT,
    country TEXT
);

CREATE TABLE IF NOT EXISTS entries (
    tournament_id TEXT NOT NULL REFERENCES tournaments(id),
    player_key TEXT NOT NULL REFERENCES players(player_key),
    player_name TEXT,
    country TEXT,
    placing INTEGER,
    wins INTEGER,
    losses INTEGER,
    ties INTEGER,
    drop_round INTEGER,
    deck_id TEXT,
    deck_name TEXT,
    PRIMARY KEY (tournament_id, player_key)
);

CREATE TABLE IF NOT EXISTS team_pokemon (
    tournament_id TEXT NOT NULL,
    player_key TEXT NOT NULL,
    slot INTEGER NOT NULL,
    species_id TEXT,
    species_name TEXT,
    item TEXT,
    ability TEXT,
    nature TEXT,
    tera TEXT,
    moves TEXT,
    PRIMARY KEY (tournament_id, player_key, slot)
);

CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_player ON entries(player_key);
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date);
CREATE INDEX IF NOT EXISTS idx_team_pokemon_species ON team_pokemon(species_id);
"""


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    """CREATE TABLE IF NOT EXISTS won't add columns to a table that already
    exists from before this column was introduced - handle that here."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(tournaments)")}
    if "is_in_person" not in cols:
        conn.execute("ALTER TABLE tournaments ADD COLUMN is_in_person INTEGER NOT NULL DEFAULT 0")
    conn.commit()


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.commit()
    _migrate(conn)


def upsert_tournament(conn: sqlite3.Connection, t: dict) -> None:
    t = {**t, "is_in_person": t.get("is_in_person", 0)}
    conn.execute(
        """
        INSERT INTO tournaments (id, name, date, format, game, players, organizer_id, is_in_person)
        VALUES (:id, :name, :date, :format, :game, :players, :organizerId, :is_in_person)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            date = excluded.date,
            format = excluded.format,
            game = excluded.game,
            players = excluded.players,
            organizer_id = excluded.organizer_id,
            is_in_person = excluded.is_in_person
        """,
        t,
    )


def set_sync_state(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO sync_state (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()


def get_sync_state(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM sync_state WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def tournaments_missing_standings(conn: sqlite3.Connection, limit: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, date FROM tournaments WHERE standings_fetched = 0 "
        "ORDER BY date DESC LIMIT ?",
        (limit,),
    ).fetchall()


def _clean(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def save_standings(conn: sqlite3.Connection, tournament_id: str, standings: list[dict]) -> None:
    cur = conn.cursor()
    cur.execute("DELETE FROM team_pokemon WHERE tournament_id = ?", (tournament_id,))
    cur.execute("DELETE FROM entries WHERE tournament_id = ?", (tournament_id,))

    for entry in standings:
        player_key = entry.get("player")
        if not player_key:
            continue
        name = _clean(entry.get("name"))
        country = _clean(entry.get("country"))
        record = entry.get("record") or {}
        deck = entry.get("deck") or {}

        cur.execute(
            """
            INSERT INTO players (player_key, name, country)
            VALUES (?, ?, ?)
            ON CONFLICT(player_key) DO UPDATE SET name = excluded.name, country = excluded.country
            """,
            (player_key, name, country),
        )

        cur.execute(
            """
            INSERT INTO entries
                (tournament_id, player_key, player_name, country, placing,
                 wins, losses, ties, drop_round, deck_id, deck_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                tournament_id,
                player_key,
                name,
                country,
                entry.get("placing"),
                record.get("wins"),
                record.get("losses"),
                record.get("ties"),
                entry.get("drop"),
                deck.get("id"),
                deck.get("name"),
            ),
        )

        decklist = entry.get("decklist") or []
        for slot, mon in enumerate(decklist, start=1):
            if not isinstance(mon, dict):
                continue
            cur.execute(
                """
                INSERT INTO team_pokemon
                    (tournament_id, player_key, slot, species_id, species_name,
                     item, ability, nature, tera, moves)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    tournament_id,
                    player_key,
                    slot,
                    mon.get("id"),
                    mon.get("name"),
                    _clean(mon.get("item")),
                    _clean(mon.get("ability")),
                    _clean(mon.get("nature")),
                    _clean(mon.get("tera")),
                    json.dumps(mon.get("attacks") or []),
                ),
            )

    cur.execute(
        "UPDATE tournaments SET standings_fetched = 1, standings_fetched_at = datetime('now') WHERE id = ?",
        (tournament_id,),
    )
    conn.commit()


def status_by_format(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT game, format, COUNT(*) as count FROM tournaments "
        "WHERE standings_fetched = 1 GROUP BY game, format ORDER BY count DESC"
    ).fetchall()


def status(conn: sqlite3.Connection) -> dict:
    t_total = conn.execute("SELECT COUNT(*) c FROM tournaments").fetchone()["c"]
    t_with_standings = conn.execute(
        "SELECT COUNT(*) c FROM tournaments WHERE standings_fetched = 1"
    ).fetchone()["c"]
    players = conn.execute("SELECT COUNT(*) c FROM players").fetchone()["c"]
    entries = conn.execute("SELECT COUNT(*) c FROM entries").fetchone()["c"]
    date_range = conn.execute(
        "SELECT MIN(date) oldest, MAX(date) newest FROM tournaments WHERE standings_fetched = 1"
    ).fetchone()
    deepest_page = get_sync_state(conn, "deepest_page")
    return {
        "tournaments_known": t_total,
        "tournaments_with_standings": t_with_standings,
        "players": players,
        "entries": entries,
        "oldest_fetched": date_range["oldest"],
        "newest_fetched": date_range["newest"],
        "deepest_page_paged": deepest_page,
    }
