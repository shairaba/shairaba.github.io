"""Regenerate ../sprite-map.js from sprite_map.py's SPECIES_TO_DEX.

Mirrors generate_species_list_js.py's pattern: sprite_map.py is the source
of truth (used server-side by ingest.py/og_image.py/tournament_page.py),
this mirrors it into a JS object the browser can use (app.js's
spriteChipHtml). Run this whenever sprite_map.py changes:

    python3 generate_sprite_map_js.py
"""

import json
from pathlib import Path

from sprite_map import CDN_BASE, SPECIES_TO_DEX

OUTPUT = Path(__file__).resolve().parent.parent / "sprite-map.js"


def main():
    js = (
        "// GENERATED from tool/sprite_map.py by generate_sprite_map_js.py - "
        "do not hand-edit.\n"
        f"const NEW_SPRITE_CDN_BASE = {json.dumps(CDN_BASE)};\n"
        "const SPECIES_TO_DEX = "
        + json.dumps(SPECIES_TO_DEX, separators=(",", ":"), sort_keys=True)
        + ";\n"
    )
    OUTPUT.write_text(js, encoding="utf-8")
    print(f"Wrote {len(SPECIES_TO_DEX)} entries to {OUTPUT}")


if __name__ == "__main__":
    main()
