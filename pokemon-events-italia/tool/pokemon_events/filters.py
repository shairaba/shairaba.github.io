"""Italy-wide address matching and region derivation.

The API has no country/region filter param - it only takes a lat/long +
range (km) radius, so a search wide enough to cover all of Italy can also
pick up bordering countries near the Alps (Switzerland, Austria, France).
Matching has to happen client-side against each event's free-text address.

`matches_italy` just checks the trailing country marker (", IT" or ",
ITALY") - simpler and more robust than trying to parse out a region/
province, and verified against a real nationwide sample: every genuinely
foreign address in testing ended in its own country's marker (", CH",
", FR", ", DE", "SWITZERLAND", etc.), while every real Italian address
ended in ", IT"/", ITALY" even when the region/province portion was
missing, misspelled, or a placeholder ("ITALIA", "---------") - a data
quality issue on the source's end that made region-based inclusion
unreliable as a filter, even though the country marker alone was solid.

`region_from_address` is separate best-effort enrichment (not a gate) for
the stored `region` field - three formats observed, all handled:
  - "<street>, <city>, LOMBARDIA <postal>, IT" - region name spelled out.
  - "<street>, <postal> <city> <PROVINCE_CODE>, IT" - bare two-letter code
    instead of a region name (e.g. "20015 PARABIAGO MI").
  - "<street>, <city>, BRESCIA <postal>, IT" - full province *name*
    instead of a code (distinct from the region name track above).
"""

from __future__ import annotations

import re

# All 107 Italian province codes, mapped to their region (as the API's own
# address strings spell it - uppercase, matching what's actually observed,
# e.g. "EMILIA-ROMAGNA" not "Emilia-Romagna").
PROVINCE_TO_REGION = {
    # Piemonte
    "TO": "PIEMONTE", "VC": "PIEMONTE", "NO": "PIEMONTE", "CN": "PIEMONTE",
    "AT": "PIEMONTE", "AL": "PIEMONTE", "BI": "PIEMONTE", "VB": "PIEMONTE",
    # Valle d'Aosta
    "AO": "VALLE D'AOSTA",
    # Liguria
    "GE": "LIGURIA", "SP": "LIGURIA", "SV": "LIGURIA", "IM": "LIGURIA",
    # Lombardia
    "MI": "LOMBARDIA", "BG": "LOMBARDIA", "BS": "LOMBARDIA", "CO": "LOMBARDIA",
    "CR": "LOMBARDIA", "LC": "LOMBARDIA", "LO": "LOMBARDIA", "MN": "LOMBARDIA",
    "MB": "LOMBARDIA", "PV": "LOMBARDIA", "SO": "LOMBARDIA", "VA": "LOMBARDIA",
    # Trentino-Alto Adige
    "TN": "TRENTINO-ALTO ADIGE", "BZ": "TRENTINO-ALTO ADIGE",
    # Veneto
    "VE": "VENETO", "VR": "VENETO", "VI": "VENETO", "TV": "VENETO",
    "PD": "VENETO", "RO": "VENETO", "BL": "VENETO",
    # Friuli-Venezia Giulia
    "TS": "FRIULI-VENEZIA GIULIA", "UD": "FRIULI-VENEZIA GIULIA",
    "PN": "FRIULI-VENEZIA GIULIA", "GO": "FRIULI-VENEZIA GIULIA",
    # Emilia-Romagna
    "BO": "EMILIA-ROMAGNA", "MO": "EMILIA-ROMAGNA", "PR": "EMILIA-ROMAGNA",
    "PC": "EMILIA-ROMAGNA", "RE": "EMILIA-ROMAGNA", "FE": "EMILIA-ROMAGNA",
    "RA": "EMILIA-ROMAGNA", "FC": "EMILIA-ROMAGNA", "RN": "EMILIA-ROMAGNA",
    # Toscana
    "FI": "TOSCANA", "PI": "TOSCANA", "SI": "TOSCANA", "AR": "TOSCANA",
    "GR": "TOSCANA", "LI": "TOSCANA", "LU": "TOSCANA", "MS": "TOSCANA",
    "PT": "TOSCANA", "PO": "TOSCANA",
    # Umbria
    "PG": "UMBRIA", "TR": "UMBRIA",
    # Marche
    "AN": "MARCHE", "PU": "MARCHE", "MC": "MARCHE", "FM": "MARCHE", "AP": "MARCHE",
    # Lazio
    "RM": "LAZIO", "VT": "LAZIO", "RI": "LAZIO", "LT": "LAZIO", "FR": "LAZIO",
    # Abruzzo
    "AQ": "ABRUZZO", "TE": "ABRUZZO", "PE": "ABRUZZO", "CH": "ABRUZZO",
    # Molise
    "CB": "MOLISE", "IS": "MOLISE",
    # Campania
    "NA": "CAMPANIA", "SA": "CAMPANIA", "AV": "CAMPANIA", "BN": "CAMPANIA", "CE": "CAMPANIA",
    # Puglia
    "BA": "PUGLIA", "FG": "PUGLIA", "LE": "PUGLIA", "TA": "PUGLIA",
    "BR": "PUGLIA", "BT": "PUGLIA",
    # Basilicata
    "PZ": "BASILICATA", "MT": "BASILICATA",
    # Calabria
    "CZ": "CALABRIA", "CS": "CALABRIA", "RC": "CALABRIA", "KR": "CALABRIA", "VV": "CALABRIA",
    # Sicilia
    "PA": "SICILIA", "CT": "SICILIA", "ME": "SICILIA", "SR": "SICILIA",
    "TP": "SICILIA", "RG": "SICILIA", "CL": "SICILIA", "EN": "SICILIA",
    # Sardegna
    "CA": "SARDEGNA", "SS": "SARDEGNA", "NU": "SARDEGNA", "OR": "SARDEGNA", "SU": "SARDEGNA",
}

