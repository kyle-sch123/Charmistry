// Self-contained sanity tests for the PayFast signature algorithm.
// Mirrors the implementation in src/lib/payfast.ts — keep in sync.
//
// Run: node scripts/test-payfast.mjs
//
// Validates:
//  - Signature is deterministic and reproducible
//  - Round-trip: build → verify succeeds
//  - Tampering: any field change invalidates the signature
//  - Passphrase on vs off produces different signatures
//  - PHP-style urlencoding (spaces = `+`, encodes `!*'()~`)
//  - Empty fields are filtered before signing
//  - Field order is insertion order (matches PayFast spec)

import crypto from "node:crypto";
import { strict as assert } from "node:assert";

// --- Mirrors src/lib/payfast.ts -----------------------------------------

const PAYFAST_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
];

function phpUrlencode(value) {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/~/g, "%7E");
}

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function buildSignature(fields, order, passphrase) {
  const parts = [];
  for (const key of order) {
    const raw = fields[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    parts.push(`${key}=${phpUrlencode(trimmed)}`);
  }
  let str = parts.join("&");
  if (passphrase && passphrase.trim() !== "") {
    str += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  }
  return md5(str);
}

function verifyItn(params, passphrase) {
  const keys = Object.keys(params).filter((k) => k !== "signature");
  const parts = [];
  for (const key of keys) {
    const raw = params[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    parts.push(`${key}=${phpUrlencode(trimmed)}`);
  }
  let str = parts.join("&");
  if (passphrase && passphrase.trim() !== "") {
    str += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  }
  return md5(str) === String(params.signature ?? "").toLowerCase();
}

// --- Tests ---------------------------------------------------------------

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err });
  }
}

// PHP urlencode edge cases
test("phpUrlencode: space becomes +", () => {
  assert.equal(phpUrlencode("hello world"), "hello+world");
});

test("phpUrlencode: encodes JS-unencoded chars !*'()~", () => {
  assert.equal(phpUrlencode("a!b*c'd(e)f~g"), "a%21b%2Ac%27d%28e%29f%7Eg");
});

test("phpUrlencode: leaves hyphens, underscores, dots", () => {
  assert.equal(phpUrlencode("a-b_c.d"), "a-b_c.d");
});

test("phpUrlencode: encodes ampersand and equals", () => {
  assert.equal(phpUrlencode("a&b=c"), "a%26b%3Dc");
});

test("phpUrlencode: unicode", () => {
  assert.equal(phpUrlencode("café"), "caf%C3%A9");
});

// Signature determinism
test("signature is deterministic", () => {
  const fields = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "100.00",
    item_name: "Test item",
  };
  const a = buildSignature(fields, PAYFAST_FIELD_ORDER, "");
  const b = buildSignature(fields, PAYFAST_FIELD_ORDER, "");
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{32}$/);
});

// Round-trip
test("round-trip: build then verify passes", () => {
  const fields = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    return_url: "https://example.com/checkout/success?order=abc",
    cancel_url: "https://example.com/checkout/cancelled",
    notify_url: "https://example.com/api/payfast/notify",
    name_first: "Kyle",
    name_last: "Smith",
    email_address: "kyle@example.com",
    m_payment_id: "01234567-89ab-cdef-0123-456789abcdef",
    amount: "149.99",
    item_name: "Charmistry order (3 items)",
  };
  const passphrase = "MySecretPhrase";
  const signature = buildSignature(fields, PAYFAST_FIELD_ORDER, passphrase);
  const itnPayload = { ...fields, signature };
  assert.ok(verifyItn(itnPayload, passphrase));
});

// Tampering
test("tampered amount invalidates signature", () => {
  const fields = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "100.00",
    item_name: "Widget",
  };
  const sig = buildSignature(fields, PAYFAST_FIELD_ORDER, "pass");
  const tampered = { ...fields, amount: "1.00", signature: sig };
  assert.equal(verifyItn(tampered, "pass"), false);
});

test("tampered name invalidates signature", () => {
  const fields = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "100.00",
    name_first: "Alice",
  };
  const sig = buildSignature(fields, PAYFAST_FIELD_ORDER, "pass");
  const tampered = { ...fields, name_first: "Eve", signature: sig };
  assert.equal(verifyItn(tampered, "pass"), false);
});

// Passphrase behaviour
test("passphrase changes the signature", () => {
  const fields = { merchant_id: "10000100", merchant_key: "46f0cd694581a", amount: "100.00" };
  const withoutPass = buildSignature(fields, PAYFAST_FIELD_ORDER, "");
  const withPass = buildSignature(fields, PAYFAST_FIELD_ORDER, "hunter2");
  assert.notEqual(withoutPass, withPass);
});

test("whitespace-only passphrase is treated as absent", () => {
  const fields = { merchant_id: "10000100", amount: "10.00" };
  const empty = buildSignature(fields, PAYFAST_FIELD_ORDER, "");
  const whitespace = buildSignature(fields, PAYFAST_FIELD_ORDER, "   ");
  assert.equal(empty, whitespace);
});

// Empty field filtering
test("empty and undefined fields are filtered before signing", () => {
  const sparse = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    name_first: "",
    cell_number: undefined,
    amount: "50.00",
  };
  const dense = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "50.00",
  };
  assert.equal(
    buildSignature(sparse, PAYFAST_FIELD_ORDER, "pass"),
    buildSignature(dense, PAYFAST_FIELD_ORDER, "pass"),
  );
});

// Field order matters
test("different field order produces different signatures", () => {
  const fields = { merchant_id: "1", merchant_key: "2" };
  const orderA = ["merchant_id", "merchant_key"];
  const orderB = ["merchant_key", "merchant_id"];
  assert.notEqual(
    buildSignature(fields, orderA, ""),
    buildSignature(fields, orderB, ""),
  );
});

// Value with special characters
test("special chars in item_name round-trip correctly", () => {
  const fields = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "100.00",
    item_name: "Charm & Chain (Rose) — R100",
  };
  const sig = buildSignature(fields, PAYFAST_FIELD_ORDER, "pass");
  assert.ok(verifyItn({ ...fields, signature: sig }, "pass"));
});

// ITN verify: unknown extra fields must be included in verification
test("ITN verify uses fields in received order", () => {
  // Simulates what PayFast sends in the ITN — includes extras like payment_status, pf_payment_id
  const itn = {
    m_payment_id: "order-123",
    pf_payment_id: "1234567",
    payment_status: "COMPLETE",
    item_name: "Charmistry order",
    amount_gross: "100.00",
    amount_fee: "-3.00",
    amount_net: "97.00",
    merchant_id: "10000100",
  };
  const sig = buildSignature(itn, Object.keys(itn), "pass");
  assert.ok(verifyItn({ ...itn, signature: sig }, "pass"));
});

// --- Report -------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ✓ ${r.name}`);
  } else {
    failed++;
    console.log(`  ✗ ${r.name}`);
    console.log(`    ${r.err?.message ?? r.err}`);
  }
}

console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed > 0) process.exit(1);
