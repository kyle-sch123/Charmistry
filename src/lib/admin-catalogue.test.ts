import { describe, expect, it } from "vitest";
import { nextThumbnail } from "@/lib/admin-catalogue";

const A = "https://cdn.example.com/a.webp";
const B = "https://cdn.example.com/b.webp";
const C = "https://cdn.example.com/c.webp";

describe("nextThumbnail", () => {
  // Default mode: image_url shadows the primary, so any gallery rewrite moves
  // the thumbnail to the new images[0] — the behaviour the tool always had.
  it("follows the new primary when no explicit thumbnail was chosen", () => {
    const row = { images: [A, B, C], image_url: A };
    expect(nextThumbnail(row, [B, A, C])).toBe(B);
    expect(nextThumbnail(row, [C, B, A])).toBe(C);
  });

  it("keeps an explicitly pinned thumbnail across reorders", () => {
    // Owner pinned B while A leads the gallery.
    const row = { images: [A, B, C], image_url: B };
    expect(nextThumbnail(row, [C, A, B])).toBe(B);
    expect(nextThumbnail(row, [B, A, C])).toBe(B);
  });

  it("keeps the pin when new photos are appended", () => {
    const row = { images: [A, B], image_url: B };
    expect(nextThumbnail(row, [A, B, C])).toBe(B);
  });

  it("falls back to the new primary when the pinned photo is deleted", () => {
    const row = { images: [A, B, C], image_url: B };
    expect(nextThumbnail(row, [A, C])).toBe(A);
  });

  it("re-enters follow mode after the pin is set back onto the primary", () => {
    // Pin equals the current primary → treated as the default again.
    const row = { images: [A, B, C], image_url: A };
    expect(nextThumbnail(row, [B, C, A])).toBe(B);
  });

  // The shop_featured rows are the ones whose photo the owner ticked, so their
  // image_url is an explicit choice even when it happens to be the primary —
  // the differs-from-primary heuristic alone can't see that case.
  it("keeps a shop-image pin that sits at position 0 across a reorder", () => {
    const row = { images: [A, B, C], image_url: A, shop_featured: true };
    expect(nextThumbnail(row, [B, C, A])).toBe(A);
  });

  it("keeps a shop-image pin from anywhere in the gallery", () => {
    const row = { images: [A, B, C], image_url: C, shop_featured: true };
    expect(nextThumbnail(row, [B, C, A])).toBe(C);
  });

  it("falls back to the new primary when the shop image is deleted", () => {
    const row = { images: [A, B, C], image_url: B, shop_featured: true };
    expect(nextThumbnail(row, [C, A])).toBe(C);
  });

  it("adopts the first photo for rows that never had managed images", () => {
    // Legacy rows: bucket-discovered image_url, empty images[]. First managed
    // write wins — matches the pre-thumbnail behaviour.
    const legacy = "https://cdn.example.com/legacy-bucket.jpg";
    const row = { images: [], image_url: legacy };
    expect(nextThumbnail(row, [A])).toBe(A);
    // ...unless the legacy URL itself was adopted into the gallery.
    expect(nextThumbnail(row, [legacy, A])).toBe(legacy);
  });

  it("returns null when the gallery empties", () => {
    expect(nextThumbnail({ images: [A], image_url: A }, [])).toBeNull();
    expect(nextThumbnail({ images: null, image_url: null }, [])).toBeNull();
  });

  it("ignores legacy bare filenames when locating the old primary", () => {
    // images[] from the old CSV import can hold bare filenames; the effective
    // primary is the first absolute URL, so a pin on B must survive.
    const row = { images: ["bare-file.jpg", A, B], image_url: B };
    expect(nextThumbnail(row, [A, B])).toBe(B);
  });
});