# Full province names (as opposed to their two-letter codes above) - most
# share their name with their capoluogo city, which is exactly why this is
# matched only against the address *minus its first (street) segment*: a
# blanket whole-address search would false-positive on common street names
# like "Via Roma" or "Corso Torino" in a town nowhere near either province.
PROVINCE_NAME_TO_REGION = {
    "TORINO": "PIEMONTE", "VERCELLI": "PIEMONTE", "NOVARA": "PIEMONTE", "CUNEO": "PIEMONTE",
    "ASTI": "PIEMONTE", "ALESSANDRIA": "PIEMONTE", "BIELLA": "PIEMONTE", "VERBANO-CUSIO-OSSOLA": "PIEMONTE",
    "AOSTA": "VALLE D'AOSTA",
    "GENOVA": "LIGURIA", "LA SPEZIA": "LIGURIA", "SAVONA": "LIGURIA", "IMPERIA": "LIGURIA",
    "MILANO": "LOMBARDIA", "BERGAMO": "LOMBARDIA", "BRESCIA": "LOMBARDIA", "COMO": "LOMBARDIA",
    "CREMONA": "LOMBARDIA", "LECCO": "LOMBARDIA", "LODI": "LOMBARDIA", "MANTOVA": "LOMBARDIA",
    "MONZA E DELLA BRIANZA": "LOMBARDIA", "PAVIA": "LOMBARDIA", "SONDRIO": "LOMBARDIA", "VARESE": "LOMBARDIA",
    "TRENTO": "TRENTINO-ALTO ADIGE", "BOLZANO": "TRENTINO-ALTO ADIGE",
    "VENEZIA": "VENETO", "VERONA": "VENETO", "VICENZA": "VENETO", "TREVISO": "VENETO",
    "PADOVA": "VENETO", "ROVIGO": "VENETO", "BELLUNO": "VENETO",
    "TRIESTE": "FRIULI-VENEZIA GIULIA", "UDINE": "FRIULI-VENEZIA GIULIA",
    "PORDENONE": "FRIULI-VENEZIA GIULIA", "GORIZIA": "FRIULI-VENEZIA GIULIA",
    "BOLOGNA": "EMILIA-ROMAGNA", "MODENA": "EMILIA-ROMAGNA", "PARMA": "EMILIA-ROMAGNA",
    "PIACENZA": "EMILIA-ROMAGNA", "REGGIO EMILIA": "EMILIA-ROMAGNA", "FERRARA": "EMILIA-ROMAGNA",
    "RAVENNA": "EMILIA-ROMAGNA", "FORLI-CESENA": "EMILIA-ROMAGNA", "RIMINI": "EMILIA-ROMAGNA",
    "FIRENZE": "TOSCANA", "PISA": "TOSCANA", "SIENA": "TOSCANA", "AREZZO": "TOSCANA",
    "GROSSETO": "TOSCANA", "LIVORNO": "TOSCANA", "LUCCA": "TOSCANA", "MASSA-CARRARA": "TOSCANA",
    "PISTOIA": "TOSCANA", "PRATO": "TOSCANA",
    "PERUGIA": "UMBRIA", "TERNI": "UMBRIA",
    "ANCONA": "MARCHE", "PESARO E URBINO": "MARCHE", "MACERATA": "MARCHE",
    "FERMO": "MARCHE", "ASCOLI PICENO": "MARCHE",
    "ROMA": "LAZIO", "VITERBO": "LAZIO", "RIETI": "LAZIO", "LATINA": "LAZIO", "FROSINONE": "LAZIO",
    "L'AQUILA": "ABRUZZO", "TERAMO": "ABRUZZO", "PESCARA": "ABRUZZO", "CHIETI": "ABRUZZO",
    "CAMPOBASSO": "MOLISE", "ISERNIA": "MOLISE",
    "NAPOLI": "CAMPANIA", "SALERNO": "CAMPANIA", "AVELLINO": "CAMPANIA",
    "BENEVENTO": "CAMPANIA", "CASERTA": "CAMPANIA",
    "BARI": "PUGLIA", "FOGGIA": "PUGLIA", "LECCE": "PUGLIA", "TARANTO": "PUGLIA",
    "BRINDISI": "PUGLIA", "BARLETTA-ANDRIA-TRANI": "PUGLIA",
    "POTENZA": "BASILICATA", "MATERA": "BASILICATA",
    "CATANZARO": "CALABRIA", "COSENZA": "CALABRIA", "REGGIO CALABRIA": "CALABRIA",
    "CROTONE": "CALABRIA", "VIBO VALENTIA": "CALABRIA",
    "PALERMO": "SICILIA", "CATANIA": "SICILIA", "MESSINA": "SICILIA", "SIRACUSA": "SICILIA",
    "TRAPANI": "SICILIA", "RAGUSA": "SICILIA", "CALTANISSETTA": "SICILIA", "ENNA": "SICILIA",
    "CAGLIARI": "SARDEGNA", "SASSARI": "SARDEGNA", "NUORO": "SARDEGNA",
    "ORISTANO": "SARDEGNA", "SUD SARDEGNA": "SARDEGNA",
}

