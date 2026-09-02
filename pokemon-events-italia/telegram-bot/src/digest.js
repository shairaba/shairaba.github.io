import { eventTypeKey } from "./data.js";
import { passesFilter } from "./prefs.js";
import { formatEventBody } from "./eventFormat.js";

export const EVENTS_URL = "https://shairaba.github.io/pokemon-events-italia/data/events.json";

/* First run for a chat (lastNotifiedAt still null) looks back 24h rather
   than dumping the entire multi-year dataset as "new" - a fresh subscriber
   gets tomorrow's digest as their first real one, not a backlog. */
const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function fetchEvents(fetchImpl = fetch) {
  const res = await fetchImpl(EVENTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch events.json: HTTP ${res.status}`);
  const data = await res.json();
  return Object.values(data.events || {});
}

/* Whichever of these actually reflects "did something worth telling someone
   about happen to this event" - last_updated_at (added by the scraper's
   store.py) only moves when a field genuinely changed, unlike last_seen_at
   which bumps on every single re-scrape regardless. Falls back to
   first_seen_at for rows scraped before last_updated_at existed. */
function lastChangeMs(event) {
  const changedAt = event.last_updated_at || event.first_seen_at;
  if (!changedAt) return NaN;
  return new Date(changedAt).getTime();
}

/* True for an event that's never been edited since it was first scraped -
   used to label digest entries "🆕 Nuovo" vs "✏️ Aggiornato" rather than
   lumping genuinely new events and edits to already-notified ones into one
   undifferentiated list. */
export function isNewEvent(event) {
  return (event.last_updated_at || event.first_seen_at) === event.first_seen_at;
}

/* An event matches a chat's digest when: it's new or has changed since the
   chat's last check, it hasn't already happened, and it clears all three
   filters (region/type/game - unset filters pass everything, see prefs.js). */
export function matchesChat(event, prefs, sinceMs, nowMs) {
  const changedMs = lastChangeMs(event);
  if (isNaN(changedMs) || changedMs <= sinceMs) return false;

  if (!event.start_date) return false;
  const start = new Date(event.start_date).getTime();
  if (isNaN(start) || start < nowMs) return false;

  if (!passesFilter(prefs.regions, event.region)) return false;
  if (!passesFilter(prefs.types, eventTypeKey(event))) return false;
  if (!passesFilter(prefs.stores, event.activity_group_display_id)) return false;
  if (prefs.games !== null && prefs.games !== undefined) {
    const products = event.products || [];
    if (!products.some((p) => prefs.games.includes(p))) return false;
  }
  return true;
}

function eventLine(event) {
  const tag = isNewEvent(event) ? "🆕 <b>Nuovo</b>" : "✏️ <b>Aggiornato</b>";
  return `${tag}\n${formatEventBody(event)}`;
}

/* Telegram caps a message at 4096 chars and rejects an oversized send
   outright, with no partial-send fallback - splits the event list into
   multiple messages once adding another event would cross this soft cap
   (well under the hard limit, deliberately, for headroom). The overflow
   check below runs before adding EVERY line, including the first one in a
   fresh segment - eventFormat.js's MAX_ADDRESS_LENGTH/MAX_URL_LENGTH bound
   the two scraped fields that actually vary in length, so in practice no
   single event's line gets anywhere near this cap, but the check doesn't
   rely on that: even a hypothetical event whose own line alone exceeded
   MAX_MESSAGE_LENGTH would just become a message of its own next iteration
   rather than silently riding along attached to the previous line. */
const MAX_MESSAGE_LENGTH = 3500;

function digestHeader(events) {
  const newCount = events.filter(isNewEvent).length;
  const updatedCount = events.length - newCount;
  if (newCount > 0 && updatedCount > 0) {
    return `<b>${newCount} nuov${newCount === 1 ? "o" : "i"} e ${updatedCount} aggiornat${updatedCount === 1 ? "o" : "i"}</b> tra gli eventi che ti interessano:\n\n`;
  }
  if (updatedCount > 0) {
    return `✏️ <b>${updatedCount} event${updatedCount === 1 ? "o aggiornato" : "i aggiornati"}</b> che potrebbero interessarti:\n\n`;
  }
  return `🆕 <b>${newCount} nuov${newCount === 1 ? "o evento" : "i eventi"}</b> che potrebbero interessarti:\n\n`;
}

export function formatDigest(events) {
  const header = digestHeader(events);
  const lines = events.map(eventLine);
  const messages = [];
  let current = header;
  let segmentHasEvents = false;
  for (const line of lines) {
    if (segmentHasEvents && current.length + line.length + 2 > MAX_MESSAGE_LENGTH) {
      messages.push(current.trim());
      current = "";
      segmentHasEvents = false;
    }
    current += line + "\n\n";
    segmentHasEvents = true;
  }
  if (segmentHasEvents) messages.push(current.trim());
  return messages;
}

/* Returns { chatId, prefs, messages, matchedCount } for every subscribed
   chat that has at least one new matching event this run - callers persist
   the timestamp update and actually send after this. Kept separate from
   the KV/send loop in index.js so the matching/formatting logic can be
   exercised without a real KV binding or bot token. */
export function buildDigests(chats, events, nowMs) {
  const results = [];
  for (const { chatId, prefs } of chats) {
    const sinceMs = prefs.lastNotifiedAt ? new Date(prefs.lastNotifiedAt).getTime() : nowMs - FIRST_RUN_LOOKBACK_MS;
    const matched = events
      .filter((e) => matchesChat(e, prefs, sinceMs, nowMs))
      .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
    if (matched.length === 0) continue;
    results.push({ chatId, prefs, messages: formatDigest(matched), matchedCount: matched.length });
  }
  return results;
}
