"""Payload construction and response parsing for the Pokemon Event Locator's
DataActionGetEventList screen action.

`build_payload` starts from the full request body captured from a real
browser session (see captured_request_template.json) and only overrides the
handful of fields known to drive the search, rather than hand-reconstructing
a trimmed body and guessing what the OutSystems app actually requires
server-side.

Response shape was confirmed by manually capturing a live response (see
tool/README.md "Known unknowns" for how): `response["data"]["EventList"]["List"]`
is a list of `{"Events": {...}}` wrappers - NOT either of the two shapes
(`BigEventDetail`/`RelatedEvents` or `LocationsShown`) visible in the request
template, which turned out to be unrelated screen state, not the actual
list shape.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

from .browser_client import SearchParams

TEMPLATE_PATH = Path(__file__).resolve().parent / "captured_request_template.json"


def _load_template() -> dict:
    return json.loads(TEMPLATE_PATH.read_text())


def build_payload(search: SearchParams, max_records: int) -> dict:
    payload = copy.deepcopy(_load_template())
    variables = payload["screenData"]["variables"]
    variables["latitude"] = search.latitude
    variables["longitude"] = search.longitude
    variables["range"] = search.range_km
    variables["iskm"] = "true"
    variables["filters"] = search.filters
    variables["locale"] = search.locale
    variables["MaxRecords"] = max_records
    variables["FilterList"]["List"] = [search.filters]
    variables["FiltersOnHold"] = search.filters

    client_vars = payload["clientVariables"]
    client_vars["Latitude"] = search.latitude
    client_vars["Longitude"] = search.longitude
    client_vars["Range"] = search.range_km
    client_vars["StartDate"] = search.start_date
    client_vars["UserLocale"] = search.locale
    client_vars["OldUserLocale"] = search.locale

    return payload


def parse_event_list(response: dict) -> list[dict]:
    """Extract the raw list of event records (the `Events` sub-object of
    each list item) from the response envelope."""
    try:
        items = response["data"]["EventList"]["List"]
    except (KeyError, TypeError) as exc:
        raise ValueError(
            f"Unexpected response shape - no data.EventList.List. Top-level keys: {sorted(response.keys())}"
        ) from exc
    return [item["Events"] for item in items if isinstance(item, dict) and "Events" in item]


def normalize_event(raw: dict) -> dict | None:
    """Map one raw `Events` record into the flat storage schema.

    Raw fields are kept close to their source names/values rather than
    translated into presentation strings - that's the frontend's job (see
    the sibling vgc-tournament-explorer's export_static.py for the same
    convention). Returns None for a record missing its GUID or coordinates,
    since those are required to store/plot it at all.
    """
    guid = raw.get("Guid")
    address = raw.get("Address") or {}
    lat_raw, lon_raw = address.get("Latitude"), address.get("Longitude")
    if not guid or not lat_raw or not lon_raw:
        return None
    try:
        latitude, longitude = float(lat_raw), float(lon_raw)
    except (TypeError, ValueError):
        return None
    if latitude == 0.0 and longitude == 0.0:
        return None

    contact = raw.get("Contact_information") or {}
    activity_group = raw.get("ActivityGroup") or {}
    series = raw.get("Series") or {}
    tags = ((series.get("Tags") or {}).get("List")) or []
    attributes = [a.get("Display_name") for a in (raw.get("Attributes") or {}).get("List") or [] if a.get("Display_name")]

    return {
        "guid": guid,
        "display_id": raw.get("Display_id") or None,
        "name": raw.get("Name") or None,
        "activity_type": raw.get("Activity_type") or None,
        "event_type_tags": tags,
        "series_name": series.get("Name") or None,
        "category": raw.get("Category") or None,
        "products": (raw.get("Products") or {}).get("List") or [],
        "status": raw.get("Status") or None,
        "start_date": raw.get("Start_date") or None,
        "registration_start": raw.get("Registration_start") or None,
        "registration_end": raw.get("Registration_end") or None,
        "admission": raw.get("Admission") or None,
        "details": raw.get("Details") or None,
        "event_website": raw.get("Event_website") or None,
        "third_party_registration_website": raw.get("Third_party_registration_website") or None,
        "contact_email": contact.get("Email") or None,
        "contact_phone": contact.get("Phone") or None,
        "venue_name": address.get("Name") or None,
        "full_address": address.get("Full_address") or None,
        "latitude": latitude,
        "longitude": longitude,
        "timezone": address.get("Timezone") or None,
        "activity_group_name": activity_group.get("Display_name") or None,
        "activity_group_display_id": activity_group.get("Display_Id") or None,
        "attributes": attributes,
    }
