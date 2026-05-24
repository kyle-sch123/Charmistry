import crypto from "node:crypto";

const PAYSTACK_API_URL = "https://api.paystack.co";
const PAYSTACK_INIT_PATH = "/transaction/initialize";

export interface PaystackConfig {
  secretKey: string;
}

export function getPaystackConfig(): PaystackConfig {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Paystack misconfigured: PAYSTACK_SECRET_KEY is required");
  }
  return { secretKey };
}

export interface InitializeTransactionInput {
  email: string;
  amountZar: number;
  orderId: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}

export async function initializeTransaction(
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  const config = getPaystackConfig();
  const response = await fetch(`${PAYSTACK_API_URL}${PAYSTACK_INIT_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountZar * 100),
      callback_url: input.callbackUrl,
      metadata: {
        orderId: input.orderId,
        ...(input.metadata ?? {}),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paystack initialize failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  if (!payload?.status || !payload.data) {
    throw new Error(
      `Paystack initialize response invalid: ${JSON.stringify(payload)}`,
    );
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference,
    accessCode: payload.data.access_code,
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const config = getPaystackConfig();
  const hash = crypto
    .createHmac("sha512", config.secretKey)
    .update(rawBody)
    .digest("hex");
  return signature === hash;
}
