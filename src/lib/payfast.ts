import crypto from "node:crypto";

// PayFast integration helpers.
// Docs: https://developers.payfast.co.za/docs

const SANDBOX_PROCESS = "https://sandbox.payfast.co.za/eng/process";
const LIVE_PROCESS = "https://www.payfast.co.za/eng/process";
const SANDBOX_VALIDATE = "https://sandbox.payfast.co.za/eng/query/validate";
const LIVE_VALIDATE = "https://www.payfast.co.za/eng/query/validate";

// Fields must be passed to the engine in this exact order. PayFast validates
// the signature against the insertion order of the posted form fields.
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
] as const;

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
  processUrl: string;
  validateUrl: string;
}

export function getPayFastConfig(): PayFastConfig {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
  const sandbox = (process.env.PAYFAST_SANDBOX ?? "true").toLowerCase() !== "false";

  if (!merchantId || !merchantKey) {
    throw new Error("PayFast misconfigured: PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY are required");
  }

  return {
    merchantId,
    merchantKey,
    passphrase,
    sandbox,
    processUrl: sandbox ? SANDBOX_PROCESS : LIVE_PROCESS,
    validateUrl: sandbox ? SANDBOX_VALIDATE : LIVE_VALIDATE,
  };
}

// PHP urlencode-compatible encoder. PayFast signs using PHP's urlencode,
// which differs from JS encodeURIComponent in a few characters.
function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/~/g, "%7E");
}

function buildSignatureString(
  fields: Record<string, string>,
  order: readonly string[],
  passphrase: string,
): string {
  const parts: string[] = [];
  for (const key of order) {
    const raw = fields[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    parts.push(`${key}=${phpUrlencode(trimmed)}`);
  }
  let signatureString = parts.join("&");
  if (passphrase && passphrase.trim() !== "") {
    signatureString += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  }
  return signatureString;
}

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex");
}

export interface CheckoutPayloadInput {
  orderId: string;
  amount: number;
  itemName: string;
  itemDescription?: string;
  firstName: string;
  lastName: string;
  email: string;
  cellNumber?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PayFastFormPayload {
  action: string;
  fields: Record<string, string>;
}

export function buildCheckoutPayload(input: CheckoutPayloadInput): PayFastFormPayload {
  const config = getPayFastConfig();

  const fields: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    name_first: input.firstName,
    name_last: input.lastName,
    email_address: input.email,
    m_payment_id: input.orderId,
    amount: input.amount.toFixed(2),
    item_name: input.itemName.slice(0, 100),
  };

  if (input.cellNumber && input.cellNumber.trim() !== "") {
    fields.cell_number = input.cellNumber.trim();
  }
  if (input.itemDescription && input.itemDescription.trim() !== "") {
    fields.item_description = input.itemDescription.slice(0, 255);
  }

  const signatureString = buildSignatureString(fields, PAYFAST_FIELD_ORDER, config.passphrase);
  fields.signature = md5(signatureString);

  return { action: config.processUrl, fields };
}

// Verify the signature on an incoming ITN payload.
// PayFast ITN rebuilds the signature from the fields in the order they are
// received (minus the signature field itself), then appends the passphrase.
export function verifyItnSignature(params: Record<string, string>): boolean {
  const config = getPayFastConfig();
  const keys = Object.keys(params).filter((k) => k !== "signature");

  const parts: string[] = [];
  for (const key of keys) {
    const raw = params[key];
    if (raw === undefined || raw === null) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    parts.push(`${key}=${phpUrlencode(trimmed)}`);
  }
  let signatureString = parts.join("&");
  if (config.passphrase && config.passphrase.trim() !== "") {
    signatureString += `&passphrase=${phpUrlencode(config.passphrase.trim())}`;
  }

  const expected = md5(signatureString);
  const received = (params.signature ?? "").toLowerCase();
  return expected === received;
}

// Post the raw ITN body back to PayFast for validation.
// Returns true when PayFast responds with "VALID".
export async function validateItnWithPayFast(rawBody: string): Promise<boolean> {
  const config = getPayFastConfig();
  const res = await fetch(config.validateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody,
  });
  if (!res.ok) return false;
  const text = (await res.text()).trim();
  return text === "VALID";
}

// Known PayFast source IP hostnames — resolve then whitelist at the edge
// if you want a stricter check. Kept as a reference list; we rely on the
// signature + server-side validate call as primary defense.
export const PAYFAST_SOURCE_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];
