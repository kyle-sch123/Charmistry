import { describe, expect, it } from "vitest";
import { isBotUserAgent, parseUserAgent } from "./ua";

describe("parseUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      null,
      { device: "mobile", browser: "Safari", os: "iOS" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
      null,
      { device: "mobile", browser: "Chrome", os: "Android" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      null,
      { device: "tablet", browser: "Chrome", os: "Android" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      "tablet",
      { device: "tablet", browser: "Safari", os: "iPadOS" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
      null,
      { device: "desktop", browser: "Edge", os: "Windows" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0",
      null,
      { device: "mobile", browser: "Instagram app", os: "iOS" },
    ],
  ] as const)("%s", (ua, hint, expected) => {
    expect(parseUserAgent(ua, hint)).toEqual(expected);
  });
});

describe("touch-screen hint", () => {
  it("lets the browser's hint override a vague user agent", () => {
    const desktopUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36";
    expect(parseUserAgent(desktopUa, "mobile").device).toBe("mobile");
    expect(parseUserAgent(desktopUa, "tablet").device).toBe("tablet");
    expect(parseUserAgent(desktopUa, null).device).toBe("desktop");
  });
});

describe("isBotUserAgent", () => {
  it.each([
    ["", true],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true],
    ["facebookexternalhit/1.1", true],
    ["Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/130.0 Safari/537.36", true],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36", false],
  ])("%s -> %s", (ua, bot) => {
    expect(isBotUserAgent(ua)).toBe(bot);
  });
});
