"""Species that use a hand-provided sprite from ../data/sprites/<id>.png
instead of the Limitless/pokestats CDNs - for species missing from both
(confirmed live: Limitless 404s on Staraptor-Mega; pokestats has one, but
in a smoother "painted" style that doesn't match the crisp Gen9 pixel art
the rest of the site's sprites use).

Shared by og_image.py and tournament_page.py. app.js keeps its own copy of
this same set (JS can't import this file) - keep the two in sync by hand;
it should rarely change.
"""

from pathlib import Path

SPRITES_DIR = Path(__file__).resolve().parent.parent / "data" / "sprites"

LOCAL_SPRITE_OVERRIDES = {"staraptor-mega"}


def local_sprite_path(species_id):
    if species_id not in LOCAL_SPRITE_OVERRIDES:
        return None
    path = SPRITES_DIR / f"{species_id}.png"
    return path if path.exists() else None
