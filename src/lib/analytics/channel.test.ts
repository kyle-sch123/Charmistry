import { describe, expect, it } from "vitest";
import {
  classify,
  classifyTouch,
  detectInApp,
  isAttributable,
  isIgnoredReferrer,
  normaliseSource,
  normaliseUtm,
  sourceFromReferrer,
  type ClassifyInput,
} from "./channel";

const none: ClassifyInput = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  clickIdType: null,
  referrerHost: null,
  inApp: null,
};

function utm(source: string | null, medium: string | null, campaign: string | null = null) {
  return classify({ ...none, utmSource: source, utmMedium: medium, utmCampaign: campaign });
}

describe("normalisation", () => {
  it("trims, collapses whitespace to hyphens and lowercases", () => {
    expect(normaliseUtm("  Christmas  Gifting ")).toBe("christmas-gifting");
  });
  it("strips control characters and caps at 100 characters", () => {
    expect(normaliseUtm("a\u0000b")).toBe("ab");
    expect(normaliseUtm("x".repeat(150))).toHaveLength(100);
  });
  it("turns empty values into null", () => {
    expect(normaliseUtm("   ")).toBeNull();
    expect(normaliseUtm(undefined)).toBeNull();
  });
  it("maps Meta's short site_source_name values", () => {
    expect(normaliseSource("fb")).toBe("facebook");
    expect(normaliseSource("IG")).toBe("instagram");
    expect(normaliseSource("msg")).toBe("messenger");
    expect(normaliseSource("an")).toBe("audience_network");
  });
});

describe("overlay rules (O1-O6)", () => {
  it.each([
    ["transactional", "email", "Transactional"],
    ["transactional", "qr", "Transactional"],
    ["instagram", "influencer", "Influencer"],
    ["insert", "qr", "QR codes"],
    ["whatsapp", "messaging", "Messaging"],
    ["klaviyo", "email", "Email"],
    ["klaviyo", "campaign", "Email"],
    ["klaviyo", "flow", "Email"],
    ["klaviyo", "sms", "SMS"],
  ])("%s / %s is %s", (source, medium, channel) => {
    expect(utm(source, medium).channel).toBe(channel);
  });
  it("marks transactional as excluded and never attributable", () => {
    const c = utm("transactional", "email");
    expect(c.excluded).toBe(true);
    expect(isAttributable(c)).toBe(false);
  });
});

describe("GA4 default channel rules", () => {
  it.each([
    [null, null, null, "Direct"],
    ["google", "cpc", "2026-12_cross-network-test", "Cross-network"],
    ["google", "cpc", "2026-12_shopping", "Paid shopping"],
    ["amazon.co.za", "paid", null, "Paid shopping"],
    ["google", "cpc", null, "Paid search"],
    ["bing", "ppc", null, "Paid search"],
    ["instagram", "paid_social", null, "Paid social"],
    ["tiktok", "paid_social", null, "Paid social"],
    ["fb", "paid_social", null, "Paid social"],
    ["an", "paid_social", null, "Paid social"],
    ["youtube", "cpc", null, "Paid video"],
    ["somesite", "display", null, "Display"],
    ["somesite", "cpm", null, "Display"],
    ["newsletter-co", "paid", null, "Paid other"],
    ["etsy", "referral", null, "Organic shopping"],
    ["instagram", "social", null, "Organic social"],
    ["instagram", "email", null, "Organic social"],
    ["mysite", "social", null, "Organic social"],
    ["mysite", "social network", null, "Organic social"],
    ["youtube", "referral", null, "Organic video"],
    ["mysite", "video-post", null, "Organic video"],
    ["google", "organic", null, "Organic search"],
    ["google", "email", null, "Organic search"],
    ["blog", "organic", null, "Organic search"],
    ["chatgpt.com", null, null, "AI assistant"],
    ["mysite", "ai-assistant", null, "AI assistant"],
    ["blog.example", "referral", null, "Referral"],
    ["partner", "link", null, "Referral"],
    ["newsletter", "email", null, "Email"],
    ["email", "(not set)", null, "Email"],
    ["partner", "affiliate", null, "Affiliates"],
    ["radio", "audio", null, "Audio"],
    ["sms", "text", null, "SMS"],
    ["app", "web-push", null, "Mobile push"],
    ["firebase", "x", null, "Mobile push"],
    ["influencer", "influencer-post", null, "Unassigned"],
    ["qr", "print", null, "Unassigned"],
  ])("%s / %s (campaign %s) is %s", (source, medium, campaign, channel) => {
    expect(utm(source, medium, campaign).channel).toBe(channel);
  });

  it("uses (not set) when only one of source or medium is tagged", () => {
    const c = utm(null, "email");
    expect(c.source).toBe("(not set)");
    expect(c.medium).toBe("email");
    expect(c.channel).toBe("Email");
  });
});

