import { describe, expect, it } from "vitest";
import { pickPieceRepresentatives, pieceKeyOf } from "@/lib/pieces";

const row = (
  name: string,
  category_id: string | null,
  extra: { metal?: string; shop_featured?: boolean } = {},
) => ({ name, category_id, ...extra });

describe("pieceKeyOf", () => {
  it("treats case and surrounding whitespace as the same piece", () => {
    expect(pieceKeyOf(row("Nova Necklace", "c1"))).toBe(
      pieceKeyOf(row("  nova necklace ", "c1")),
    );
  });

  it("separates same-named pieces in different categories", () => {
    expect(pieceKeyOf(row("Sole", "rings"))).not.toBe(
      pieceKeyOf(row("Sole", "bracelets")),
    );
  });
});

describe("pickPieceRepresentatives", () => {
  it("keeps the first variant when nothing is flagged", () => {
    // Pre-migration / nothing chosen — must behave exactly as it always did.
    const rows = [
      row("Nova", "c1", { metal: "gold" }),
      row("Nova", "c1", { metal: "silver" }),
    ];
    expect(pickPieceRepresentatives(rows)).toEqual([rows[0]]);
  });

  it("promotes the flagged variant over the one that sorted first", () => {
    const gold = row("Nova", "c1", { metal: "gold" });
    const silver = row("Nova", "c1", { metal: "silver", shop_featured: true });
    expect(pickPieceRepresentatives([gold, silver])).toEqual([silver]);
  });

  it("keeps the piece's sort position when a later variant is promoted", () => {
    // Nova leads the grid; promoting its silver row must not push the piece
    // down past Lucy — position comes from the first-seen variant.
    const novaGold = row("Nova", "c1", { metal: "gold" });
    const lucy = row("Lucy", "c1");
    const novaSilver = row("Nova", "c1", { metal: "silver", shop_featured: true });
    expect(pickPieceRepresentatives([novaGold, lucy, novaSilver])).toEqual([
      novaSilver,
      lucy,
    ]);
  });

  it("keeps a flagged variant that already sorted first", () => {
    const gold = row("Nova", "c1", { metal: "gold", shop_featured: true });
    const silver = row("Nova", "c1", { metal: "silver" });
    expect(pickPieceRepresentatives([gold, silver])).toEqual([gold]);
  });

  it("ignores a second flag rather than letting the last row win", () => {
    // The admin API clears the piece before flagging, so two flags shouldn't
    // exist — if they do, stay deterministic instead of flip-flopping.
    const first = row("Nova", "c1", { metal: "gold", shop_featured: true });
    const second = row("Nova", "c1", { metal: "silver", shop_featured: true });
    expect(pickPieceRepresentatives([first, second])).toEqual([first]);
  });

  it("resolves each piece independently", () => {
    const rows = [
      row("Nova", "c1", { metal: "gold" }),
      row("Lucy", "c1", { metal: "gold" }),
      row("Nova", "c1", { metal: "silver", shop_featured: true }),
      row("Lucy", "c1", { metal: "silver" }),
    ];
    expect(pickPieceRepresentatives(rows)).toEqual([rows[2], rows[1]]);
  });

  it("keeps uncategorised same-named rows grouped, and handles an empty list", () => {
    expect(pickPieceRepresentatives([])).toEqual([]);
    const rows = [row("Mystery", null), row("Mystery", null)];
    expect(pickPieceRepresentatives(rows)).toHaveLength(1);
  });
});
