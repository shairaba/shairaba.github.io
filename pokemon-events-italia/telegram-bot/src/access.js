function parseIdList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/* Optional allowlist gating who can use the bot at all. Unset by default -
   everyone allowed - matching the rest of this project's "self-service, no
   manual config needed" philosophy; it only starts restricting once the
   owner deliberately sets the ALLOWED_CHAT_IDS secret (see README).
   Comma-separated numeric Telegram chat ids, not @usernames - for a DM with
   the bot a chat id is the same as the sender's user id, and unlike a
   username it can't be changed or unset by the user later.

   In a GROUP chat this only gates the group as a whole, not who inside it
   can issue commands - everyone in an allowed group passes this check,
   since they all share the same chat id. See isGroupCommandAllowed() below
   for restricting that further, either by an explicit per-user allowlist
   or by requiring the sender be a group admin. */
export function isAuthorized(allowedIdsRaw, chatId) {
  const allowed = parseIdList(allowedIdsRaw);
  if (allowed.length === 0) return true;
  return allowed.includes(String(chatId));
}

/* Unlike isAuthorized() above, this does NOT default to "everyone" when
   unset - it's a strict "is this specific sender on the (possibly empty)
   list", used as one of two ways into isGroupCommandAllowed() below rather
   than as a standalone gate, so it can't have its own separate notion of
   "nothing configured = open". */
function isExplicitlyAllowedSender(allowedUserIdsRaw, fromUserId) {
  return parseIdList(allowedUserIdsRaw).includes(String(fromUserId));
}

/* Telegram's getChatMember() status values that count as "runs the group" -
   "creator" is the group owner, "administrator" is anyone the creator (or
   another admin) promoted. Deliberately excludes "member" (an ordinary
   participant) and the already-departed/restricted statuses. */
export function isAdminStatus(status) {
  return status === "creator" || status === "administrator";
}

/* The actual group-command gate, composing both restriction mechanisms
   available for groups (an explicit ALLOWED_GROUP_USER_IDS allowlist, and/
   or requiring the sender be a group admin/the creator) since either alone
   covers a different case: an allowlist can name specific non-admin
   members you trust, admin-only needs no manual id bookkeeping and tracks
   the group's actual admin list automatically as it changes. Always true
   in a private chat - the sender IS the chat there, so isAuthorized()
   above already covers it, and this would just be a redundant,
   easy-to-misconfigure second gate on the same person. Also open by
   default when NEITHER mechanism is configured, matching every other
   allowlist in this file.

   fetchMemberStatus is a thunk (only called, i.e. only spends a live
   Telegram API call, when actually needed - not at all if the explicit
   allowlist already settled it) that resolves to the sender's
   getChatMember() status string, or null/undefined if that lookup itself
   fails - kept as an injected callback rather than importing telegram.js
   directly so this composition stays pure and unit-testable without a
   real bot token; index.js is what actually wires up the real API call. */
export async function isGroupCommandAllowed(chatType, fromUserId, allowedUserIdsRaw, requireAdmin, fetchMemberStatus) {
  if (chatType === "private") return true;

  const hasAllowlist = parseIdList(allowedUserIdsRaw).length > 0;
  if (!hasAllowlist && !requireAdmin) return true;

  if (isExplicitlyAllowedSender(allowedUserIdsRaw, fromUserId)) return true;

  if (requireAdmin && fetchMemberStatus) {
    const status = await fetchMemberStatus();
    if (isAdminStatus(status)) return true;
  }

  return false;
}
