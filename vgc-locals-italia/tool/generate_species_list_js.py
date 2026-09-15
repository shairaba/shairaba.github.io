"""Regenerate ../species-list.js from species_reference.py's SPECIES_LIST.

species_reference.py is the single source of truth for legal species (used
by ingest.py's server-side validation); this mirrors it into a JS array the
submission page (submit.html/submit.js) loads for its species picker and
its own client-side validation.

Ordering matters here (it's the order the picker's suggestions show in,
before the TO has typed anything to filter): "Unknown" always comes first
(a rarely-needed utility entry, not a popularity contender - see
species_reference.py's note on it), then every species that's actually
been used at least once, ranked by current usage (most first, since a TO
entering another team is more likely typing a species they've already seen
this session or ones that are simply popular), then everything else
alphabetically as a fallback tier.

ingest.py calls write_species_list_js() itself at the end of every run
(with the usage ranking it just computed), so the picker's order stays
current automatically - no separate manual step needed for *ordering* (only
for adding/removing species from SPECIES_LIST itself). Can still be run
standalone for that case:

    python3 generate_species_list_js.py
"""

import json
from pathlib import Path

from species_reference import SPECIES_LIST

OUTPUT = Path(__file__).resolve().parent.parent / "species-list.js"


def ordered_species_list(usage_ranking=None):
    """usage_ranking: species_ids ordered most-to-least used (e.g. from
    ingest.py's usage_stats() on the pooled dashboard data), or None for a
    plain alphabetical list (SPECIES_LIST's own order, standalone-run case)."""
    by_id = {sid: name for name, sid in SPECIES_LIST}
    if not usage_ranking:
        return list(SPECIES_LIST)

    rank = {sid: i for i, sid in enumerate(usage_ranking) if sid in by_id}
    unknown = [("Unknown", "unknown")] if "unknown" in by_id else []
    ranked = sorted(
        (sid for sid in rank if sid != "unknown"), key=lambda sid: rank[sid]
    )
    unranked = sorted(
        (sid for _, sid in SPECIES_LIST if sid not in rank and sid != "unknown"),
        key=lambda sid: by_id[sid].lower(),
    )
    return unknown + [(by_id[sid], sid) for sid in ranked + unranked]


def write_species_list_js(usage_ranking=None):
    entries = [{"n": name, "i": sid} for name, sid in ordered_species_list(usage_ranking)]
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
    write_species_list_js()
