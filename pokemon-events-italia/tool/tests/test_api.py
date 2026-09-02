"""Tests for pokemon_events/api.py's normalization, in particular
_fix_mislabeled_local_time() - see that function's own docstring for the
full story of what bug this corrects and how it was confirmed."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pokemon_events.api import _fix_mislabeled_local_time, normalize_event


class FixMislabeledLocalTimeTests(unittest.TestCase):
    def test_summer_cest_offset(self):
        # The exact case that surfaced this bug: a store's official
        # ticketing page showed 8:30 PM (20:30) local for this event: our
        # stored value ("Z"-suffixed, claiming UTC) was actually already
        # 20:30 Rome-local, so treating it as UTC and converting to
        # Europe/Rome for display produced 22:30 - 2 hours late, exactly
        # matching the CEST offset.
        self.assertEqual(_fix_mislabeled_local_time("2026-09-29T20:30:00Z", "Europe/Rome"), "2026-09-29T18:30:00Z")

    def test_winter_cet_offset(self):
        self.assertEqual(_fix_mislabeled_local_time("2026-01-15T15:00:00Z", "Europe/Rome"), "2026-01-15T14:00:00Z")

    def test_plus_zero_offset_format(self):
        # registration_start/registration_end come back as "+00:00" rather
        # than "Z" in some responses - same bug, same fix.
        self.assertEqual(_fix_mislabeled_local_time("2026-09-01T15:30:00+00:00", "Europe/Rome"), "2026-09-01T13:30:00Z")

    def test_missing_value_passes_through(self):
        self.assertIsNone(_fix_mislabeled_local_time(None, "Europe/Rome"))
        self.assertEqual(_fix_mislabeled_local_time("", "Europe/Rome"), "")

    def test_missing_timezone_falls_back_to_europe_rome(self):
        self.assertEqual(_fix_mislabeled_local_time("2026-09-29T20:30:00Z", None), "2026-09-29T18:30:00Z")

    def test_malformed_value_falls_back_to_the_raw_string_unchanged(self):
        # One bad row from upstream shouldn't crash the whole scrape.
        self.assertEqual(_fix_mislabeled_local_time("not-a-date", "Europe/Rome"), "not-a-date")


class NormalizeEventTests(unittest.TestCase):
    def _raw_event(self, **overrides):
        base = {
            "Guid": "abc-123",
            "Address": {"Latitude": "44.4949", "Longitude": "11.3426", "Timezone": "Europe/Rome"},
            "Start_date": "2026-09-29T20:30:00Z",
            "Registration_start": "2026-09-01T15:30:00+00:00",
            "Registration_end": "2026-09-26T15:30:00Z",
        }
        base.update(overrides)
        return base

    def test_dates_are_corrected_using_the_events_own_venue_timezone(self):
        event = normalize_event(self._raw_event())
        self.assertEqual(event["start_date"], "2026-09-29T18:30:00Z")
        self.assertEqual(event["registration_start"], "2026-09-01T13:30:00Z")
        self.assertEqual(event["registration_end"], "2026-09-26T13:30:00Z")
        # The raw Timezone value itself is still stored as-is, unrelated to
        # the date correction above.
        self.assertEqual(event["timezone"], "Europe/Rome")

    def test_missing_coordinates_still_returns_none(self):
        self.assertIsNone(normalize_event(self._raw_event(Address={"Latitude": None, "Longitude": None})))


if __name__ == "__main__":
    unittest.main()
