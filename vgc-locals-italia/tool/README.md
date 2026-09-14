# vgc-locals-italia/tool

Python pipeline that turns the Italian VGC Locals Google Form's responses
into the static JSON `../index.html` reads. No database - the dataset is
small enough (at most 8 rows per tournament) that `ingest.py` just
regenerates everything from the Sheet on every run.

## Local run

```
pip install -r requirements.txt
python ingest.py
```

Requires `CSV_URL` in `ingest.py` to already point at the published Sheet
(see setup below). Writes `../data/dashboard.json`, `../data/tournaments.json`,
and one `../data/tournaments/<id>.json` per tournament. Warnings (bad rows,
unrecognized species, a tournament with more rows than its derived top cut
size) print to stderr but don't stop the run - a single bad tournament
shouldn't block publishing everyone else's data.

## How organizers actually submit data

There are two ways a submission reaches the Form's response Sheet:

- **`../submit.html`** (recommended, linked from the dashboard's nav) - a
  custom page that POSTs straight to the Form's hidden `formResponse`
  endpoint. A TO fills in the tournament once, then one card per top-cut
  player with a searchable Pok&eacute;mon picker that shows each match's
  sprite (backed by
  `species_reference.py`'s full list, via `../species-list.js`) instead of
  the Form's own dropdown UI. It also removes two sources of TO error: the
  tournament ID is generated automatically (so nobody has to retype an
  identical string N times) and each player's placement is inferred from the
  order they're entered in (1st, 2nd, ... - no separate field to fill in).
  See "Configuring submit.html" below.
- **The raw Google Form** - still works as a fallback (e.g. if the
  unofficial `formResponse` POST trick ever breaks). A TO would need to
  manually retype the same Tournament ID for every player and manually enter
  a placement value themselves.

Either way, rows land in the same Sheet and `ingest.py` doesn't care which
path a row came from.

## One-time setup (Google Form + Sheet)

1. Create a Google Form with these fields, in order:

   | # | Field | Type | Notes |
   |---|-------|------|-------|
   | 1 | Tournament ID | Short answer, required | Stable grouping key - **the exact same value** for every player of one event. `submit.html` generates and fills this in automatically (slugified name + date); a TO using the raw Form directly would need to type it identically for every row. |
   | 2 | Tournament Name | Short answer, required | Human-readable, e.g. "Milano Winter Locals #3". |
   | 3 | Tournament Date | **Short answer** (not the Date question type), required | Use `YYYY-MM-DD`. Kept as plain text rather than a Date question so it maps to a single `entry.<id>` - Google's Date question type splits into separate year/month/day entry ids, which `submit.html`'s POST payload doesn't build. |
   | 4 | Type of Tournament | Dropdown: `VG Cup`, `VG Challenge`, required | |
   | 5 | Number of Players | Short answer or Number, required | Total entrants, not top cut size. Top cut size is derived from this (see below), not asked directly. |
   | 6 | TO Name | Short answer, required | For following up on data issues; never published. |
   | 7 | Player Name | Short answer, optional | Falls back to anonymous if left blank. |
   | 8 | Placement | Short answer, optional | `submit.html` fills this in automatically from the order players are entered (1st, 2nd, ...) - a TO using the raw Form directly would need to type it themselves. |
   | 9-14 | Pok&eacute;mon 1 .. Pok&eacute;mon 6 | **Short answer**, required, all six identical | Deliberately *not* a Dropdown: `species_reference.SPECIES_LIST` has 344 entries, which is both tedious to configure as Form choices and a bad dropdown UX for anyone using the raw Form. `submit.html` provides its own searchable picker instead (backed by `species-list.js`), and since Google doesn't enforce a Dropdown's configured choices on a direct `formResponse` POST anyway, a Dropdown here wouldn't add real protection - `ingest.py`'s `lookup_species()` is the actual gate either way, for rows from either path. |

   Keep each question's title exactly as above - `ingest.py`'s `HEADER_MAP`
   matches the Form's own question titles (which become the CSV's column
   headers) case-insensitively.

   **Top cut size** is derived from Number of Players by `derive_top_cut_size()`
   in `ingest.py` (mirrored in `submit.js`'s `deriveTopCutSize()`): fewer than
   9 entrants -> top 2, 9-16 -> top 4, 17+ -> top 8. It's never asked as its
   own Form field.

2. Link the Form to a Google Sheet (its own "Responses" destination works).
3. In that Sheet: **File → Share → Publish to web** → select the
   responses tab → format **Comma-separated values (.csv)** → Publish.
   Copy the resulting URL.
4. Paste that URL into `ingest.py`'s `CSV_URL` constant and commit.
5. No GitHub Secret is needed - a published-to-web CSV URL is already public
   by design. (If you'd rather not have that URL visible in the public repo,
   swap it for a `CSV_URL` repository secret read via `env:` in the workflow
   instead - not done by default since there's no real confidentiality need
   here.)

## Configuring submit.html

`../submit.js`'s `FORM_CONFIG` at the top of the file has two placeholders
to fill in once the Form exists:

1. **`actionUrl`** - take the Form's own share URL
   (`https://docs.google.com/forms/d/e/<FORM_ID>/viewform`) and swap
   `viewform` for `formResponse`.
2. **`entryIds`** - one numeric id per question. Two ways to read these off
   the live Form:
   - **Fastest**: `curl` (or just view-source) the Form's `viewform` URL and
     look for the inline `FB_PUBLIC_LOAD_DATA_ = [...]` JS blob - it's a
     JSON array with one entry per question. Each question looks like
     `[questionId, "Question Title", null, questionType, [[entryId, ...]],
     ...]` - the `entryId` in that nested array (not the outer
     `questionId`) is what goes in `FORM_CONFIG.entryIds`. Parsing it with
     `json.loads()` after extracting the array literal is more reliable
     than eyeballing it - the array is deeply nested and easy to miscount by
     hand.
   - **Fallback** (if Google ever changes that page structure): open the
     Form, click the 3-dot menu → **Get pre-filled link**, fill in a
     recognizably-different dummy value per field (e.g. "AAAAA", "BBBBB",
     ...), click **Get link**, then open that generated link and look at
     its URL's query string - each `entry.<number>=<your dummy value>` pair
     tells you which id belongs to which field.

   Either way, map them into `FORM_CONFIG.entryIds` by key (`tournament_id`,
   `tournament_name`, ... `mon_1`..`mon_6`).

After that, `submit.html` posts directly to the Form/Sheet - no further
config needed. If you ever edit or reorder the Form's questions, re-check
these ids; nothing will error, but submissions could silently land in the
wrong column.

## Species list maintenance

`species_reference.py`'s `SPECIES_LIST` was bootstrapped from every species
actually used in real M-B (Pokemon Champions' regulation before M-C) results
already tracked by `../../vgc-tournament-explorer`, then hand-cleaned of
scrape artifacts, and extended with every Mega Evolution (plus a few base
forms that had none in the M-B data, and Champions-exclusive "Mega X Z"
variants) per a community roster page - see the module docstring for the
full details and caveats on both sources. It's still "observed legal + all
Megas," not "every currently legal species" - before publishing the Form,
or whenever a new regulation drops, double check it against Pokemon
Champions' current roster and extend it if anything's missing.

**After editing `SPECIES_LIST`, regenerate the JS mirror the submission page
uses:**

```
python3 generate_species_list_js.py
```

This writes `../species-list.js`. `submit.html`'s species picker and
client-side validation read from that generated file, not from
`species_reference.py` directly (that's Python, not loadable in-browser) -
forgetting this step means the submission page's picker/validation goes
stale relative to what `ingest.py` will actually accept server-side.
