import { describe, expect, it } from "vitest";
import { isExcludedPath, pageTypeFor, referrerHostOf, sanitisePath } from "./url";

describe("sanitisePath", () => {
  it("drops the query string and hash so nothing personal is stored", () => {
    expect(sanitisePath("/shop?email=a@b.co&_kx=abc#top")).toBe("/shop");
  });
  it("collapses double slashes, trims a trailing slash and defaults to /", () => {
    expect(sanitisePath("//products//belle-ring/")).toBe("/products/belle-ring");
    expect(sanitisePath("")).toBe("/");
  });
  it("caps very long paths", () => {
    expect(sanitisePath(`/${"a".repeat(500)}`)).toHaveLength(300);
  });
});

describe("pageTypeFor", () => {
  it.each([
    ["/", "home", null],
    ["/shop", "shop", null],
    ["/best-sellers", "listing", null],
    ["/collections/daily-affair", "listing", null],
    ["/products/sole-rings-gold", "product", "sole-rings-gold"],
    ["/checkout", "checkout", null],
    ["/checkout/success", "checkout_success", null],
    ["/checkout/cancelled", "checkout_cancelled", null],
    ["/account/orders", "account", null],
    ["/login", "account", null],
    ["/privacy", "info", null],
    ["/faq", "info", null],
    ["/something-else", "other", null],
  ])("%s is %s", (path, pageType, productSlug) => {
    expect(pageTypeFor(path)).toEqual({ pageType, productSlug });
  });
});

describe("isExcludedPath", () => {
  it("excludes admin and API paths only", () => {
    expect(isExcludedPath("/admin")).toBe(true);
    expect(isExcludedPath("/admin/analytics")).toBe(true);
    expect(isExcludedPath("/api/checkout")).toBe(true);
    expect(isExcludedPath("/administrator-tips")).toBe(false);
    expect(isExcludedPath("/shop")).toBe(false);
  });
});

describe("referrerHostOf", () => {
  it("returns the lowercased host of an external referrer", () => {
    expect(referrerHostOf("https://L.Instagram.com/?u=x", "charmistry.co.za")).toBe(
      "l.instagram.com",
    );
  });
  it("returns null for our own site, PayFast, empty and invalid referrers", () => {
    expect(referrerHostOf("https://www.charmistry.co.za/shop", "charmistry.co.za")).toBeNull();
    expect(referrerHostOf("https://sandbox.payfast.co.za/eng/process", "localhost")).toBeNull();
    expect(referrerHostOf("", "localhost")).toBeNull();
    expect(referrerHostOf("not a url", "localhost")).toBeNull();
    expect(referrerHostOf("android-app://com.google.android.gm", "localhost")).toBeNull();
  });
});
