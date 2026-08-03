"""Pokemon sprite URLs, served from Limitless's own CDN.

The `id` field Limitless returns for each decklist entry (e.g. "rotom-heat",
"ninetales-alola") maps directly onto their sprite filenames, so no extra
lookups are needed.
"""

SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9"


def sprite_url(species_id: str | None) -> str | None:
    if not species_id:
        return None
    return f"{SPRITE_BASE}/{species_id}.png"
