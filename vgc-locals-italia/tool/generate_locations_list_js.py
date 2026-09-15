"""Regenerate ../locations-list.js from locations.py's load_locations().

Mirrors generate_species_list_js.py's role: locations.py (backed by
pokemon-events-italia/data/events.json) is the source of truth, this turns it
into a plain JS array the submission page's Location picker loads client-side.

ingest.py calls write_locations_list_js() at the end of every run, so this
stays in sync with events.json automatically. Can still be run standalone:

    python3 generate_locations_list_js.py
"""

import json
from pathlib import Path

from locations import load_locations

OUTPUT = Path(__file__).resolve().parent.parent / "locations-list.js"


def write_locations_list_js():
    locations = load_locations()
    js = (
        "// GENERATED from pokemon-events-italia/data/events.json by "
        "generate_locations_list_js.py - do not hand-edit.\n"
        "const LOCATIONS_LIST = "
        + json.dumps(locations, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    OUTPUT.write_text(js, encoding="utf-8")
    print(f"Wrote {len(locations)} entries to {OUTPUT}")


if __name__ == "__main__":
    write_locations_list_js()
