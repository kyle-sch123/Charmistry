/**
 * Piece consolidation — one card per *piece*, not per metal variant.
 *
 * The catalogue stores one product row per (name, metal). Every surface that
 * lists products (the shop grid, the stack builder) shows one tile per piece
 * and lets the PDP's swatch picker surface the metals, so each of those
 * surfaces has to choose which variant row represents the piece.
 *
 * That choice used to be implicit — whichever row sorted first — which meant
 * the photo and the metal on the shop grid were effectively arbitrary. A row
 * flagged `shop_featured` (set from /admin/catalogue) now wins instead.
 *
 * Pure module: no Supabase import, so the rule is unit-testable and identical
 * everywhere it's applied.
 */

export interface PieceRow {
  name: string;
  category_id: string | null;
  /** Owner's pick for the piece's representative row. Absent pre-migration 010. */
  shop_featured?: boolean | null;
}

/** Grouping key: same (trimmed, case-insensitive) name + category = one piece. */
export function pieceKeyOf(row: PieceRow): string {
  return `${row.name.trim().toLowerCase()}|${row.category_id ?? ""}`;
}

/**
 * Reduce variant rows to one representative per piece, preserving the incoming
 * order (which carries the caller's sort).
 *
 * The first row of a piece claims the slot — so the piece's position still
 * comes from its best-ranked variant — and a later row takes that slot only if
 * the owner flagged it `shop_featured`. With nothing flagged this is exactly
 * the old first-wins behaviour, which is what makes migration 010 a no-op
 * until someone actually picks a photo.
 */
export function pickPieceRepresentatives<T extends PieceRow>(rows: T[]): T[] {
  const out: T[] = [];
  const slotByKey = new Map<string, number>();

  for (const row of rows) {
    const key = pieceKeyOf(row);
    const slot = slotByKey.get(key);
    if (slot === undefined) {
      slotByKey.set(key, out.length);
      out.push(row);
      continue;
    }
    // First flagged row wins; a second flag (shouldn't happen — the admin API
    // clears the piece before setting one) is ignored rather than fought over.
    if (row.shop_featured && !out[slot].shop_featured) out[slot] = row;
  }

  return out;
}
