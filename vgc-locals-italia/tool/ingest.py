"""Fetch the Italian VGC Locals Google Form's published-to-web CSV, aggregate
top-cut usage stats, and write the static JSON the site's frontend reads.

Data source: Google Sheets "File > Share > Publish to web" gives a stable,
public, unauthenticated CSV export URL for the Form's responses tab - no
OAuth/service account/GitHub secret needed, same "hardcode the public source
URL" convention vgc-tournament-explorer/tool uses for its own sources.

Run standalone: `pip install -r requirements.txt && python ingest.py`
"""

import csv
import io
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

from species_reference import lookup_species

# The Sheet's public CSV export - works because it's shared as "anyone with
# the link can view" (Sheets' own /export endpoint), which is simpler than
# the "Publish to web" flow tool/README.md originally described and doesn't
# require a separate publish step.
CSV_URL = "https://docs.google.com/spreadsheets/d/1wFQQoeH3JaxECZDw1hX2AlbpQ8FbK_zUrTZWJ3UUaSQ/export?format=csv"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TOURNAMENTS_DIR = DATA_DIR / "tournaments"

VALID_TOURNAMENT_TYPES = {"vg cup", "vg challenge"}

# Google Forms' CSV header is the literal question title (see the Form field
# list in the app README / repo plan) plus its own auto "Timestamp" column.
# Matched case-insensitively so small header punctuation drift doesn't break
# ingestion.
HEADER_MAP = {
    "tournament id": "tournament_id",
    "tournament name": "tournament_name",
    "tournament date": "tournament_date",
    "type of tournament": "tournament_type",
    "number of players": "number_of_players",
    "to name": "to_name",
    "player name": "player_name",
    "placement": "placement",
    "pokemon 1": "mon_1",
    "pokemon 2": "mon_2",
    "pokemon 3": "mon_3",
    "pokemon 4": "mon_4",
    "pokemon 5": "mon_5",
    "pokemon 6": "mon_6",
}
MON_KEYS = ["mon_1", "mon_2", "mon_3", "mon_4", "mon_5", "mon_6"]


def normalize_header(raw_header):
    # Strips a leading/trailing "Pokémon" accent variance and any trailing
    # Google Forms question-help text, keeping just the part HEADER_MAP keys on.
    h = raw_header.strip().lower().replace("é", "e").replace("pokémon", "pokemon")
    return HEADER_MAP.get(h)


def derive_top_cut_size(number_of_players):
    """Top cut size is derived from entrant count, not TO-picked:
    <9 players -> top 2, 9-16 -> top 4, >=17 -> top 8 (per the organizer's
    own tournament-size rule, not an official Pokemon Champions standard)."""
    if number_of_players < 9:
        return 2
    if number_of_players < 17:
        return 4
    return 8


def fetch_rows(csv_url):
    resp = requests.get(csv_url, timeout=30)
    resp.raise_for_status()
    # Google's CSV export doesn't send a charset in its Content-Type header,
    # so requests falls back to HTTP's ISO-8859-1 default instead of
    # detecting the actual encoding (verified live: this mangled "é" in
    # "Pokémon", silently breaking every species-column header match, which
    # dropped every row's species data with no error - only a confusing
    # "unrecognized species ''" warning). The export is always UTF-8.
    text = resp.content.decode("utf-8")
    # Google Sheets CSV exports use CRLF line endings; splitlines() handles
    # \r\n / \n / \r uniformly, unlike a naive text.split("\n").
    reader = csv.reader(text.splitlines())
    header = next(reader)
    keys = [normalize_header(h) for h in header]
    rows = []
    for raw in reader:
        if not any(cell.strip() for cell in raw):
            continue
        row = {}
        for key, value in zip(keys, raw):
            if key:
                row[key] = value.strip()
        rows.append(row)
    return rows


def validate_and_normalize(row, row_num, warnings):
    tournament_id = row.get("tournament_id", "")
    if not tournament_id:
        warnings.append(f"row {row_num}: missing tournament_id, skipped")
        return None

    tournament_type = row.get("tournament_type", "")
    if tournament_type.strip().lower() not in VALID_TOURNAMENT_TYPES:
        warnings.append(
            f"row {row_num} ({tournament_id}): tournament_type {tournament_type!r} "
            f"is not 'VG Cup' or 'VG Challenge', skipped"
        )
        return None

    raw_players = row.get("number_of_players", "")
    try:
        number_of_players = int(raw_players)
        if number_of_players <= 0:
            raise ValueError
    except ValueError:
        warnings.append(
            f"row {row_num} ({tournament_id}): number_of_players {raw_players!r} "
            f"is not a positive integer, skipped"
        )
        return None
    top_cut_size = derive_top_cut_size(number_of_players)

    team = []
    for mon_key in MON_KEYS:
        raw_species = row.get(mon_key, "")
        entry = lookup_species(raw_species)
        if entry is None:
            warnings.append(
                f"row {row_num} ({tournament_id}): unrecognized species "
                f"{raw_species!r} in {mon_key}, skipping this row"
            )
            return None
        team.append(entry)

    return {
        "tournament_id": tournament_id,
        "tournament_name": row.get("tournament_name") or tournament_id,
        "tournament_date": row.get("tournament_date", ""),
        "tournament_type": "VG Cup" if tournament_type.strip().lower() == "vg cup" else "VG Challenge",
        "number_of_players": number_of_players,
        "top_cut_size": top_cut_size,
        "player_name": row.get("player_name") or None,
        "placement": row.get("placement") or None,
        "team": team,  # list of (species_id, species_name)
    }


