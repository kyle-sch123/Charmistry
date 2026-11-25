import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_RE,
  buildCampaignUrl,
  campaignPrefix,
  defaultMediumFor,
  slugifyTag,
} from "./campaign-presets";
import { classify } from "./channel";

describe("defaultMediumFor", () => {
  it.each([
    ["insert", "qr"],
    ["klaviyo", "email"],
    ["whatsapp", "messaging"],
    ["google", "cpc"],
    ["instagram", "social"],
    ["tiktok", "social"],
  ])("%s defaults to %s", (source, medium) => {
    expect(defaultMediumFor(source)).toBe(medium);
  });
});

describe("CAMPAIGN_RE", () => {
  it.each(["2026-12_christmas-gifting", "always-on_bio", "flow_welcome", "a1"])(
    "accepts %s",
    (v) => expect(CAMPAIGN_RE.test(v)).toBe(true),
  );
  it.each(["2026-11_", "Bad Name", "a--b", "_lead", "trail-", ""])("rejects %s", (v) =>
    expect(CAMPAIGN_RE.test(v)).toBe(false),
  );
});

describe("slugifyTag", () => {
  it("lowercases, hyphenates spaces and drops other characters", () => {
    expect(slugifyTag("  December Gifting! ")).toBe("december-gifting");
    expect(slugifyTag("2026-12__christmas--gifting-")).toBe("2026-12_christmas-gifting");
  });
});

describe("campaignPrefix", () => {
  it("uses the SAST month", () => {
    expect(campaignPrefix(new Date("2026-11-25T10:00:00Z"))).toBe("2026-11_");
    // 23:30 UTC on 30 Nov is already 1 Dec in South Africa.
    expect(campaignPrefix(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12_");
  });
});

describe("buildCampaignUrl", () => {
  it("adds the tags in order and encodes them", () => {
    expect(
      buildCampaignUrl({
        origin: "https://charmistry.co.za",
        path: "/collections/daily-affair",
        source: "instagram",
        medium: "social",
        campaign: "2026-12_christmas-gifting",
        content: "story_sticker",
      }),
    ).toBe(
      "https://charmistry.co.za/collections/daily-affair?utm_source=instagram&utm_medium=social&utm_campaign=2026-12_christmas-gifting&utm_content=story_sticker",
    );
  });
  it("leaves out empty content", () => {
    expect(
      buildCampaignUrl({
        origin: "http://localhost:3000",
        path: "shop",
        source: "klaviyo",
        medium: "email",
        campaign: "flow_welcome",
        content: "",
      }),
    ).toBe("http://localhost:3000/shop?utm_source=klaviyo&utm_medium=email&utm_campaign=flow_welcome");
  });
});

describe("presets classify the way the builder promises", () => {
  it.each([
    ["insert", "qr", "QR codes"],
    ["whatsapp", "messaging", "Messaging"],
    ["google", "cpc", "Paid search"],
    ["klaviyo", "email", "Email"],
    ["klaviyo", "sms", "SMS"],
    ["instagram", "paid_social", "Paid social"],
    ["instagram", "social", "Organic social"],
    ["tiktok", "influencer", "Influencer"],
  ])("%s / %s shows as %s", (utmSource, utmMedium, channel) => {
    expect(
      classify({
        utmSource,
        utmMedium,
        utmCampaign: "2026-12_test",
        clickIdType: null,
        referrerHost: null,
        inApp: null,
      }).channel,
    ).toBe(channel);
  });
});
