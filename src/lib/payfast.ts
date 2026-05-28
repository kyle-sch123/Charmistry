/**
 * PayFast integration — payment request building, ITN signature verification,
 * and server-to-server validation.
 *
 * PayFast standard integration is form-based, not API-based: the client
 * POSTs a signed form to `${baseUrl}/eng/process`, PayFast hosts the
 * payment page, then PayFast POSTs an ITN (Instant Transaction Notification)
 * to our `notify_url`. We:
 *   1. Verify the ITN signature locally (MD5 over the ordered fields).
 *   2. Validate server-to-server with `/eng/query/validate` (defends
 *      against forged ITNs from anyone who guessed the merchant key).
 *   3. Compare `amount_gross` against the order total.
 *   4. Update the order under a status='pending' guard for race safety.
 *
 * Sandbox vs live is toggled by `PAYFAST_SANDBOX=true` in env. The
 * merchant key + ID + passphrase are all read at call time so a missing
 * env var only throws when checkout is exercised, not at module load.
 *
 * Signature construction (this is where PayFast integrations usually
 * break — keep these rules in sync with PayFast's docs):
 *   - Take the fields in the same order they're sent in the form body.
 *   - Drop fields whose value is empty/null/undefined (PayFast ignores
 *     them and including them poisons the signature).
 *   - Trim whitespace from each value (PayFast does this server-side
 *     before hashing).
 *   - URL-encode each value with `+` for spaces (not `%20`) and
 *     uppercase hex (PayFast's PHP `urlencode()` behaviour).
 *   - Join as `key=value&key=value&...`.
 *   - If a passphrase is configured, append `&passphrase=<encoded>`.
 *   - MD5-hash the final string. Lowercase hex.
 */

import crypto from "node:crypto";

const LIVE_BASE_URL = "https://www.payfast.co.za";
const SANDBOX_BASE_URL = "https://sandbox.payfast.co.za";

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  /** Optional. When set on the PayFast dashboard, signatures MUST include it. */
  passphrase: string | null;
  /** Form POST target — `${baseUrl}/eng/process`. */
  processUrl: string;
  /** Server-to-server ITN validation URL — `${baseUrl}/eng/query/validate`. */
  validateUrl: string;
  isSandbox: boolean;
}

export function getPayFastConfig(): PayFastConfig {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) {
    throw new Error(
      "PayFast misconfigured: PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY are required",
    );
  }
  const passphrase = process.env.PAYFAST_PASSPHRASE?.trim() || null;
  const isSandbox = process.env.PAYFAST_SANDBOX === "true";
  const baseUrl = isSandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;
  return {
    merchantId,
    merchantKey,
    passphrase,
    processUrl: `${baseUrl}/eng/process`,
    validateUrl: `${baseUrl}/eng/query/validate`,
    isSandbox,
  };
}

export interface PaymentRequestInput {
  orderId: string;
  amountZar: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  itemName: string;
  itemDescription?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PaymentRequest {
  /** The form POST target — submit `formData` here. */
  paymentUrl: string;
  /** All hidden fields including `signature`, in PayFast field order. */
  formData: Record<string, string>;
}

/**
 * Build a signed PayFast checkout request. The caller is expected to either
 * (a) POST `formData` to `paymentUrl` from a server-rendered HTML form, or
 * (b) hand `{ paymentUrl, formData }` back to the browser so the SPA can
 *     auto-submit a hidden form.
 *
 * `amount` is formatted to two decimals — PayFast rejects unformatted
 * floats. `item_name` is trimmed to 100 chars (their hard limit).
 */
export function buildPaymentRequest(input: PaymentRequestInput): PaymentRequest {
  const config = getPayFastConfig();
  // Field ordering matches PayFast docs — used for signature hashing.
  const fields: Record<string, string | undefined> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    name_first: input.firstName,
    name_last: input.lastName,
    email_address: input.email,
    cell_number: input.phone || undefined,
    m_payment_id: input.orderId,
    amount: input.amountZar.toFixed(2),
    item_name: input.itemName.slice(0, 100),
    item_description: input.itemDescription?.slice(0, 255) || undefined,
  };

  const formData: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === "") continue;
    formData[k] = String(v).trim();
  }
  formData.signature = payfastSignature(formData, config.passphrase);

  return { paymentUrl: config.processUrl, formData };
}

/**
 * Compute the PayFast signature over an ordered field set.
 *
 * PayFast's PHP reference uses `urlencode()`, which differs from JS's
 * `encodeURIComponent` in two ways: spaces become `+` (not `%20`), and
 * percent-encoding is uppercase. We normalise both.
 */
export function payfastSignature(
  data: Record<string, string>,
  passphrase: string | null,
): string {
  const parts: string[] = [];
  for (const [key, rawValue] of Object.entries(data)) {
    if (key === "signature") continue;
    if (rawValue == null || rawValue === "") continue;
    parts.push(`${key}=${payfastUrlEncode(rawValue)}`);
  }
  let payload = parts.join("&");
  if (passphrase) {
    payload += `&passphrase=${payfastUrlEncode(passphrase)}`;
  }
  return crypto.createHash("md5").update(payload).digest("hex");
}

function payfastUrlEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    // encodeURIComponent leaves these alone; PayFast's urlencode escapes them.
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    // PayFast/PHP emits uppercase hex; encodeURIComponent already does this
    // for most characters, but normalise any stragglers just in case.
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

/**
 * Verify a PayFast ITN signature. The caller passes the parsed form fields
 * (everything except `signature`) and the `signature` value as it arrived;
 * we recompute and compare in constant time.
 */
export function verifyItnSignature(
  fields: Record<string, string>,
  receivedSignature: string,
): boolean {
  const config = getPayFastConfig();
  const expected = payfastSignature(fields, config.passphrase);
  if (expected.length !== receivedSignature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(receivedSignature.toLowerCase()),
  );
}

/**
 * Server-to-server defence-in-depth: ask PayFast to confirm that the ITN
 * we received was actually emitted by them. Returns true on "VALID",
 * false otherwise.
 *
 * The body we POST back is the EXACT raw body PayFast sent us — including
 * the signature field, in the original order. Any reformatting and the
 * validation fails.
 */
export async function validateItnWithPayFast(rawBody: string): Promise<boolean> {
  const config = getPayFastConfig();
  const response = await fetch(config.validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody,
  });
  if (!response.ok) return false;
  const text = (await response.text()).trim();
  return text === "VALID";
}

/**
 * Parse the raw `application/x-www-form-urlencoded` body PayFast sends.
 * Preserves the original field order so the validation POST can replay
 * the body byte-for-byte. The returned `fields` is a plain object — for
 * signature verification, exclude the `signature` key before hashing.
 */
export function parseItnBody(rawBody: string): {
  fields: Record<string, string>;
  signature: string;
} {
  const params = new URLSearchParams(rawBody);
  const fields: Record<string, string> = {};
  let signature = "";
  for (const [key, value] of params.entries()) {
    if (key === "signature") {
      signature = value;
      continue;
    }
    fields[key] = value;
  }
  return { fields, signature };
}