ALL_REGION_NAMES = sorted(set(PROVINCE_TO_REGION.values()))

_TRAILING_COUNTRY_RE = re.compile(r",?\s*(?:ITALY|IT)\s*\Z")
_TWO_LETTER_TOKEN_RE = re.compile(r"\b([A-Z]{2})\b")


def matches_italy(full_address: str | None) -> bool:
    """True if the address ends in the Italy country marker. Deliberately
    simple - see the module docstring for why a region/province-based
    check turned out to be less reliable than this, not more."""
    if not full_address:
        return False
    return bool(_TRAILING_COUNTRY_RE.search(full_address.upper().strip()))


def _without_street_segment(full_address: str) -> str:
    """Drops the first comma-separated segment (always the street) and the
    trailing country marker, leaving just the city/province/postal portion
    - the only part safe to search for a province *name* without risking a
    false match against a street called "Via Roma" or "Corso Torino"."""
    addr = full_address.upper().strip()
    without_country = _TRAILING_COUNTRY_RE.sub("", addr).strip()
    parts = without_country.split(",", 1)
    return parts[1] if len(parts) > 1 else ""


def _find_province_code(full_address: str) -> str | None:
    """Scans for a bare province code rather than assuming it's always the
    literal last word - real addresses vary in whether the postal code
    trails the province ("MERATE, LC 23807") or precedes it ("20014
    NERVIANO MI"), and some use a hyphenated "IT-TO" form where a plain
    split would merge into one non-matching token. Takes the rightmost
    valid match, since a province code earlier in the string is more
    likely to be part of a street/city name that coincidentally forms a
    real code (rare, but why "rightmost" beats "first")."""
    addr = full_address.upper().strip()
    without_country = _TRAILING_COUNTRY_RE.sub("", addr).strip()
    candidates = [m for m in _TWO_LETTER_TOKEN_RE.findall(without_country) if m in PROVINCE_TO_REGION]
    return candidates[-1] if candidates else None


def region_from_address(full_address: str | None) -> str | None:
    """Best-effort region name for storage/filtering - not a gate (see
    matches_italy), so returning None for a messy/incomplete address is
    fine and expected."""
    if not full_address:
        return None

    # Matched only against the address *minus its first (street) segment*,
    # same as the province-name check below it - a region name can appear in
    # a street name too (e.g. "144 CORSO LOMBARDIA, TORINO, PIEMONTE 10149,
    # IT", a Turin store on a street named after Lombardia), so searching
    # the full address here caused real mis-tagging before this was fixed.
    rest = _without_street_segment(full_address)
    for region in ALL_REGION_NAMES:
        if region in rest:
            return region

    for province_name, region in PROVINCE_NAME_TO_REGION.items():
        if province_name in rest:
            return region

    code = _find_province_code(full_address)
    return PROVINCE_TO_REGION.get(code) if code else None
