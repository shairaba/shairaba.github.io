import { defaultPrefs, migratePrefs, toggleStore, MODES, isDigestEligible, isListEligible } from "./prefs.js";
import {
  rootMenuView,
  applyCallback,
  storeMenuView,
  storeSearchResultsView,
  storeSearchPromptView,
  modeMenuView,
} from "./settings.js";
import { sendMessage, editMessageText, deleteMessage, answerCallbackQuery, setMyCommands, getChatMember } from "./telegram.js";
import { fetchEvents, buildDigests } from "./digest.js";
import { buildListTexts } from "./list.js";
import { buildVenueIndex, searchVenues } from "./venues.js";
import { isAuthorized, isGroupCommandAllowed } from "./access.js";

const CHAT_KEY_PREFIX = "chat:";
const NO_KEYBOARD = { inline_keyboard: [] };
// Must match wrangler.toml's [triggers] crons exactly - scheduled() at the
// bottom of this file dispatches on which of these two fired.
const DAILY_DIGEST_CRON = "15 5 * * *";
const DAILY_LIST_CRON = "0 6 * * *";

// Registered with Telegram via the /set-commands debug route (see README)
// so they show up in the "/" menu Telegram's own client UI offers - kept
// here as the single source of truth for that list. /help's text below is
// separate rather than generated from this, since it wants a bit more
// explanation per command than fits in setMyCommands' short description
// field (Telegram caps it at a few dozen characters in the UI).
const BOT_COMMANDS = [
  { command: "start", description: "Attiva gli aggiornamenti giornalieri" },
  { command: "list", description: "Tornei in programma, aggiornati automaticamente" },
  { command: "settings", description: "Regioni, tipo evento, giochi, negozi, modalità" },
  { command: "stop", description: "Annulla l'iscrizione" },
  { command: "help", description: "Elenco comandi" },
];

async function getPrefs(env, chatId) {
  const raw = await env.SUBSCRIBERS.get(CHAT_KEY_PREFIX + chatId);
  return raw ? migratePrefs({ ...defaultPrefs(), ...JSON.parse(raw) }) : defaultPrefs();
}

async function setPrefs(env, chatId, prefs) {
  await env.SUBSCRIBERS.put(CHAT_KEY_PREFIX + chatId, JSON.stringify(prefs));
}

/* Wires access.js's pure isGroupCommandAllowed() up to the real Telegram
   API - the fetchMemberStatus thunk it takes only actually calls
   getChatMember (a live network request) when REQUIRE_GROUP_ADMIN is on
   AND the explicit ALLOWED_GROUP_USER_IDS check didn't already settle it,
   so a plain allowlist-only setup never pays for it. */
function checkGroupCommand(env, chatType, chatId, fromUserId) {
  return isGroupCommandAllowed(chatType, fromUserId, env.ALLOWED_GROUP_USER_IDS, env.REQUIRE_GROUP_ADMIN === "true", async () => {
    const res = await getChatMember(env, chatId, fromUserId);
    return res.ok ? res.result.status : null;
  });
}

/* Every subscribed chat currently in KV, skipping anyone who's fallen off
   the ALLOWED_CHAT_IDS allowlist (if one is configured) - shared by the
   digest cron and the list-refresh cron so tightening the allowlist stops
   proactively messaging a removed chat immediately, not just blocking new
   commands from them. */
async function loadChats(env) {
  const chats = [];
  let cursor;
  do {
    const list = await env.SUBSCRIBERS.list({ prefix: CHAT_KEY_PREFIX, cursor });
    for (const key of list.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (!raw) continue;
      const chatId = key.name.slice(CHAT_KEY_PREFIX.length);
      if (!isAuthorized(env.ALLOWED_CHAT_IDS, chatId)) continue;
      const prefs = migratePrefs({ ...defaultPrefs(), ...JSON.parse(raw) });
      chats.push({ chatId, prefs });
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return chats;
}

/* Runs one chat's worth of work in a cron batch without letting a failure
   there - a network hiccup, a malformed stored record, an unexpected
   Telegram API response shape, anything that actually throws rather than
   just returning {ok:false} - silently abort every chat still queued
   after it in the SAME run (a plain for-loop with no per-iteration
   try/catch does exactly that: one uncaught rejection ends the whole
   batch, and if that chat is consistently the trigger, every subsequent
   chat quietly stops getting refreshed on every single future run too,
   with nothing in the logs pointing at why). Each chat's outcome is
   independent and its own failure is actually logged instead of just
   vanishing. */
async function runForChat(label, chatId, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`${label} failed for chat ${chatId}:`, err);
  }
}

/* Editing one page of a "/list" message set: try the existing message id at
   this page index first, falling back to sending a new message if there
   isn't one yet or the edit fails (deleted message, unreachable chat, or
   simply the first run). Returns the message id that now holds this page,
   or null if nothing could be sent (unreachable chat). */
