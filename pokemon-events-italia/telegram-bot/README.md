# Pokémon Events Italia — Telegram bot

Telegram bot with two workmodes, both driven by the same per-chat filters
(region, event type, game, and/or specific stores) set via `/settings`,
where a chat can also pick which mode(s) it actually wants:
a **daily digest** (subscribers get a message when new events matching
their filters show up in [`data/events.json`](../data/events.json)) and
`/list`, a **standing set of messages** (up to 2) that always shows what's
currently upcoming and gets edited in place on refresh (on demand, or once
a day) rather than resent. Fully self-service — no manual config file
editing needed, aside from the optional owner-only allowlist below.

## How it works

- Runs on **Cloudflare Workers** (free tier is plenty for this): one Worker
  handles the Telegram webhook (commands, `/settings` button taps) plus two
  **Cron Triggers**, each firing once a day on its own independent
  schedule - one builds/sends each eligible subscriber's digest, the other
  refreshes everyone's `/list` messages (see "Adjusting the send times"
  below for exact times and why they're two separate crons rather than
  one).
- Subscriber preferences live in **Workers KV** (`SUBSCRIBERS` binding), one
  entry per chat: `{ regions, types, games, stores, lastNotifiedAt, state,
  mode, listMessageIds }`. `null` for a filter means "no restriction,
  everything passes" (the default for a new subscriber); an array restricts
  to just those keys. `mode` (`"both"` by default) lets a chat opt out of
  one of the two workmodes' proactive pushes via `/settings` without
  affecting on-demand commands - see "Bot commands" below. `listMessageIds`
  are the ids of that chat's standing `/list` message(s), in page order,
  once at least one has been sent - later refreshes know what to edit, and
  if the result shrinks to fewer pages than before, the leftover trailing
  messages get deleted instead of left behind showing stale content.
- "New" means `first_seen_at` (set once by the scraper the first time it
  ever saw that event) is newer than the last time that chat was notified —
  not a diff between two `events.json` snapshots, and not "resend everything
  matching until the event happens."
- Reads the **live, published** `events.json` from GitHub Pages
  (`https://shairaba.github.io/pokemon-events-italia/data/events.json`) —
  same data the site itself serves, not a local copy.

## One-time setup

### 1. Create the Telegram bot

