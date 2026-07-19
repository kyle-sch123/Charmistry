import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPaymentRequest,
  parseItnBody,
  payfastSignature,
  verifyItnSignature,
} from "@/lib/payfast";

describe("payfastSignature", () => {
  it("is a deterministic 32-char lowercase md5 hex", () => {
    const data = { merchant_id: "10000100", amount: "100.00" };
    const sig = payfastSignature(data, null);
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(payfastSignature(data, null)).toBe(sig);
  });

  it("skips the signature field and empty values", () => {
    const withEmpties = payfastSignature(
      { merchant_id: "10000100", cell_number: "", signature: "ignore-me" },
      null,
    );
    const without = payfastSignature({ merchant_id: "10000100" }, null);
    expect(withEmpties).toBe(without);
  });

  it("changes when a passphrase is applied", () => {
    const data = { merchant_id: "10000100", amount: "100.00" };
    expect(payfastSignature(data, "s3cr3t")).not.toBe(payfastSignature(data, null));
  });

  it("url-encodes spaces as '+' (PHP urlencode semantics)", () => {
    // Independent known-answer check: the documented payload is `item_name=A+B`.
    const expected = crypto.createHash("md5").update("item_name=A+B").digest("hex");
    expect(payfastSignature({ item_name: "A B" }, null)).toBe(expected);
  });

  it("appends the encoded passphrase to the payload", () => {
    const expected = crypto
      .createHash("md5")
      .update("merchant_id=10000100&passphrase=pass+phrase")
      .digest("hex");
    expect(payfastSignature({ merchant_id: "10000100" }, "pass phrase")).toBe(expected);
  });
});

describe("parseItnBody", () => {
  it("splits fields from the signature", () => {
    const { fields, signature } = parseItnBody(
      "m_payment_id=abc&amount_gross=100.00&signature=deadbeef",
    );
    expect(signature).toBe("deadbeef");
    expect(fields).toEqual({ m_payment_id: "abc", amount_gross: "100.00" });
    expect(fields).not.toHaveProperty("signature");
  });

  it("returns an empty signature when absent", () => {
    expect(parseItnBody("m_payment_id=abc").signature).toBe("");
  });
});

describe("buildPaymentRequest", () => {
  const baseInput = {
    orderId: "order-1",
    amountZar: 199.5,
    email: "buyer@example.com",
    firstName: "Bob",
    lastName: "Smith",
    itemName: "Silver charm",
    returnUrl: "https://shop.test/return",
    cancelUrl: "https://shop.test/cancel",
    notifyUrl: "https://shop.test/notify",
  };

  beforeEach(() => {
    process.env.PAYFAST_MERCHANT_ID = "10000100";
    process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
    process.env.PAYFAST_SANDBOX = "true";
    delete process.env.PAYFAST_PASSPHRASE;
  });

  afterEach(() => {
    delete process.env.PAYFAST_MERCHANT_ID;
    delete process.env.PAYFAST_MERCHANT_KEY;
    delete process.env.PAYFAST_SANDBOX;
  });

  it("targets the sandbox process URL and includes a signature", () => {
    const { paymentUrl, formData } = buildPaymentRequest(baseInput);
    expect(paymentUrl).toBe("https://sandbox.payfast.co.za/eng/process");
    expect(formData.signature).toMatch(/^[0-9a-f]{32}$/);
  });

  it("formats the amount to two decimals", () => {
    expect(buildPaymentRequest(baseInput).formData.amount).toBe("199.50");
  });

  it("drops an absent optional phone number", () => {
    expect(buildPaymentRequest(baseInput).formData).not.toHaveProperty("cell_number");
  });

  it("truncates item_name to PayFast's 100-char limit", () => {
    const { formData } = buildPaymentRequest({ ...baseInput, itemName: "x".repeat(150) });
    expect(formData.item_name).toHaveLength(100);
  });
});

describe("verifyItnSignature", () => {
  const fields = { m_payment_id: "abc", amount_gross: "100.00" };

  beforeEach(() => {
    process.env.PAYFAST_MERCHANT_ID = "10000100";
    process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
    process.env.PAYFAST_PASSPHRASE = "test-passphrase";
  });

  afterEach(() => {
    delete process.env.PAYFAST_MERCHANT_ID;
    delete process.env.PAYFAST_MERCHANT_KEY;
    delete process.env.PAYFAST_PASSPHRASE;
  });

  it("accepts a signature generated with the configured passphrase", () => {
    const good = payfastSignature(fields, "test-passphrase");
    expect(verifyItnSignature(fields, good)).toBe(true);
  });

  it("rejects a forged signature", () => {
    expect(verifyItnSignature(fields, "0".repeat(32))).toBe(false);
  });
});
