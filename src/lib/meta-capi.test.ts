import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackMetaPurchase } from "./meta-capi";

const customer = { email: "Thandi@Example.com", first_name: "Thandi", city: "Cape Town", country: "ZA" };
const purchase = {
  eventId: "c1111111-1111-4111-8111-111111111111",
  eventTime: 1764000000,
  value: 600,
  currency: "ZAR",
  contents: [{ id: "p1", quantity: 1, item_price: 600 }],
  contentIds: ["p1"],
  numItems: 1,
  orderId: "c1111111-1111-4111-8111-111111111111",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_FB_PIXEL_ID", "123456");
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "token");
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function sentUserData(): Record<string, unknown> {
  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  return JSON.parse(init.body as string).data[0].user_data;
}

describe("trackMetaPurchase", () => {
  it("sends hashed PII only when there is no browser context", async () => {
    await trackMetaPurchase(customer, purchase);
    const ud = sentUserData();
    expect(Array.isArray(ud.em)).toBe(true);
    expect(ud).not.toHaveProperty("fbp");
    expect(ud).not.toHaveProperty("client_ip_address");
  });

  it("adds the browser ids unhashed, and never an IP address", async () => {
    await trackMetaPurchase(customer, purchase, {
      fbp: "fb.1.1732000000000.123",
      fbc: "fb.1.1732000000000.IwAR0AbC",
      clientUserAgent: "Mozilla/5.0",
    });
    const ud = sentUserData();
    expect(ud.fbp).toBe("fb.1.1732000000000.123");
    expect(ud.fbc).toBe("fb.1.1732000000000.IwAR0AbC");
    expect(ud.client_user_agent).toBe("Mozilla/5.0");
    expect(ud).not.toHaveProperty("client_ip_address");
  });
});
