"""Lombardy region matching.

The API has no region/state filter param - it only takes a lat/long +
range (km) radius, so a search wide enough to cover all of Lombardy also
picks up bordering regions (confirmed live: Emilia-Romagna, Piemonte,
Liguria, and Veneto all show up within a 150km radius of Milan). Matching
has to happen client-side against each event's free-text address.

Two address formats were observed in real responses, and BOTH matter:
  - "<street>, <city>, LOMBARDIA <postal>, IT" - region name spelled out.
  - "<street>, <postal> <city> <PROVINCE_CODE>, IT" - no region name at
    all, just the two-letter province code (e.g. "20015 PARABIAGO MI").
Matching on the region name alone silently drops the second format - in a
322-event sample, ~15% of genuine Lombardy events (Milano, Como, Bergamo,
Lecco addresses) were Format B. Both checks are needed for real recall.
"""

from __future__ import annotations

import re

LOMBARDY_PROVINCE_CODES = {"MI", "BG", "BS", "CO", "CR", "LC", "LO", "MN", "MB", "PV", "SO", "VA"}

_TRAILING_COUNTRY_RE = re.compile(r",?\s*(?:ITALY|IT)\s*\Z")


def matches_lombardy(full_address: str | None) -> bool:
    if not full_address:
        return False
    addr = full_address.upper().strip()
    if "LOMBARDIA" in addr:
        return True

    # Format B: strip the trailing ", IT" and check whether the last token
    # is a bare Lombardy province code.
    without_country = _TRAILING_COUNTRY_RE.sub("", addr).strip()
    tokens = without_country.split()
    if not tokens:
        return False
    last_token = tokens[-1].rstrip(",")
    return last_token in LOMBARDY_PROVINCE_CODES
