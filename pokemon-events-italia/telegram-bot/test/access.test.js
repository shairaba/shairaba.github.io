import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorized, isAdminStatus, isGroupCommandAllowed } from "../src/access.js";

test("isAuthorized: unset allowlist means everyone is allowed (default, backward compatible)", () => {
  assert.equal(isAuthorized(undefined, "12345"), true);
  assert.equal(isAuthorized("", "12345"), true);
});

test("isAuthorized: a configured allowlist restricts to just those chat ids", () => {
  assert.equal(isAuthorized("111,222", "111"), true);
  assert.equal(isAuthorized("111,222", "333"), false);
});

test("isAuthorized: tolerates whitespace around entries and numeric vs string chat ids", () => {
  assert.equal(isAuthorized(" 111 , 222 ", 111), true);
  assert.equal(isAuthorized(" 111 , 222 ", "222"), true);
});

test("isAdminStatus: creator and administrator count, everything else doesn't", () => {
  assert.equal(isAdminStatus("creator"), true);
  assert.equal(isAdminStatus("administrator"), true);
  assert.equal(isAdminStatus("member"), false);
  assert.equal(isAdminStatus("restricted"), false);
  assert.equal(isAdminStatus("left"), false);
  assert.equal(isAdminStatus(undefined), false);
});

// A fetchMemberStatus thunk that fails the test if it's ever actually
// called - used below to assert the admin lookup is skipped whenever it
// isn't needed (private chats, nothing configured, or the explicit
// allowlist already settled it), not just that the end result is correct.
function unreachableFetch() {
  return () => {
    throw new Error("fetchMemberStatus should not have been called");
  };
}

test("isGroupCommandAllowed: always true in a private chat, without even looking at the allowlist or calling fetchMemberStatus", async () => {
  assert.equal(await isGroupCommandAllowed("private", "42", "999", true, unreachableFetch()), true);
});

test("isGroupCommandAllowed: open by default when neither an allowlist nor admin-only is configured", async () => {
  assert.equal(await isGroupCommandAllowed("group", "42", undefined, false, unreachableFetch()), true);
});

test("isGroupCommandAllowed: an explicit allowlist restricts to just those senders, without needing a role lookup", async () => {
  assert.equal(await isGroupCommandAllowed("group", "111", "111,222", false, unreachableFetch()), true);
  assert.equal(await isGroupCommandAllowed("group", "333", "111,222", false, unreachableFetch()), false);
});

test("isGroupCommandAllowed: admin-only mode allows a sender whose getChatMember status is creator/administrator", async () => {
  const allowedAdmin = await isGroupCommandAllowed("supergroup", "42", undefined, true, async () => "administrator");
  assert.equal(allowedAdmin, true);
  const allowedCreator = await isGroupCommandAllowed("supergroup", "42", undefined, true, async () => "creator");
  assert.equal(allowedCreator, true);
  const deniedMember = await isGroupCommandAllowed("supergroup", "42", undefined, true, async () => "member");
  assert.equal(deniedMember, false);
});

test("isGroupCommandAllowed: allowlist and admin-only combine with OR - either one passing is enough", async () => {
  // On the allowlist but not an admin.
  assert.equal(await isGroupCommandAllowed("group", "111", "111", true, async () => "member"), true);
  // An admin but not on the allowlist.
  assert.equal(await isGroupCommandAllowed("group", "999", "111", true, async () => "administrator"), true);
  // Neither.
  assert.equal(await isGroupCommandAllowed("group", "999", "111", true, async () => "member"), false);
});

test("isGroupCommandAllowed: the allowlist is checked before ever calling fetchMemberStatus, even in admin-only mode", async () => {
  assert.equal(await isGroupCommandAllowed("group", "111", "111", true, unreachableFetch()), true);
});