describe("click ids", () => {
  it.each([
    ["gclid", "google", "cpc", "Paid search"],
    ["gbraid", "google", "cpc", "Paid search"],
    ["wbraid", "google", "cpc", "Paid search"],
    ["msclkid", "bing", "cpc", "Paid search"],
    ["ttclid", "tiktok", "paid_social", "Paid social"],
  ] as const)("%s means %s / %s", (clickIdType, source, medium, channel) => {
    const c = classify({ ...none, clickIdType });
    expect([c.source, c.medium, c.channel, c.inferred]).toEqual([source, medium, channel, false]);
  });

  it("treats fbclid alone as inferred organic social on Facebook", () => {
    const c = classify({ ...none, clickIdType: "fbclid" });
    expect([c.source, c.medium, c.channel, c.inferred]).toEqual([
      "facebook",
      "social",
      "Organic social",
      true,
    ]);
  });

  it("takes the fbclid platform from an Instagram referrer", () => {
    const c = classify({ ...none, clickIdType: "fbclid", referrerHost: "l.instagram.com" });
    expect(c.source).toBe("instagram");
  });

  it("lets UTMs beat a click id", () => {
    const c = classify({ ...none, utmSource: "klaviyo", utmMedium: "email", clickIdType: "gclid" });
    expect(c.channel).toBe("Email");
  });
});

describe("referrers", () => {
  it.each([
    ["www.google.co.za", "google", "organic", "Organic search"],
    ["google.com", "google", "organic", "Organic search"],
    ["www.bing.com", "bing", "organic", "Organic search"],
    ["za.search.yahoo.com", "yahoo", "organic", "Organic search"],
    ["duckduckgo.com", "duckduckgo", "organic", "Organic search"],
    ["search.brave.com", "brave", "organic", "Organic search"],
    ["l.instagram.com", "l.instagram.com", "referral", "Organic social"],
    ["www.facebook.com", "facebook.com", "referral", "Organic social"],
    ["chatgpt.com", "chatgpt.com", "referral", "AI assistant"],
    ["www.perplexity.ai", "perplexity.ai", "referral", "AI assistant"],
    ["blog.example.com", "blog.example.com", "referral", "Referral"],
  ])("%s gives %s / %s", (host, source, medium, channel) => {
    expect(sourceFromReferrer(host)).toEqual({ source, medium });
    expect(classify({ ...none, referrerHost: host }).channel).toBe(channel);
  });

  it("ignores our own host, with and without www, and its subdomains", () => {
    expect(isIgnoredReferrer("charmistry.co.za", "www.charmistry.co.za")).toBe(true);
    expect(isIgnoredReferrer("www.charmistry.co.za", "charmistry.co.za")).toBe(true);
    expect(isIgnoredReferrer("shop.charmistry.co.za", "charmistry.co.za")).toBe(true);
    expect(isIgnoredReferrer("google.com", "charmistry.co.za")).toBe(false);
  });

  it("ignores the PayFast hosts", () => {
    for (const h of ["payfast.co.za", "www.payfast.co.za", "sandbox.payfast.co.za"]) {
      expect(isIgnoredReferrer(h, "charmistry.co.za")).toBe(true);
    }
  });
});

describe("in-app browsers", () => {
  it.each([
    ["Mozilla/5.0 (iPhone) Instagram 300.0.0.0", "instagram"],
    ["Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]", "facebook"],
    ["Mozilla/5.0 (Linux) musical_ly_2023", "tiktok"],
    ["Mozilla/5.0 BytedanceWebview", "tiktok"],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/130", null],
  ])("%s is %s", (ua, platform) => {
    expect(detectInApp(ua)).toBe(platform);
  });

  it("classifies an in-app visit with no other signal as inferred social", () => {
    const c = classify({ ...none, inApp: "tiktok" });
    expect([c.source, c.channel, c.inferred]).toEqual(["tiktok", "Organic social", true]);
  });
});

describe("classifyTouch", () => {
  it("treats a missing touch as Direct and not attributable", () => {
    const c = classifyTouch(null);
    expect(c.channel).toBe("Direct");
    expect(isAttributable(c)).toBe(false);
  });
});
