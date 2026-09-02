import { eventTypeKey, REGION_LABELS } from "./data.js";
import { passesFilter } from "./prefs.js";
import { formatEventBody } from "./eventFormat.js";

/* The "/list" workmode, distinct from the daily digest: instead of telling
   a chat about events that are NEW since their last check, it maintains a
   standing set of messages showing every upcoming event that currently
   matches their filters - edited in place (via editMessageText) rather
   than resent, both on demand (running /list again) and via the daily
   refresh cron. Reuses the same regions/types/games/stores prefs as the
   digest (see prefs.js) rather than a separate filter set, so "/settings"
   configures both workmodes at once. */

/* Telegram caps a single message at 4096 chars, so a broad filter's result
   set can need more than one (index.js tracks one message id per page in
   prefs.listMessageIds). MAX_PAGES is a hard ceiling on top of that - an
   unfiltered subscription matches ~4000 upcoming events in the live
   dataset (recurring weekly leagues dominate), and even splitting THAT
   across as many messages as it takes would spam dozens of them on every
   refresh. Past the ceiling, the last page notes how many events were left
   out and points at /settings to narrow down. */
const MAX_PAGES = 2;
const MESSAGE_LENGTH_CAP = 3900;

/* Same shape as digest.js's matchesChat() minus the "changed since last
   check" requirement - this mode always shows everything upcoming that
   matches, not just what's new. */
export function matchesListFilters(event, prefs, nowMs) {
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

const eventLine = formatEventBody;

/* Short human summary of the active scope for the header - stores take
   priority over regions when both happen to be set (stores are the more
   specific filter), falling back to "tutte le regioni" when neither is. */
function describeScope(prefs) {
  if (prefs.stores && prefs.stores.length > 0) {
    return prefs.stores.length === 1 ? "1 negozio selezionato" : `${prefs.stores.length} negozi selezionati`;
  }
  if (prefs.regions && prefs.regions.length > 0) {
    return prefs.regions.map((r) => REGION_LABELS[r] || r).join(", ");
  }
  return "tutte le regioni";
}

function formatUpdatedAt(nowMs) {
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString();
  }
}

/* Builds the standing "/list" message(s) as an array - one entry per
   Telegram message, in order, up to MAX_PAGES. Every page repeats the
   header (with a "(1/2)" tag once there's more than one, so a page makes
   sense read on its own - these are standing messages someone might look
   at independently, not a one-time notification read top to bottom) and
   only the LAST page gets the omitted-count note and the "Aggiornato: ..."
   timestamp, since the whole point of this mode is that the messages get
   edited in place and that timestamp is the only visible sign a refresh
   actually happened. */
export function buildListTexts(events, prefs, nowMs) {
  const matched = events
    .filter((e) => matchesListFilters(e, prefs, nowMs))
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));

  const scope = describeScope(prefs);
  const footer = `\n<i>Aggiornato: ${formatUpdatedAt(nowMs)}</i>`;

  if (matched.length === 0) {
    return [`📋 <b>Tornei in programma</b> — ${scope}\n\nNessun torneo in programma al momento con questi filtri.${footer}`];
  }

  // Pack event blocks into pages, stopping once MAX_PAGES is full - the
  // event that would have started an (unwanted) MAX_PAGES+1th page just
  // gets counted as omitted instead. Uses a page-number-free header length
  // for the size check - the few extra characters an actual "(1/2)" tag
  // adds are trivial against MESSAGE_LENGTH_CAP's margin below Telegram's
  // real 4096-char limit, so it doesn't need to be exact here.
  const genericHeaderLength = `📋 <b>Tornei in programma</b> — ${scope}\n\n`.length;
  const pages = [];
  let currentBlocks = [];
  let currentLength = genericHeaderLength;
  let shown = 0;
  for (const event of matched) {
    const block = eventLine(event) + "\n\n";
    if (currentBlocks.length > 0 && currentLength + block.length > MESSAGE_LENGTH_CAP) {
      pages.push(currentBlocks);
      if (pages.length >= MAX_PAGES) break;
      currentBlocks = [];
      currentLength = genericHeaderLength;
    }
    currentBlocks.push(block);
    currentLength += block.length;
    shown++;
  }
  if (currentBlocks.length > 0 && pages.length < MAX_PAGES) pages.push(currentBlocks);

  const omitted = matched.length - shown;
  const totalPages = pages.length;
  return pages.map((blocks, i) => {
    const pageTag = totalPages > 1 ? ` (${i + 1}/${totalPages})` : "";
    const header = `📋 <b>Tornei in programma</b> — ${scope}${pageTag}\n\n`;
    const isLastPage = i === totalPages - 1;
    const omittedNote = isLastPage && omitted > 0 ? `\n… e altri ${omitted} eventi. Affina i filtri con /settings per vederli tutti.\n` : "";
    const trailer = isLastPage ? omittedNote + footer : "";
    return (header + blocks.join("") + trailer).trim();
  });
}