async function sendOrEditPage(env, chatId, existingId, text, extra) {
  if (existingId) {
    const res = await editMessageText(env, chatId, existingId, text, extra);
    if (res.ok) return existingId;
    // Telegram rejects a no-op edit (e.g. two refreshes within the same
    // minute, so even the "Aggiornato: ..." footer is identical) - that's
    // not a real failure, keep the same id rather than sending a duplicate.
    if (res.description && res.description.includes("message is not modified")) return existingId;
  }
  const res = await sendMessage(env, chatId, text, extra);
  return res.ok ? res.result.message_id : null;
}

/* Core of the "/list" workmode: unlike the digest (which always sends a
   fresh message for whatever's new), this keeps a standing set of messages
   per chat up to date by editing them in place, one Telegram message per
   page of buildListTexts()'s output (see list.js for why a broad filter
   can need more than one). If the result now needs fewer pages than last
   time, the leftover trailing messages get deleted rather than left behind
   frozen with stale content. Shared by the /list command and both refresh
   crons - refreshing is otherwise on-demand only (running /list again),
   no in-message button. */
async function sendOrRefreshList(env, chatId, events) {
  const prefs = await getPrefs(env, chatId);
  const allEvents = events || (await fetchEvents());
  const texts = buildListTexts(allEvents, prefs, Date.now());
  const existingIds = prefs.listMessageIds || [];

  const newIds = [];
  for (let i = 0; i < texts.length; i++) {
    // Always NO_KEYBOARD, even when editing a message that used to carry
    // the old "🔄 Aggiorna" button - explicitly clears it off any existing
    // /list message on its next refresh rather than leaving a dead button
    // behind (its callback_data no longer has a handler at all).
    const id = await sendOrEditPage(env, chatId, existingIds[i], texts[i], { reply_markup: NO_KEYBOARD });
    if (id) newIds.push(id);
  }

  for (let i = texts.length; i < existingIds.length; i++) {
    await deleteMessage(env, chatId, existingIds[i]);
  }

  await setPrefs(env, chatId, { ...prefs, listMessageIds: newIds });
}

/* Strips a trailing "@BotName" (Telegram appends this to commands typed in
   group chats) and any arguments, so "/settings@MyEventsBot" and
   "/settings foo" both match the same way "/settings" typed 1:1 does. */
function commandName(text) {
  return text.trim().split(/\s+/)[0].split("@")[0].toLowerCase();
}

async function handleMessage(env, message) {
  const chatId = message.chat.id;
  const text = message.text || "";

  if (!isAuthorized(env.ALLOWED_CHAT_IDS, chatId)) {
    // Tells them their own chat id specifically so the owner can just copy
    // it into ALLOWED_CHAT_IDS themselves - no separate "how do I find my
    // Telegram id" step needed.
    await sendMessage(
      env,
      chatId,
      `🔒 Questo bot è ad uso privato. Il tuo ID chat è <code>${chatId}</code>: condividilo con il gestore del bot se vuoi essere autorizzato/a.`
    );
    return;
  }

  // Only relevant in a group/supergroup (isGroupCommandAllowed() is always
  // true in a private chat) - restricts WHO inside an allowed group can
  // actually issue commands, since the chat-level check above can only see
  // the group as a whole. Checks an explicit ALLOWED_GROUP_USER_IDS
  // allowlist and/or (if REQUIRE_GROUP_ADMIN is set) the sender's actual
  // admin status in the group - see access.js. Silently ignored rather
  // than replied to: unlike the private-chat rejection above, a reply here
  // would show up in the group for everyone every time an unauthorized
  // member tries a command, which gets noisy fast.
  const fromId = message.from && message.from.id;
  if (!(await checkGroupCommand(env, message.chat.type, chatId, fromId))) {
    return;
  }

  if (text.startsWith("/")) {
    const cmd = commandName(text);

    if (cmd === "/start") {
      const prefs = await getPrefs(env, chatId);
      await setPrefs(env, chatId, prefs);
      await sendMessage(
        env,
        chatId,
        "👋 Ciao! Ti invierò un riepilogo giornaliero dei nuovi eventi Pokémon (VGC/GCC/GO) in Italia che corrispondono ai tuoi filtri.\n\n" +
          "Per impostazione predefinita ricevi aggiornamenti per <b>tutte</b> le regioni, i tipi di evento e i giochi.\n\n" +
          "Usa /settings per personalizzare i filtri, /stop per annullare l'iscrizione."
      );
      return;
    }

    if (cmd === "/stop") {
      await env.SUBSCRIBERS.delete(CHAT_KEY_PREFIX + chatId);
      await sendMessage(env, chatId, "❌ Iscrizione annullata. Usa /start in qualsiasi momento per riattivarla.");
      return;
    }

    if (cmd === "/settings") {
      const prefs = await getPrefs(env, chatId);
      const view = rootMenuView(prefs);
      await sendMessage(env, chatId, view.text, { reply_markup: view.reply_markup });
      return;
    }

    if (cmd === "/list") {
      await sendOrRefreshList(env, chatId);
      return;
    }

    if (cmd === "/help") {
      await sendMessage(
        env,
        chatId,
        "/start - attiva gli aggiornamenti giornalieri\n" +
          "/list - mostra (e tiene aggiornato) l'elenco dei tornei in programma per i tuoi filtri\n" +
          "/settings - scegli regioni, tipo di evento, giochi, negozi specifici e la modalità\n" +
          "/stop - annulla l'iscrizione"
      );
      return;
    }

    await sendMessage(env, chatId, "Comando non riconosciuto. Usa /help per la lista dei comandi.");
    return;
  }

  // Not a command - the only free-text input we expect is a store-name
  // search query, entered after tapping "Cerca un negozio" in /settings.
  // Anything else (stray chatter, especially likely in a group) is
  // silently ignored rather than nudged at - same reasoning as the
  // group-sender rejection above: a bot replying to every random message
  // gets noisy fast, and /help is always one tap away regardless.
  const prefs = await getPrefs(env, chatId);
  if (prefs.state && prefs.state.mode === "awaiting_store_search" && text.trim()) {
    const events = await fetchEvents();
    const venueIndex = buildVenueIndex(events);
    const matches = searchVenues(venueIndex, text);
    const nextPrefs = { ...prefs, state: null };
    await setPrefs(env, chatId, nextPrefs);
    const view = storeSearchResultsView(matches, nextPrefs);
    await sendMessage(env, chatId, view.text, { reply_markup: view.reply_markup });
    return;
  }
}

