"""Regulation/format IDs and which underlying game each one belongs to.

The regulation letter alone determines the game - it's the same letter
scheme reused across three different games' history, not three parallel
per-game schemes:
  - M-A, M-B            -> Pokemon Champions (Mega Evolutions)
  - 23S1..23S3, SVE-SVI, VGC23 -> Pokemon Scarlet & Violet
  - VGC22 (Series 12)   -> Pokemon Sword & Shield

This holds regardless of which site a tournament was pulled from - the same
regulation letter means the same ruleset whether it came from Limitless or
pokestats.top.
"""

FORMAT_LABELS = {
    "M-B": "Reg M-B",
    "M-A": "Reg M-A",
    "SVI": "Reg I",
    "SVH": "Reg H",
    "SVG": "Reg G",
    "SVF": "Reg F",
    "SVE": "Reg E",
    "VGC23": "Reg D",
    "23S3": "Reg C",
    "23S2": "Reg B",
    "23S1": "Reg A",
    "VGC22": "Series 12",
}

FORMAT_TO_FRANCHISE = {
    "M-B": "Pokemon Champions",
    "M-A": "Pokemon Champions",
    "SVI": "Scarlet & Violet",
    "SVH": "Scarlet & Violet",
    "SVG": "Scarlet & Violet",
    "SVF": "Scarlet & Violet",
    "SVE": "Scarlet & Violet",
    "VGC23": "Scarlet & Violet",
    "23S3": "Scarlet & Violet",
    "23S2": "Scarlet & Violet",
    "23S1": "Scarlet & Violet",
    "VGC22": "Sword & Shield",
}

LATEST_FORMAT = "M-B"


def format_label(format_id: str | None) -> str:
    if not format_id:
        return "Unknown"
    return FORMAT_LABELS.get(format_id, format_id)


def franchise_label(format_id: str | None) -> str:
    if not format_id:
        return "Unknown"
    return FORMAT_TO_FRANCHISE.get(format_id, format_id)
