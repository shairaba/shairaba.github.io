import test from "node:test";
import assert from "node:assert/strict";
import { formatAdmission, formatAddress, formatEventBody, googleMapsDirectionsUrl, escapeHtml } from "../src/eventFormat.js";

test("formatAdmission: plain amount, with or without decimals", () => {
  assert.equal(formatAdmission({ admission: "5" }), "5€");
  assert.equal(formatAdmission({ admission: "10,00" }), "10€");
  assert.equal(formatAdmission({ admission: "9.99" }), "9.99€");
});

test("formatAdmission: amount already carrying a € symbol", () => {
  assert.equal(formatAdmission({ admission: "5€" }), "5€");
  assert.equal(formatAdmission({ admission: "€ 10" }), "10€");
});

test("formatAdmission: amount spelled out as a currency word", () => {
  assert.equal(formatAdmission({ admission: "10 euro" }), "10€");
});

test("formatAdmission: two-tier preiscritti/non preiscritti pricing", () => {
  const result = formatAdmission({ admission: "10€ (preiscritti) 15€ (non preiscritti)" });
  assert.match(result, /10€ \(preiscritti\)/);
  assert.match(result, /15€ \(non preiscritti\)/);
});

test("formatAdmission: null when there's no admission field", () => {
  assert.equal(formatAdmission({}), null);
  assert.equal(formatAdmission({ admission: "" }), null);
});

test("formatAddress: strips a trailing country name/code, keeps everything else including casing", () => {
  assert.equal(
    formatAddress({ full_address: "VIA GIOSUÈ CARDUCCI, 18, 20092 CINISELLO BALSAMO MI, ITALY" }),
    "VIA GIOSUÈ CARDUCCI, 18, 20092 CINISELLO BALSAMO MI"
  );
  assert.equal(formatAddress({ full_address: "SOME STREET, ROMA, LAZIO 00100, IT" }), "SOME STREET, ROMA, LAZIO 00100");
});

test("formatAddress: null when there's no address", () => {
  assert.equal(formatAddress({}), null);
});

test("formatAddress: a pathologically long address (bad scrape, not realistic today) is truncated, not left unbounded", () => {
  const huge = "VIA " + "A".repeat(5000);
  const result = formatAddress({ full_address: huge });
  assert.ok(result.length <= 200, `expected a bounded result, got ${result.length} chars`);
  assert.ok(result.endsWith("…"));
});

test("formatEventBody: a pathologically long registration URL is dropped entirely rather than shown truncated/broken", () => {
  const event = {
    guid: "g1",
    start_date: "2026-09-20T18:00:00Z",
    activity_type: "tournament",
    third_party_registration_website: "https://example.com/?" + "x".repeat(1000),
  };
  const body = formatEventBody(event);
  assert.ok(!body.includes("Preiscrizioni"));
  assert.ok(body.length < 1000, "the oversized URL must not leak into the message at all");
});

test("formatEventBody: stays well under Telegram's message cap even with every optional field at its bounded maximum", () => {
  const event = {
    guid: "11111111-1111-1111-1111-111111111111",
    start_date: "2026-09-20T18:00:00Z",
    activity_type: "tournament",
    full_address: "VIA " + "A".repeat(5000),
    admission: "10€ (preiscritti) 15€ (non preiscritti)",
    latitude: 45.5,
    longitude: 9.2,
    third_party_registration_website: "https://example.com/" + "y".repeat(490),
  };
  const body = formatEventBody(event);
  assert.ok(body.length < 1200, `expected a small bounded block, got ${body.length} chars`);
});

test("googleMapsDirectionsUrl: builds a directions link from lat/long", () => {
  assert.equal(
    googleMapsDirectionsUrl({ latitude: 45.5, longitude: 9.2 }),
    "https://www.google.com/maps/dir/?api=1&destination=45.5,9.2"
  );
});

test("escapeHtml: escapes the HTML special chars Telegram's HTML parse_mode cares about", () => {
  assert.equal(escapeHtml("A & B <tag>"), "A &amp; B &lt;tag&gt;");
});