async function handleCallback(env, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data || "";

  if (!isAuthorized(env.ALLOWED_CHAT_IDS, chatId)) {
    await answerCallbackQuery(env, callbackQuery.id, { text: "🔒 Non sei autorizzato/a a usare questo bot.", show_alert: true });
    return;
  }

  // Same group-command restriction as handleMessage - here an alert toast
  // is fine (unlike a message reply, it's only ever visible to whoever
  // tapped the button, not the whole group), so no need to silently no-op
  // instead.
  if (!(await checkGroupCommand(env, callbackQuery.message.chat.type, chatId, callbackQuery.from.id))) {
    await answerCallbackQuery(env, callbackQuery.id, { text: "🔒 Non sei autorizzato/a a usare questo bot in questo gruppo.", show_alert: true });
    return;
  }

  const prefs = await getPrefs(env, chatId);

  if (data === "nav:done") {
    await editMessageText(env, chatId, messageId, "✅ Preferenze salvate. Usa /settings in qualsiasi momento per modificarle di nuovo.", {
      reply_markup: NO_KEYBOARD,
    });
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }

  if (data === "nav:mode") {
    const view = modeMenuView(prefs);
    await editMessageText(env, chatId, messageId, view.text, { reply_markup: view.reply_markup });
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }

  if (data.startsWith("setmode:")) {
    const mode = data.slice("setmode:".length);
    const nextPrefs = { ...prefs, mode: MODES.includes(mode) ? mode : prefs.mode };
    await setPrefs(env, chatId, nextPrefs);
    const view = modeMenuView(nextPrefs);
    await editMessageText(env, chatId, messageId, view.text, { reply_markup: view.reply_markup });
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }

  if (data === "nav:store" || data.startsWith("tglstore:") || data === "clearstore") {
    const events = await fetchEvents();
    const venueIndex = buildVenueIndex(events);
    let nextPrefs = prefs;
    if (data === "clearstore") {
      nextPrefs = { ...prefs, stores: null };
      await setPrefs(env, chatId, nextPrefs);
    } else if (data.startsWith("tglstore:")) {
      const id = data.slice("tglstore:".length);
      nextPrefs = { ...prefs, stores: toggleStore(prefs.stores, id) };
      await setPrefs(env, chatId, nextPrefs);
    }
    const view = storeMenuView(nextPrefs, venueIndex);
    await editMessageText(env, chatId, messageId, view.text, { reply_markup: view.reply_markup });
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }

  if (data === "nav:storesearch") {
    const nextPrefs = { ...prefs, state: { mode: "awaiting_store_search" } };
    await setPrefs(env, chatId, nextPrefs);
    const view = storeSearchPromptView();
    await editMessageText(env, chatId, messageId, view.text, { reply_markup: view.reply_markup });
    await answerCallbackQuery(env, callbackQuery.id);
    return;
  }

  // region / type / game toggles and navigation - see settings.js
  const { prefs: nextPrefs, view } = applyCallback(data, prefs);
  await setPrefs(env, chatId, nextPrefs);
  if (view) await editMessageText(env, chatId, messageId, view.text, { reply_markup: view.reply_markup });
  await answerCallbackQuery(env, callbackQuery.id);
}

