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

/* Registers the webhook URL with Telegram - called manually once from the
   README's setup curl command, not from the Worker itself at runtime. */
export function setWebhook(env, url, secretToken) {
  return call(env, "setWebhook", { url, secret_token: secretToken });
}
