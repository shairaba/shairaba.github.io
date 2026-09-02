import { eventTypeKey, TYPE_LABELS } from "./data.js";

/* Shared by both workmodes (digest.js, list.js) - the per-event rendering
   used to live duplicated in each, which is exactly the kind of thing that
   quietly drifts apart over time, so it's factored out here instead. */

export const SITE_BASE = "https://shairaba.github.io/pokemon-events-italia/";

export function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatEventDate(event) {
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: event.timezone || "Europe/Rome",
    }).format(new Date(event.start_date));
  } catch {
    return event.start_date;
  }
}

/* Ported from the main site's app.js formatAdmission()/stripZeroDecimals()
   (non-compact form - there's room here, unlike the site's fixed-height
   event-card pill). Keep in sync by hand if the site's parsing ever
   changes - same reasoning as data.js's region/type/game copy: this Worker
   runs in a separate runtime and can't import the site's client-side module
   directly. Handles a plain amount ("5", "10,00"), one with a currency
   symbol/word ("€10", "10 euro"), and two-tier "preiscritti/non
   preiscritti" pricing scraped as free text. */
function stripZeroDecimals(amount) {
  return amount.replace(/[.,]00$/, "");
}

export function formatAdmission(event) {
  const raw = (event.admission || "").trim();
  if (!raw) return null;

  const tierRe = /(?:euro\s*|€\s*)?([\d.,]+)\s*(?:€)?\s*\(?(non\s*preiscritt[ei]|preiscritt[ei])\)?/gi;
  const tiers = [...raw.matchAll(tierRe)];
  if (tiers.length >= 2) {
    return tiers
      .map(([, amount, label]) => `${stripZeroDecimals(amount)}€ (${label.replace(/\s+/g, " ").toLowerCase()})`)
      .join(" · ");
  }

  if (/^[\d.,]+$/.test(raw)) return `${stripZeroDecimals(raw)}€`;
  const symbolMatch = raw.match(/^€?\s*([\d.,]+)\s*€?$/);
  if (symbolMatch) return `${stripZeroDecimals(symbolMatch[1])}€`;
  const wordMatch = raw.match(/^([\d.,]+)\s*(?:euro|eur|chf)$/i);
  if (wordMatch) return `${stripZeroDecimals(wordMatch[1])}€`;

  return raw;
}

export function googleMapsDirectionsUrl(event) {
  return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
}

/* Address as scraped, minus the redundant trailing country name - every
   event here is already known to be in Italy (the whole site/bot is
   Italy-only), so ", ITALY"/", IT" at the end is just noise. Left in its
   original ALL-CAPS casing rather than attempting to title-case it: the
   source data mixes real proper nouns with all-caps province codes ("...
   CINISELLO BALSAMO MI") that a naive title-case would mangle into "Mi",
   and the site itself displays full_address raw for the same reason.
   Hard-capped at MAX_ADDRESS_LENGTH (comfortably above anything real - the
   longest in the live dataset today is ~100 chars) as a defensive bound: a
   scraped field with no length limit of its own flowing straight into a
   Telegram message is exactly the kind of thing that can quietly blow past
   the 4096-char message cap if the source data ever gets weird. */
const MAX_ADDRESS_LENGTH = 200;

export function formatAddress(event) {
  if (!event.full_address) return null;
  const cleaned = event.full_address.replace(/,\s*(italy|it)\s*$/i, "");
  return cleaned.length > MAX_ADDRESS_LENGTH ? cleaned.slice(0, MAX_ADDRESS_LENGTH - 1) + "…" : cleaned;
}

/* Same defensive reasoning as MAX_ADDRESS_LENGTH above, but a URL can't be
   truncated the way plain text can (a cut-off URL is just broken, and
   worse, truncating mid-tag would corrupt the surrounding HTML) - so past
   this length the link is dropped entirely rather than shown mangled.
   500 is generous headroom over the longest real one today (~112 chars). */
const MAX_URL_LENGTH = 500;

const DETAILS_LABEL = "Dettagli";
const DIRECTIONS_LABEL = "Portami lì";
const SIGNUP_LABEL = "Preiscrizioni";

/* The multi-line block shared by both workmodes: date+type header, address
   and price (only when the data actually has them - most events have
   neither a price nor a pre-registration link), and the action links.
   digest.js prepends its own "🆕 Nuovo"/"✏️ Aggiornato" tag in front of
   this; list.js uses it as-is. */
export function formatEventBody(event) {
  const typeLabel = TYPE_LABELS[eventTypeKey(event)];
  const lines = [`🗓 <b>${formatEventDate(event)}</b> - ${typeLabel}`];

  const address = formatAddress(event);
  if (address) lines.push(`🗺 ${escapeHtml(address)}`);

  const admission = formatAdmission(event);
  if (admission) lines.push(`💰 ${admission}`);

  const link = `${SITE_BASE}event.html?guid=${encodeURIComponent(event.guid)}`;
  const actions = [`<a href="${link}">${DETAILS_LABEL}</a>`];
  if (event.latitude && event.longitude) {
    actions.push(`<a href="${googleMapsDirectionsUrl(event)}">${DIRECTIONS_LABEL}</a>`);
  }
  if (event.third_party_registration_website && event.third_party_registration_website.length <= MAX_URL_LENGTH) {
    actions.push(`<a href="${escapeHtml(event.third_party_registration_website)}">${SIGNUP_LABEL}</a>`);
  }
  lines.push(actions.join(" - "));

  return lines.join("\n");
}