/* Sends the daily digest only - /list has its own separate cron
   (refreshAllLists below) on its own schedule, not bundled in here. */
async function runDailyDigest(env) {
  const events = await fetchEvents();
  const nowMs = Date.now();
  const chats = await loadChats(env);

  const digests = buildDigests(chats.filter((c) => isDigestEligible(c.prefs)), events, nowMs);
  for (const { chatId, prefs, messages } of digests) {
    await runForChat("Digest send", chatId, async () => {
      for (const msg of messages) {
        await sendMessage(env, chatId, msg);
      }
      await setPrefs(env, chatId, { ...prefs, lastNotifiedAt: new Date(nowMs).toISOString() });
    });
  }

  console.log(`Daily digest: ${chats.length} subscribed chat(s), ${digests.length} received a digest update.`);
}

/* The daily /list-refresh cron's whole job: unlike the digest above,
   events.json itself only changes once a day (see the README's note on
   the Apify scraper's schedule), so this exists purely to drop events
   that have started since the last check and keep the "Aggiornato: ..."
   timestamp current - not to catch new data sooner, and not more than
   once a day. */
async function refreshAllLists(env) {
  const events = await fetchEvents();
  const chats = await loadChats(env);
  const listChats = chats.filter((c) => isListEligible(c.prefs));
  for (const { chatId } of listChats) {
    await runForChat("Daily list refresh", chatId, () => sendOrRefreshList(env, chatId, events));
  }
  console.log(`Daily list refresh: ${listChats.length} /list message(s) refreshed.`);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Manual test hook for the daily digest, since there's no public way to
    // invoke a deployed Worker's scheduled() handler otherwise (wrangler dev
    // has a local-only endpoint for this, but that doesn't reach
    // production). Gated behind the same webhook secret - reuse it as a
    // query param here rather than introduce a second secret for one debug
    // route. Safe to hit repeatedly: it's the exact same logic and
    // lastNotifiedAt bookkeeping the real cron trigger uses, so running it
    // twice in a row just finds nothing new the second time.
    if (url.pathname === "/run-digest") {
      if (!env.WEBHOOK_SECRET || url.searchParams.get("secret") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      await runDailyDigest(env);
      return new Response("Digest run complete - check your Telegram chat.");
    }

    // Same idea as /run-digest above, for the daily /list auto-refresh -
    // lets you check the new output format (or a mode/allowlist change)
    // without waiting for its own scheduled time.
    if (url.pathname === "/run-list-refresh") {
      if (!env.WEBHOOK_SECRET || url.searchParams.get("secret") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      await refreshAllLists(env);
      return new Response("List refresh complete - check your Telegram chat.");
    }

    // One-time setup action, same idea as setWebhook (see README): registers
    // BOT_COMMANDS with Telegram so they show up when someone taps "/" in a
    // chat with the bot. Only needs re-running when BOT_COMMANDS itself
    // changes - Telegram remembers the list server-side otherwise.
    if (url.pathname === "/set-commands") {
      if (!env.WEBHOOK_SECRET || url.searchParams.get("secret") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const res = await setMyCommands(env, BOT_COMMANDS);
      return new Response(res.ok ? "Command menu updated." : `Failed: ${res.description}`, { status: res.ok ? 200 : 500 });
    }

    if (request.method !== "POST") return new Response("OK");

    // Telegram echoes back whatever secret_token setWebhook was called with
    // on every request - without checking it, anyone who discovers this
    // Worker's URL could POST fake updates and rewrite arbitrary chats'
    // stored preferences.
    if (env.WEBHOOK_SECRET) {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Telegram expects a fast 200 OK and will retry if the webhook is slow/
    // errors - respond immediately and let the actual work continue via
    // waitUntil rather than making Telegram wait on it.
    ctx.waitUntil(
      (async () => {
        try {
          if (update.message) await handleMessage(env, update.message);
          else if (update.callback_query) await handleCallback(env, update.callback_query);
        } catch (err) {
          console.error("Error handling Telegram update:", err);
        }
      })()
    );

    return new Response("OK");
  },

  // Two Cron Triggers point at this (see wrangler.toml), each running once
  // a day on its own independent schedule: DAILY_DIGEST_CRON sends digests,
  // DAILY_LIST_CRON refreshes /list messages.
  async scheduled(event, env, ctx) {
    if (event.cron === DAILY_DIGEST_CRON) {
      ctx.waitUntil(runDailyDigest(env));
    } else if (event.cron === DAILY_LIST_CRON) {
      ctx.waitUntil(refreshAllLists(env));
    }
  },
};
