"""Pokemon sprite URLs, per data source.

This is purely a technical concern (which CDN actually has the asset), and
is independent of the format/franchise labeling in formats.py: Limitless's
CDN has no Mega-form sprites (its own tournaments' teams never seem to use
them even for M-A/M-B - possibly a data quirk on their end, not a ruleset
difference), so anything sourced from pokestats.top uses pokestats' own
image host instead, with pokestats' own slug rule: lowercase, strip
everything except [a-z0-9-] (reverse-engineered from their frontend
bundle's getPokemonImgUrl - see pokestats_api_reference.json).

`source` here is literally the value stored in tournaments.game: "limitless"
or "pokestats".
"""

import re

LIMITLESS_SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9"
POKESTATS_SPRITE_BASE = "https://pokestats.top/images/pokemon/imgs"


def pokestats_species_slug(name: str) -> str:
    return re.sub(r"[^a-z0-9-]", "", name.lower())


def sprite_url(species_id: str | None, source: str = "limitless") -> str | None:
    if not species_id:
        return None
    if source == "pokestats":
        return f"{POKESTATS_SPRITE_BASE}/{species_id}.png"
    return f"{LIMITLESS_SPRITE_BASE}/{species_id}.png"
