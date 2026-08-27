/* Region/type/game metadata, deliberately duplicated from the main site's
   app.js rather than shared - this Worker runs in a completely separate
   runtime (Cloudflare Workers, no DOM, no access to the repo's own files at
   request time) and the list is small and rarely changes, so a copy is
   simpler and lower-risk than trying to share a module across two very
   different execution environments. Keep these in sync with app.js by hand
   if the site ever adds/renames a region or event type. */

export const REGION_LABELS = {
  "PIEMONTE": "Piemonte",
  "VALLE D'AOSTA": "Valle d'Aosta",
  "LOMBARDIA": "Lombardia",
  "TRENTINO-ALTO ADIGE": "Trentino-Alto Adige",
  "VENETO": "Veneto",
  "FRIULI-VENEZIA GIULIA": "Friuli-Venezia Giulia",
  "LIGURIA": "Liguria",
  "EMILIA-ROMAGNA": "Emilia-Romagna",
  "TOSCANA": "Toscana",
  "UMBRIA": "Umbria",
  "MARCHE": "Marche",
  "LAZIO": "Lazio",
  "ABRUZZO": "Abruzzo",
  "MOLISE": "Molise",
  "CAMPANIA": "Campania",
  "PUGLIA": "Puglia",
  "BASILICATA": "Basilicata",
  "CALABRIA": "Calabria",
  "SICILIA": "Sicilia",
  "SARDEGNA": "Sardegna",
};
export const REGION_KEYS = Object.keys(REGION_LABELS);

export const TYPE_LABELS = {
  cup: "Coppa di Lega",
  challenge: "Sfida di Lega",
  tournament: "Torneo",
  league: "Lega",
};
export const TYPE_KEYS = Object.keys(TYPE_LABELS);

export const GAME_LABELS = {
  vg: "Video Game",
  tcg: "GCC",
  pgo: "GO",
};
export const GAME_KEYS = Object.keys(GAME_LABELS);

/* Same classification rule as the site's eventTypeKey() in app.js - keeps
   the bot's "type" filter matching exactly what a visitor would see on the
   event card/detail page for the same event. */
export function eventTypeKey(event) {
  const series = event.series_name || "";
  if (/league cup/i.test(series)) return "cup";
  if (/league challenge/i.test(series)) return "challenge";
  return event.activity_type === "tournament" ? "tournament" : "league";
}
