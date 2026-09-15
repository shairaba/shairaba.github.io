"""Build the Location picker's option list from pokemon-events-italia's own
event data (../../pokemon-events-italia/data/events.json), so the submission
form's location dropdown - and the "vid" it links tournament pages back to on
that app's venue.html page - reuses that app's already-tracked venues instead
of maintaining a second, separate list of Italian game stores by hand.

Dedup key is (venue_name, region), using pokemon-events-italia's own
venue_name/region strings as-is (that app doesn't title-case them either -
see its app.js's eventVenueLabel()/eventName()). Display text (the "label"/
"venue_name"/"city" this module actually returns) is title-cased via
titleize() though, since that source data is all shouting-caps
("GALACTUS BOLOGNA") and this site's picker/tournament pages show it
directly to people.

A handful of (venue_name, region) pairs map to more than one
activity_group_display_id in the source data (a venue whose listing got
re-created, or a chain with more than one branch sharing a name+region) - for
those, this picks the vid with the most events (the "main"/longest-running
listing), tie-broken by most recently seen, then by vid string for a fully
deterministic result.

Each location also carries a best-effort "city", parsed from that same
event's full_address - lets submit.js auto-fill the Tournament City field
once a TO picks a Location, instead of typing the same city twice. There's
no dedicated city field in the source data, and full_address comes from at
least three different address-string templates (see parse_city()'s
docstring), so this is a heuristic, not authoritative - about 1.5% of
addresses have no locality name in them at all and come back as None, and a
few resolve to a frazione/hamlet name rather than the "real" city. submit.js
only ever uses this as a pre-filled *suggestion* the TO can overwrite, never
as validated data, so that error rate is fine here.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
EVENTS_JSON = APP_DIR.parent / "pokemon-events-italia" / "data" / "events.json"

_POSSESSIVE_S_RE = re.compile(r"(?<=[A-Za-z])'S\b")


def titleize(s):
    """pokemon-events-italia's venue_name/region/address strings are all
    shouting-caps in the source data - this renders "GALACTUS BOLOGNA" as
    "Galactus Bologna" for display. Built on str.title(), which handles the
    vast majority of real names correctly, including Italian elisions like
    "L'Aquila"/"Dell'Otaku" (str.title() capitalizes right after an
    apostrophe, which is exactly what those want); the one case that needs
    a manual fixup is an English-style possessive apostrophe, which
    str.title() gets backwards ("POPPY'S" -> "Poppy'S" instead of
    "Poppy's") - _POSSESSIVE_S_RE only matches 's straight after a letter
    (never after an apostrophe that starts a word), so it can't misfire on
    the elision case above."""
    if not s:
        return s
    return _POSSESSIVE_S_RE.sub("'s", s.title())


_BARE_CODE_RE = re.compile(r"^(IT-)?[A-Z]{2}$")
_LEADING_POSTAL_RE = re.compile(r"^\d{5}\s+")
_TRAILING_POSTAL_RE = re.compile(r"\s+\d{5}$")
_LEADING_PROV_RE = re.compile(r"^(IT-)?[A-Z]{2}\s+")
_TRAILING_PROV_RE = re.compile(r"\s+(IT-)?[A-Z]{2}$")


def parse_city(full_address, region):
    """full_address comes in at least three shapes, e.g.:
      "23/A VIA IRNERIO, BOLOGNA, EMILIA-ROMAGNA 40126, IT"      (city, then "REGION POSTAL")
      "VIA GIUSEPPE VERDI, 18, 24121 BERGAMO BG, ITALY"          ("POSTAL CITY PROVCODE")
      "VIA FABIO MASSIMO 40/42/44, NAPOLI, NA 80125, IT"         (city, then "PROVCODE POSTAL")
    Strategy: strip the trailing country token, then scan comma segments from
    the end, stripping postal-code/province-code tokens off each one, until a
    segment survives that isn't blank, isn't just a bare province code, isn't
    the region's own name, and has no digits left in it - that's the city.
    """
    if not full_address:
        return None
    parts = [p.strip() for p in full_address.split(",") if p.strip()]
    while parts and parts[-1].upper() in ("IT", "ITALY", "ITALIA"):
        parts.pop()

    def clean(segment):
        segment = _LEADING_POSTAL_RE.sub("", segment)
        segment = _TRAILING_POSTAL_RE.sub("", segment)
        segment = _LEADING_PROV_RE.sub("", segment)
        segment = _TRAILING_PROV_RE.sub("", segment)
        return segment.strip()

    for segment in reversed(parts):
        candidate = clean(segment)
        if not candidate or re.search(r"\d", candidate):
            continue
        if _BARE_CODE_RE.fullmatch(candidate):
            continue
        if region and candidate.upper() == region.strip().upper():
            continue
        return candidate
    return None


def _group_events(key_fn):
    """Shared scan over events.json: buckets events by key_fn(venue_name,
    region), and within each bucket by vid, tracking [event_count,
    most_recent_last_seen_at, full_address, region] as of that most-recent
    sighting - the raw material both load_locations() (grouped by
    (venue_name, region)) and load_locations_by_venue_name() (grouped by
    venue_name alone) reduce down to a single winning vid per group from."""
    data = json.loads(EVENTS_JSON.read_text(encoding="utf-8"))
    groups = defaultdict(lambda: defaultdict(lambda: [0, "", "", ""]))
    for event in data["events"].values():
        venue_name = (event.get("venue_name") or "").strip()
        region = (event.get("region") or "").strip()
        vid = event.get("activity_group_display_id")
        if not venue_name or not region or not vid:
            continue
        key = key_fn(venue_name, region)
        stat = groups[key][vid]
        stat[0] += 1
        last_seen = event.get("last_seen_at") or ""
        if last_seen >= stat[1]:
            stat[1] = last_seen
            stat[2] = event.get("full_address") or ""
            stat[3] = region
    return groups


def _best_vid(vids):
    return max(vids, key=lambda vid: (vids[vid][0], vids[vid][1], vid))


def load_locations():
    """Returns a list of {"label": "VENUE_NAME (REGION)", "venue_name": ...,
    "vid": ..., "city": ...} dicts, one per distinct (venue_name, region),
    sorted by label. This is what backs the Location field's suggestion
    list - the "(REGION)" disambiguates venues that share a name across
    different regions (5 of them, as of this writing) while a TO is
    picking one."""
    groups = _group_events(lambda venue_name, region: (venue_name, region))

    locations = []
    for (venue_name, region), vids in groups.items():
        best_vid = _best_vid(vids)
        full_address = vids[best_vid][2]
        display_venue = titleize(venue_name)
        display_region = titleize(region)
        locations.append(
            {
                "label": f"{display_venue} ({display_region})",
                "venue_name": display_venue,
                "vid": best_vid,
                "city": titleize(parse_city(full_address, region)),
            }
        )

    locations.sort(key=lambda loc: loc["label"])
    return locations


def load_locations_by_venue_name():
    """Returns venue_name.lower() -> {"venue_name": ..., "vid": ..., "city":
    ...}, one per distinct plain venue name (region dropped). This is what
    ingest.py actually matches a submitted Location value against - the
    Form only ever sees the plain venue name (submit.js strips the "
    (REGION)" suffix once a TO picks a suggestion, since region isn't
    meant to end up in the spreadsheet - see submit.js's
    maybeAutofillCityFromLocation()). For the small handful of venue names
    that repeat across regions (chains with more than one branch), this
    picks one winner the same way load_locations() does per-region - a
    plain-text submission can't disambiguate which branch was meant
    anyway, so this is the best a text match can do."""
    groups = _group_events(lambda venue_name, region: venue_name)

    by_venue_name = {}
    for venue_name, vids in groups.items():
        best_vid = _best_vid(vids)
        full_address = vids[best_vid][2]
        region = vids[best_vid][3]
        display_venue = titleize(venue_name)
        by_venue_name[display_venue.lower()] = {
            "venue_name": display_venue,
            "vid": best_vid,
            "city": titleize(parse_city(full_address, region)),
        }
    return by_venue_name


if __name__ == "__main__":
    locations = load_locations()
    print(f"{len(locations)} distinct locations")
    print(f"{sum(1 for loc in locations if not loc['city'])} with no parsed city")
    for loc in locations[:5]:
        print(loc)
