# Pokémon Events Italia — Telegram bot

Daily digest bot: subscribers get a message when new events matching their
filters (region, event type, game, and/or specific stores) show up in
[`data/events.json`](../data/events.json). Fully self-service via `/settings`
— no manual config file editing needed.

## How it works

- Runs on **Cloudflare Workers** (free tier is plenty for this): one Worker
  handles both the Telegram webhook (commands, `/settings` button taps) and
  a daily **Cron Trigger** that builds and sends each subscriber's digest.
- Subscriber preferences live in **Workers KV** (`SUBSCRIBERS` binding), one
  entry per chat: `{ regions, types, games, stores, lastNotifiedAt, state }`.
  `null` for a filter means "no restriction, everything passes" (the default
  for a new subscriber); an array restricts to just those keys.
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

That's it - message your bot `/start` on Telegram to try it.

## Adjusting the daily send time

`wrangler.toml`'s `[triggers]` cron is in plain UTC with no daylight-saving
awareness (`"15 5 * * *"` = 5:15 UTC, chosen to run ~15 min after the site's
own Apify scraper finishes its ~6 AM Italian-time sync). That lands at
6:15 AM Italy time in winter and 7:15 AM in summer - if that hour of drift
matters to you, either pick a different fixed hour or add a second cron
entry for the other half of the year.

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

- `/start` - subscribe (defaults to every region/type/game, no store filter)
- `/settings` - open the filter menu
- `/stop` - unsubscribe (deletes the chat's stored preferences)
- `/help` - list commands
