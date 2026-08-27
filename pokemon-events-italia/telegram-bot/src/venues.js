/* There's no small fixed list of stores the way there is for regions/types/
   games (~390 of them, and it changes as new venues get scraped), so
   instead of a checklist menu, store selection works by search: the user
   types part of a name and picks from the matches. This module builds that
   searchable index from the live events.json (already fetched for the
   digest anyway) and matches against it. */

export function buildVenueIndex(events) {
  const byId = new Map();
  for (const event of events) {
    const id = event.activity_group_display_id;
    if (!id || byId.has(id)) continue;
    const name = event.activity_group_name || event.venue_name;
    if (!name) continue;
    byId.set(id, { id, name });
  }
  return byId;
}

const MAX_SEARCH_RESULTS = 8;

export function searchVenues(venueIndex, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = [];
  for (const venue of venueIndex.values()) {
    if (venue.name.toLowerCase().includes(q)) matches.push(venue);
    if (matches.length >= MAX_SEARCH_RESULTS) break;
  }
  return matches;
}

export function venueName(venueIndex, id) {
  const venue = venueIndex.get(id);
  return venue ? venue.name : id;
}
