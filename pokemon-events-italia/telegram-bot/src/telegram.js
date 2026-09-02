/* Thin wrapper around the Telegram Bot API - plain fetch calls, no SDK
   dependency (keeps the Worker's bundle tiny and dependency-free). */

async function call(env, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Telegram ${method} failed:`, data.description);
  }
  return data;
}

export function sendMessage(env, chatId, text, extra = {}) {
  return call(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export function editMessageText(env, chatId, messageId, text, extra = {}) {
  return call(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export function answerCallbackQuery(env, callbackQueryId, extra = {}) {
  return call(env, "answerCallbackQuery", { callback_query_id: callbackQueryId, ...extra });
}

/* Used when a standing "/list" message shrinks from N messages to fewer on
   refresh (matching event count dropped) - the trailing ones need to
   actually go away rather than being left behind showing stale content
   forever, since nothing else would ever touch them again. */
export function deleteMessage(env, chatId, messageId) {
  return call(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

/* Looks up a specific user's membership status in a chat - used to gate
   group commands to admins when REQUIRE_GROUP_ADMIN is set (see
   isAdminStatus()/isGroupCommandAllowed() in access.js). Works because the
   bot is, by definition, already a member of any group it's receiving
   this message from. */
export function getChatMember(env, chatId, userId) {
  return call(env, "getChatMember", { chat_id: chatId, user_id: userId });
}

/* Registers the webhook URL with Telegram - called manually once from the
   README's setup curl command, not from the Worker itself at runtime. */
export function setWebhook(env, url, secretToken) {
  return call(env, "setWebhook", { url, secret_token: secretToken });
}

/* Registers the "/" command menu shown by Telegram's client UI (the list
   that pops up typing "/" into a chat with the bot, name + short
   description each). Unlike setWebhook above this IS called from the
   Worker itself, via the /set-commands debug route in index.js - see the
   README for the one-time curl command to trigger it. Only needs
   re-running when the command list itself changes; Telegram remembers it
   server-side otherwise. */
export function setMyCommands(env, commands) {
  return call(env, "setMyCommands", { commands });
}
