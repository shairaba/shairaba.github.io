import { defaultPrefs, toggleStore } from "./prefs.js";
import {
  rootMenuView,
  applyCallback,
  storeMenuView,
  storeSearchResultsView,
  storeSearchPromptView,
} from "./settings.js";
import { sendMessage, editMessageText, answerCallbackQuery } from "./telegram.js";
import { fetchEvents, buildDigests } from "./digest.js";
import { buildVenueIndex, searchVenues } from "./venues.js";

const CHAT_KEY_PREFIX = "chat:";
const NO_KEYBOARD = { inline_keyboard: [] };

async function getPrefs(env, chatId) {
  const raw = await env.SUBSCRIBERS.get(CHAT_KEY_PREFIX + chatId);
  return raw ? { ...defaultPrefs(), ...JSON.parse(raw) } : defaultPrefs();
}

async function setPrefs(env, chatId, prefs) {
  await env.SUBSCRIBERS.put(CHAT_KEY_PREFIX + chatId, JSON.stringify(prefs));
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

    if (cmd === "/help") {
      await sendMessage(
        env,
        chatId,
        "/start - attiva gli aggiornamenti giornalieri\n" +
          "/settings - scegli regioni, tipo di evento, giochi e negozi specifici\n" +
          "/stop - annulla l'iscrizione"
      );
      return;
    }

    await sendMessage(env, chatId, "Comando non riconosciuto. Usa /help per la lista dei comandi.");
    return;
  }

  // Not a command - the only free-text input we expect is a store-name
  // search query, entered after tapping "Cerca un negozio" in /settings.
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

  await sendMessage(env, chatId, "Usa /settings per configurare le tue preferenze o /help per la lista dei comandi.");
}

async function handleCallback(env, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data || "";
  const prefs = await getPrefs(env, chatId);

  if (data === "nav:done") {
    await editMessageText(env, chatId, messageId, "✅ Preferenze salvate. Usa /settings in qualsiasi momento per modificarle di nuovo.", {
      reply_markup: NO_KEYBOARD,
    });
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

async function runDailyDigest(env) {
  const events = await fetchEvents();
  const nowMs = Date.now();

  const chats = [];
  let cursor;
  do {
    const list = await env.SUBSCRIBERS.list({ prefix: CHAT_KEY_PREFIX, cursor });
    for (const key of list.keys) {
      const raw = await env.SUBSCRIBERS.get(key.name);
      if (!raw) continue;
      const prefs = { ...defaultPrefs(), ...JSON.parse(raw) };
      chats.push({ chatId: key.name.slice(CHAT_KEY_PREFIX.length), prefs });
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  const digests = buildDigests(chats, events, nowMs);
  for (const { chatId, prefs, messages } of digests) {
    for (const msg of messages) {
      await sendMessage(env, chatId, msg);
    }
    await setPrefs(env, chatId, { ...prefs, lastNotifiedAt: new Date(nowMs).toISOString() });
  }
  console.log(`Daily digest: ${chats.length} subscribed chat(s), ${digests.length} received an update.`);
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

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyDigest(env));
  },
};
