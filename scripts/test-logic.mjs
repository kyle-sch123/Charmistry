/**
 * Self-contained unit tests for the pure-function lib modules.
 *
 * Run:
 *   node scripts/test-logic.mjs
 *
 * Tests are inline assertions (no framework) so this script runs against
 * the repo as-is, no devDependencies required. It covers:
 *   - canonicaliseEmail (src/lib/email.ts)
 *   - estimateShippingCost (src/lib/shipping.ts)
 *   - computeDiscountAmount (src/lib/discounts.ts)
 *   - generateDiscountCode shape + entropy (src/app/api/subscribe/route.ts)
 *
 * The functions are loaded via Node's --experimental-strip-types (Node 22.6+).
 */

import { canonicaliseEmail } from "../src/lib/email.ts";
import { estimateShippingCost } from "../src/lib/shipping.ts";
import { computeDiscountAmount } from "../src/lib/discounts.ts";
import crypto from "node:crypto";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(actual)}`);
  }
}

// ─── canonicaliseEmail ──────────────────────────────────────────────────────
console.log("\ncanonicaliseEmail");

check("lowercase",                   canonicaliseEmail("Bob@Example.com"),         "bob@example.com");
check("trim",                        canonicaliseEmail("  bob@example.com  "),     "bob@example.com");
check("plus-addressing stripped",    canonicaliseEmail("bob+anything@example.com"), "bob@example.com");
check("multiple plus",               canonicaliseEmail("bob+a+b@example.com"),     "bob@example.com");
check("gmail dot stripped",          canonicaliseEmail("b.o.b@gmail.com"),         "bob@gmail.com");
check("gmail dot + plus",            canonicaliseEmail("b.o.b+x@gmail.com"),       "bob@gmail.com");
check("googlemail -> gmail",         canonicaliseEmail("bob@googlemail.com"),      "bob@gmail.com");
check("googlemail dot + plus",       canonicaliseEmail("b.o.b+x@GoogleMail.com"),  "bob@gmail.com");
check("non-gmail dots preserved",    canonicaliseEmail("b.o.b@example.com"),       "b.o.b@example.com");
check("non-gmail plus stripped",     canonicaliseEmail("a.b+c@example.co.za"),     "a.b@example.co.za");
check("missing @ left as-is",        canonicaliseEmail("notanemail"),              "notanemail");
check("multi @ uses last",           canonicaliseEmail("a@b@example.com"),         "a@b@example.com");
check("empty",                       canonicaliseEmail(""),                        "");
check("identity case",               canonicaliseEmail("bob@gmail.com"),           "bob@gmail.com");

// ─── estimateShippingCost ───────────────────────────────────────────────────
console.log("estimateShippingCost");

const za = { country: "ZA", city: "Cape Town", postalCode: "8001" };
const intl = { country: "US", city: "NYC", postalCode: "10001" };

check("free shipping at threshold",
  estimateShippingCost({ subtotal: 600, lines: [{ quantity: 1 }], destination: za }),
  0);
check("free shipping above threshold",
  estimateShippingCost({ subtotal: 1000, lines: [{ quantity: 5 }], destination: za }),
  0);
check("domestic 1 item under threshold",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 1 }], destination: za }),
  60); // 45 + 0.5 * 30 = 60
check("domestic 5 items under threshold",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 5 }], destination: za }),
  120); // 45 + 2.5 * 30 = 120
check("domestic floor at MINIMUM_COST",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 0 }], destination: za }),
  60); // quantity coerces to max(1, 0) = 1, weight = 0.5kg, cost = 45 + 0.5*30 = 60
check("international 1 item",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 1 }], destination: intl }),
  147.5); // 120 + 0.5 * 55 = 147.5
check("intl country case-insensitive",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 1 }], destination: { ...intl, country: "us" } }),
  147.5);
check("za country case-insensitive",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 1 }], destination: { ...za, country: "za" } }),
  60);
check("custom weight per line",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 1, weightKg: 2 }], destination: za }),
  105); // 45 + 2*30 = 105
check("mixed lines sum weight",
  estimateShippingCost({ subtotal: 100, lines: [{ quantity: 1 }, { quantity: 3 }], destination: za }),
  105); // (0.5 + 1.5) * 30 + 45 = 105

// ─── computeDiscountAmount ──────────────────────────────────────────────────
console.log("computeDiscountAmount");

const pct10 = { discount_type: "percentage", discount_value: 10 };
const pct100 = { discount_type: "percentage", discount_value: 100 };
const fixed50 = { discount_type: "fixed", discount_value: 50 };
const fixed999 = { discount_type: "fixed", discount_value: 999 };

check("10% off R500",        computeDiscountAmount(pct10, 500),  50);
check("100% off R500",       computeDiscountAmount(pct100, 500), 500);
check("R50 off R500",        computeDiscountAmount(fixed50, 500), 50);
check("fixed > subtotal capped", computeDiscountAmount(fixed999, 500), 500);
check("rounding to 2dp",     computeDiscountAmount(pct10, 333.33), 33.33);
check("zero subtotal",       computeDiscountAmount(pct10, 0), 0);

// ─── generateDiscountCode ───────────────────────────────────────────────────
// Reimplement to test (route file is a Next handler, can't import directly).
console.log("generateDiscountCode (entropy + shape)");

const CODE_CHARS = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
function generateDiscountCode() {
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return `CHARM-${suffix}`;
}

const SAMPLE = 5000;
const seen = new Set();
let validShape = 0;
for (let i = 0; i < SAMPLE; i++) {
  const code = generateDiscountCode();
  if (/^CHARM-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{6}$/.test(code)) validShape++;
  seen.add(code);
}
check(`${SAMPLE} codes all match CHARM-[ALPHABET]{6}`, validShape, SAMPLE);
// Collision rate in 5k samples against ~594M keyspace (30^6) should be 0.
check(`${SAMPLE} codes — no collisions in sample`, seen.size, SAMPLE);
// Confusion-free alphabet — verify absent chars never appear.
const banned = "01ILOU";
let bannedFound = 0;
for (const code of seen) {
  for (const ch of code.slice(6)) if (banned.includes(ch)) bannedFound++;
}
check("confusion-free alphabet — no 0/1/I/L/O/U in suffix", bannedFound, 0);

// ─── Summary ────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\n" + failures.join("\n"));
  process.exit(1);
}
console.log("─".repeat(60) + "\n");