Message [@BotFather](https://t.me/BotFather) on Telegram:
```
/newbot
```
Follow the prompts, then save the bot token it gives you (looks like
`123456789:AAF...`).

### 2. Install dependencies and log in to Cloudflare

```sh
cd telegram-bot
npm install
npx wrangler login
```

### 3. Create the KV namespace

```sh
npx wrangler kv namespace create SUBSCRIBERS
```
This prints an `id`. Paste it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

### 4. Set the secrets

```sh
npx wrangler secret put BOT_TOKEN
# paste the token from step 1

npx wrangler secret put WEBHOOK_SECRET
# paste any random string you generate yourself, e.g. `openssl rand -hex 24`
```
`WEBHOOK_SECRET` is not a Telegram value - it's a shared secret *you*
invent, sent back to Telegram in step 6 and checked on every incoming
webhook request (`src/index.js`) so nobody else can POST fake updates that
would let them read/overwrite arbitrary chats' stored preferences.

**Optional: restrict who can use the bot.** By default anyone who finds it
can `/start` it. To lock it down to specific people:
```sh
npx wrangler secret put ALLOWED_CHAT_IDS
# comma-separated numeric chat ids, e.g. 111111111,222222222
```
For a DM with the bot, a chat id is the same as the sender's Telegram user
id (not their @username, which can change). Two ways to find yours: message
[@userinfobot](https://t.me/userinfobot) (a well-known, unrelated utility
bot) and it replies with your numeric id directly; or set this secret to
some placeholder value first, then message this bot once - since you're
not on the list yet, it replies with your actual chat id (`🔒 ... Il tuo ID
chat è ...`), which you then paste in for real. Set to empty/unset again at
any point to open it back up. This is a
Cloudflare **secret** rather than a plain `wrangler.toml` var deliberately,
since this repo is public - a `[vars]` entry would commit your (or your
friends') numeric Telegram ids to git history.

**Optional: restrict who can use commands *inside a group*.** If you add
the bot to a group chat, `ALLOWED_CHAT_IDS` above only sees the group's own
chat id - once a group is allowed, *everyone in it* can run `/settings`,
`/list`, etc., since they all share that one chat id. Two ways to restrict
that further (`src/access.js`'s `isGroupCommandAllowed()`), usable
separately or together - if both are set, either one passing is enough:

- **By specific member**, an explicit allowlist:
  ```sh
  npx wrangler secret put ALLOWED_GROUP_USER_IDS
  # comma-separated numeric Telegram user ids, same format as ALLOWED_CHAT_IDS
  ```
- **By role**, requiring the sender be a group admin or the creator - no id
  bookkeeping, and it automatically tracks the group's actual admin list as
  it changes (checked live via `getChatMember` on each command, only when
  actually needed - not spent at all if the allowlist above already settled
  it). Uncomment `REQUIRE_GROUP_ADMIN = "true"` in `wrangler.toml`'s `[vars]`
  and redeploy - it's a plain var rather than a secret since, unlike the two
  id lists, there's nothing sensitive in a bare on/off flag.

Both only apply inside groups/supergroups - ignored in a private chat,
where the sender already *is* the chat and `ALLOWED_CHAT_IDS` covers it. An
unauthorized member's command is silently ignored rather than replied to (a
reply would show up in the group for everyone, every time), but tapping a
`/settings` button they weren't supposed to gets an ephemeral "not
authorized" toast only they see. Same find-your-id options as above for
`ALLOWED_GROUP_USER_IDS`.

### 5. Deploy

```sh
npx wrangler deploy
```
This prints your Worker's URL, e.g. `https://pokemon-events-telegram-bot.<your-subdomain>.workers.dev`.

### 6. Point Telegram at it

```sh
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://pokemon-events-telegram-bot.<your-subdomain>.workers.dev" \
  -d "secret_token=<WEBHOOK_SECRET>"
```
(Same two values from step 4.) You should get back `{"ok":true,...}`.

### 7. Register the "/" command menu (optional, but nice to have)

```sh
curl "https://pokemon-events-telegram-bot.<your-subdomain>.workers.dev/set-commands?secret=<WEBHOOK_SECRET>"
```
Makes Telegram's client show your bot's commands (with a short description
each) when someone types "/" in a chat with it, instead of them having to
already know `/start`/`/list`/etc. or run `/help` first. The list itself is
`BOT_COMMANDS` in `src/index.js` - only need to re-run this when that list
changes; Telegram remembers it server-side otherwise. Safe to hit
repeatedly.

That's it - message your bot `/start` on Telegram to try it.

## Adjusting the send times

`wrangler.toml`'s `[triggers]` has two cron entries, both plain UTC with no
daylight-saving awareness (Cloudflare Cron Triggers don't have any), told
apart in `src/index.js`'s `scheduled()` by exact string match against
`DAILY_DIGEST_CRON`/`DAILY_LIST_CRON` - if you change either time, update
the matching constant too, or that cron's firing stops doing anything (it
won't match either constant, and `scheduled()` silently no-ops for it).

- `"15 5 * * *"` runs the digest once a day, chosen to fire ~15 min after
  the site's own Apify scraper finishes its ~6 AM Italian-time sync. That
  lands at 6:15 AM Italy time in winter (CET) and 7:15 AM in summer (CEST).
- `"0 6 * * *"` refreshes every eligible chat's `/list` messages once a
  day, landing at 8:00 AM Italy time in summer (CEST) and 7:00 AM in
  winter (CET). Since `events.json` itself only changes once a day, running
  this more often wouldn't surface data any sooner - it's purely to drop
  events that started since the last check and keep the "Aggiornato: ..."
  timestamp current.

If the hour of DST drift on either one matters to you, either pick a
different fixed hour or add a second entry for the other half of the year
(and extend the matching `event.cron === ...` check in `scheduled()`
accordingly).

## Local development

```sh
npm run dev       # wrangler dev - local KV emulation, real network fetch()
npm test          # pure-logic unit tests, no network/KV/bot token needed
```
`wrangler dev` prints a `.../cdn-cgi/local/scheduled` URL you can `curl` to
manually fire the cron handler without waiting for the real schedule, and
serves local KV inspection routes under `/cdn-cgi/local/explorer/api/` -
useful for checking what got stored during a test run. Put a throwaway
`BOT_TOKEN`/`WEBHOOK_SECRET` in a local `.dev.vars` file (gitignored) to
exercise the full webhook flow locally - Telegram API calls will fail with
"Unauthorized" against a fake token (logged, not thrown), everything else
still runs and is inspectable.

## Bot commands

- `/start` - subscribe (defaults to every region/type/game, no store filter,
  both workmodes)
- `/list` - a second, independent workmode from the daily digest above: shows
  every *currently upcoming* event matching the chat's filters (not just
  what's new) as up to 2 standing messages (`MAX_PAGES` in `src/list.js`) -
  whatever fits within that, each tagged `(1/2)` once there's more than
  one, and the rest noted as "e altri N eventi" on the last one rather than
  silently dropped. No in-message button - calling `/list` again or the
  daily refresh cron both edit those same messages in place rather than
  sending new ones - and if the result needs fewer pages than last time,
  the leftover one gets deleted. Always works on demand regardless of the
  `mode` setting below - that only gates the *proactive* refresh.
- `/settings` - filters (region/type/game/store, shared by both workmodes)
  plus which workmode(s) this chat actually wants pushed: the daily digest
  only, `/list` auto-refresh only, or both (the default).
- `/stop` - unsubscribe (deletes the chat's stored preferences, including
  its `/list` message references)
- `/help` - list commands

### Event output format

Both workmodes render each matching event the same way (`src/eventFormat.js`),
one block per event:
```
🗓 12 set, 13:00 - Coppa di Lega
🗺 VIA GIOSUÈ CARDUCCI, 18, 20092 CINISELLO BALSAMO MI
💰 5€
Dettagli - Portami lì - Preiscrizioni
```
The address (🗺) and price (💰) lines only appear when `events.json` actually
has that data for the event (most rows don't have a price). Address is
shown as scraped (all-caps, no attempt at title-casing - see the comment on
`formatAddress()` for why) minus the redundant trailing country name.
"Portami lì" links to Google Maps directions (only shown when the event has
coordinates) and "Preiscrizioni" links to the event's
`third_party_registration_website` (only shown when one exists) - "Dettagli"
always links to the event's page on the main site. The digest additionally
prefixes each block with "🆕 Nuovo" or "✏️ Aggiornato".
