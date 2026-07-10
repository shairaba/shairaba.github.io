// Curated list of every item actually holdable by a Pokemon in Pokemon
// Champions battles (hold items, mega stones, berries) - scraped from
// https://www.serebii.net/pokemonchampions/items.shtml and trimmed of that
// page's non-holdable meta-game entries (per-type Affinity Tickets,
// Guaranteed-Ball Tickets, Quick Coupon, Teammate/Training Ticket - none of
// those are ever actually held by a battling Pokemon). Used to sanity-check
// the manual-review picker's item candidates/dropdown (see main.mjs)
// against what Champions can legally hold - the bundled item database
// (idToNameByLang.item, used for the initial OCR fuzzy-match) is a much
// broader generic Pokemon items list that includes plenty of real items
// Champions doesn't support at all.
import { slugify } from "./spellCorrect.mjs";

const ITEMS_URL = new URL("../Resources/championsItems.json", import.meta.url).href;

let itemsPromise = null;
function loadItems() {
  if (!itemsPromise) {
    itemsPromise = fetch(ITEMS_URL).then((r) => r.json());
  }
  return itemsPromise;
}

// The full Champions-legal item list, in their canonical display form
// (e.g. "King's Rock", "Charizardite X") - used to populate the manual-
// entry dropdown in full.
export async function getLegalItems() {
  return loadItems();
}

// Compared by slug rather than exact display string - this list was hand-
// transcribed from a different source than the bundled item database, so
// matching on slugify() output (case/punctuation-insensitive) is more
// robust than requiring the two sources' formatting to agree exactly.
export async function isLegalItem(name) {
  if (!name) return false;
  const items = await loadItems();
  const slug = slugify(name);
  return items.some((it) => slugify(it) === slug);
}

// Narrows a list of candidate item names (e.g. spellCorrectCandidates'
// output) down to the ones that are actually Champions-legal, same slug
// comparison as isLegalItem.
export async function filterLegalItems(names) {
  const items = await loadItems();
  const legalSlugs = new Set(items.map(slugify));
  return names.filter((n) => legalSlugs.has(slugify(n)));
}
