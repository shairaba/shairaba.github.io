"""Regenerate ../species-list.js from species_reference.py's SPECIES_LIST.

species_reference.py is the single source of truth for legal species (used
by ingest.py's server-side validation); this script mirrors it into a JS
array the submission page (submit.html/submit.js) loads for its species
picker and its own client-side validation. Run this whenever
species_reference.py's SPECIES_LIST changes:

    python3 generate_species_list_js.py
"""

import json
from pathlib import Path

from species_reference import SPECIES_LIST

OUTPUT = Path(__file__).resolve().parent.parent / "species-list.js"


def main():
    entries = [{"n": name, "i": species_id} for name, species_id in SPECIES_LIST]
    js = (
        "// GENERATED from tool/species_reference.py by generate_species_list_js.py "
        "- do not hand-edit.\n"
        "const SPECIES_LIST = "
        + json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    OUTPUT.write_text(js, encoding="utf-8")
    print(f"Wrote {len(entries)} entries to {OUTPUT}")


if __name__ == "__main__":
    main()
