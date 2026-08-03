"""Local read-only dashboard over the extracted VGC tournament data."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from flask import Flask, abort, render_template, request

from limitless_extractor.formats import VGC_FORMATS, format_label
from limitless_extractor.sprites import sprite_url

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "limitless.db"

app = Flask(__name__)
app.jinja_env.globals["format_label"] = format_label
app.jinja_env.globals["VGC_FORMATS"] = VGC_FORMATS
app.jinja_env.globals["sprite_url"] = sprite_url


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _known_formats(conn) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT format FROM tournaments WHERE standings_fetched = 1 AND format IS NOT NULL ORDER BY format"
    ).fetchall()
    return [r["format"] for r in rows]


def _teams_by_player(rows) -> dict[str, list[dict]]:
    teams: dict[str, list[dict]] = {}
    for mon in rows:
        d = dict(mon)
        d["moves"] = json.loads(d["moves"] or "[]")
        teams.setdefault(mon["player_key"], []).append(d)
    return teams


def _teams_by_tournament(rows) -> dict[str, list[dict]]:
    teams: dict[str, list[dict]] = {}
    for mon in rows:
        d = dict(mon)
        d["moves"] = json.loads(d["moves"] or "[]")
        teams.setdefault(mon["tournament_id"], []).append(d)
    return teams


@app.route("/")
def index():
    conn = get_db()
    tcount = conn.execute("SELECT COUNT(*) c FROM tournaments WHERE standings_fetched = 1").fetchone()["c"]
    pcount = conn.execute("SELECT COUNT(*) c FROM players").fetchone()["c"]
    ecount = conn.execute("SELECT COUNT(*) c FROM entries").fetchone()["c"]
    recent = conn.execute(
        "SELECT * FROM tournaments WHERE standings_fetched = 1 ORDER BY date DESC LIMIT 15"
    ).fetchall()
    top_players = conn.execute(
        """
        SELECT p.player_key, p.name, p.country, COUNT(*) tcount
        FROM players p JOIN entries e ON e.player_key = p.player_key
        GROUP BY p.player_key ORDER BY tcount DESC LIMIT 10
        """
    ).fetchall()
    return render_template(
        "index.html", tcount=tcount, pcount=pcount, ecount=ecount, recent=recent, top_players=top_players
    )


@app.route("/tournaments")
def tournaments():
    q = request.args.get("q", "").strip()
    fmt = request.args.get("format", "").strip()
    conn = get_db()

    sql = "SELECT * FROM tournaments WHERE standings_fetched = 1"
    params: list = []
    if q:
        sql += " AND name LIKE ?"
        params.append(f"%{q}%")
    if fmt:
        sql += " AND format = ?"
        params.append(fmt)
    sql += " ORDER BY date DESC LIMIT 300"

    rows = conn.execute(sql, params).fetchall()
    return render_template("tournaments.html", rows=rows, q=q, fmt=fmt, formats=_known_formats(conn))


@app.route("/tournament/<tid>")
def tournament_detail(tid):
    conn = get_db()
    t = conn.execute("SELECT * FROM tournaments WHERE id = ?", (tid,)).fetchone()
    if not t:
        abort(404)
    entries = conn.execute(
        "SELECT * FROM entries WHERE tournament_id = ? ORDER BY (placing IS NULL), placing ASC",
        (tid,),
    ).fetchall()
    mon_rows = conn.execute(
        "SELECT * FROM team_pokemon WHERE tournament_id = ? ORDER BY player_key, slot", (tid,)
    ).fetchall()
    teams = _teams_by_player(mon_rows)
    return render_template("tournament_detail.html", t=t, entries=entries, teams=teams)


@app.route("/players")
def players():
    q = request.args.get("q", "").strip()
    fmt = request.args.get("format", "").strip()
    conn = get_db()

    sql = """
        SELECT p.player_key, p.name, p.country, COUNT(*) tcount
        FROM players p
        JOIN entries e ON e.player_key = p.player_key
        JOIN tournaments t ON t.id = e.tournament_id
        WHERE 1 = 1
    """
    params: list = []
    if q:
        sql += " AND p.name LIKE ?"
        params.append(f"%{q}%")
    if fmt:
        sql += " AND t.format = ?"
        params.append(fmt)
    sql += " GROUP BY p.player_key ORDER BY tcount DESC LIMIT 300"

    rows = conn.execute(sql, params).fetchall()
    return render_template("players.html", rows=rows, q=q, fmt=fmt, formats=_known_formats(conn))


@app.route("/player/<player_key>")
def player_detail(player_key):
    conn = get_db()
    p = conn.execute("SELECT * FROM players WHERE player_key = ?", (player_key,)).fetchone()
    if not p:
        abort(404)
    entries = conn.execute(
        """
        SELECT e.*, t.name AS tournament_name, t.date AS tournament_date, t.format AS tournament_format
        FROM entries e JOIN tournaments t ON t.id = e.tournament_id
        WHERE e.player_key = ? ORDER BY t.date DESC
        """,
        (player_key,),
    ).fetchall()
    mon_rows = conn.execute(
        "SELECT * FROM team_pokemon WHERE player_key = ? ORDER BY tournament_id, slot", (player_key,)
    ).fetchall()
    teams = _teams_by_tournament(mon_rows)
    return render_template("player_detail.html", p=p, entries=entries, teams=teams)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
