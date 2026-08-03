"""VGC format/regulation IDs, as returned by GET /api/games (id="VGC").

Kept as a static snapshot rather than fetched live, since it changes rarely
and every other part of the app needs it synchronously (e.g. building
dashboard dropdowns without an extra request).
"""

VGC_FORMATS = {
    "M-B": "Regulation Set M-B",
    "M-A": "Regulation Set M-A",
    "SVI": "Scarlet & Violet - Regulation I",
    "SVH": "Scarlet & Violet - Regulation H",
    "SVG": "Scarlet & Violet - Regulation G",
    "SVF": "Scarlet & Violet - Regulation F",
    "SVE": "Scarlet & Violet - Regulation E",
    "VGC23": "Scarlet & Violet - Regulation D",
    "23S3": "Scarlet & Violet - Regulation C",
    "23S2": "Scarlet & Violet - Regulation B",
    "23S1": "Scarlet & Violet - Regulation A",
    "VGC22": "VGC 2022 (Series 12)",
}

LATEST_FORMAT = "M-B"


def format_label(format_id: str | None) -> str:
    if not format_id:
        return "Unknown"
    return VGC_FORMATS.get(format_id, format_id)