def group_by_tournament(entries, warnings):
    tournaments = defaultdict(list)
    for e in entries:
        tournaments[e["tournament_id"]].append(e)

    for tid, players in tournaments.items():
        top_cut_size = players[0]["top_cut_size"]
        if len(players) > top_cut_size:
            warnings.append(
                f"tournament {tid!r}: {len(players)} submitted rows exceed "
                f"its declared top cut size of {top_cut_size}"
            )
    return tournaments


def usage_stats(players, denominator):
    counts = defaultdict(int)
    names = {}
    for player in players:
        seen = set()
        for species_id, species_name in player["team"]:
            if species_id in seen:
                continue  # a species only counts once per team
            seen.add(species_id)
            counts[species_id] += 1
            names[species_id] = species_name
    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    return [
        {
            "species_id": species_id,
            "species_name": names[species_id],
            "count": count,
            "usage_pct": round(100 * count / denominator, 1) if denominator else 0.0,
        }
        for species_id, count in ranked
    ]


def find_winner(rosters):
    # Prefer an explicit "1st" placement over assuming rosters[0] is the
    # winner - submissions normally arrive in placement order (submit.html
    # submits top-to-bottom), but a manually-edited Sheet row order
    # shouldn't silently mislabel someone else as the winner.
    for r in rosters:
        if (r["placement"] or "").strip().lower() == "1st":
            return r
    return rosters[0] if rosters else None


def build_tournament_json(tid, players):
    top_pokemon = usage_stats(players, players[0]["top_cut_size"])
    rosters = [
        {
            "player_name": p["player_name"] or None,
            "placement": p["placement"],
            "team": [
                {"species_id": sid, "species_name": sname} for sid, sname in p["team"]
            ],
        }
        for p in players
    ]
    return {
        "id": tid,
        "name": players[0]["tournament_name"],
        "date": players[0]["tournament_date"],
        "tournament_type": players[0]["tournament_type"],
        "number_of_players": players[0]["number_of_players"],
        "top_cut_size": players[0]["top_cut_size"],
        "player_count": len(players),
        "top_pokemon": top_pokemon,
        "rosters": rosters,
        "winner": find_winner(rosters),
    }


def main():
    warnings = []
    raw_rows = fetch_rows(CSV_URL)

    entries = []
    for i, row in enumerate(raw_rows, start=2):  # row 1 is the header
        normalized = validate_and_normalize(row, i, warnings)
        if normalized is not None:
            entries.append(normalized)

    tournaments = group_by_tournament(entries, warnings)

    TOURNAMENTS_DIR.mkdir(parents=True, exist_ok=True)

    tournaments_index = []
    all_players = []
    for tid, players in sorted(tournaments.items()):
        detail = build_tournament_json(tid, players)
        (TOURNAMENTS_DIR / f"{tid}.json").write_text(
            json.dumps(detail, separators=(",", ":"), ensure_ascii=False)
        )
        tournaments_index.append(
            {
                "id": detail["id"],
                "name": detail["name"],
                "date": detail["date"],
                "tournament_type": detail["tournament_type"],
                "number_of_players": detail["number_of_players"],
                "top_cut_size": detail["top_cut_size"],
                "player_count": detail["player_count"],
                # Embedded (not just a reference) so the tournament list page
                # can render winner + team from this one index fetch, without
                # an extra request per row.
                "winner": detail["winner"],
            }
        )
        all_players.extend(players)

    total_top_cut_players = len(all_players)
    dashboard = {
        "meta": {
            "kind": "top_cut_usage",
            "note": (
                "Based on top-cut teams (top 2, top 4, or top 8, depending "
                f"on turnout) from {len(tournaments)} Italian locals. Not "
                "full-field/entrant-pool usage."
            ),
            "total_tournaments": len(tournaments),
            "total_top_cut_players": total_top_cut_players,
            "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "top_pokemon": usage_stats(all_players, total_top_cut_players),
    }

    (DATA_DIR / "dashboard.json").write_text(
        json.dumps(dashboard, separators=(",", ":"), ensure_ascii=False)
    )
    (DATA_DIR / "tournaments.json").write_text(
        json.dumps(tournaments_index, separators=(",", ":"), ensure_ascii=False)
    )

    for w in warnings:
        print(f"WARNING: {w}", file=sys.stderr)
    print(
        f"Wrote {len(tournaments)} tournaments, "
        f"{total_top_cut_players} top-cut players, "
        f"{len(warnings)} warnings."
    )


if __name__ == "__main__":
    main()
