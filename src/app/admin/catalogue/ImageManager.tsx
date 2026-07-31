/**
 * Photo gallery for one variant: upload (client-side WebP), delete, reorder,
 * set-primary, and tick the piece's shop image. Order + primary live in the
 * row's images[] (persisted via PATCH op:"images"), which is what the PDP
 * gallery reads — so reordering is just rewriting that array, no file renames.
 *
 * Two things a photo can be, and they answer different questions:
 * - Primary    — images[0]; leads the product-page gallery for THIS metal.
 * - Shop image — the one photo (across the whole piece, so the checkboxes are
 *   mutually exclusive and owned by PieceEditor) shown on the shop grid. Since
 *   the grid consolidates metals into one card, ticking a photo also decides
 *   which metal shoppers see there. Persisted via PATCH op:"shop_image".
 */

"use client";

import { useRef, useState } from "react";
import { convertToWebp, WebpUnsupportedError } from "./webp";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

export default function ImageManager({
  pieceName,
  ids,
  images,
  onChange,
  shopImageUrl,
  onSelectShopImage,
  onResolvedImageUrl,
  request,
}: {
  pieceName: string;
  ids: string[];
  images: string[];
  onChange: (images: string[]) => void;
  /** The piece's shop photo when it lives in this variant; null otherwise. */
  shopImageUrl?: string | null;
  onSelectShopImage?: (url: string) => void;
  onResolvedImageUrl?: (url: string | null) => void;
  request: AdminRequest;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Report the row's server-recomputed image_url back to the parent. */
  async function syncResolved(res: Response) {
    if (!onResolvedImageUrl) return;
    try {
      const data = (await res.json()) as {
        thumbnails?: Record<string, string | null>;
      };
      const next = data.thumbnails?.[ids[0]];
      if (next !== undefined) onResolvedImageUrl(next);
    } catch {
      // Body already consumed / not JSON — leave the local value; the next
      // full reload straightens it out.
    }
  }

  async function persist(next: string[]): Promise<boolean> {
    const res = await request("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "images", ids, images: next }),
    });
    if (!res.ok) {
      setError("Couldn't save photo order. Try again.");
      return false;
    }
    onChange(next);
    await syncResolved(res);
    return true;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const { blob } = await convertToWebp(file);
        const form = new FormData();
        form.append("file", blob, "photo.webp");
        form.append("name", pieceName);
        const res = await request("/api/admin/products/images", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          setError("Upload failed. Try again.");
          break;
        }
        const data = (await res.json()) as { url: string };
        uploaded.push(data.url);
      }
      if (uploaded.length > 0) {
        await persist([...images, ...uploaded]);
      }
    } catch (err) {
      setError(
        err instanceof WebpUnsupportedError
          ? err.message
          : "Couldn't process that image.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(url: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await request("/api/admin/products/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ids }),
      });
      if (!res.ok) {
        setError("Couldn't delete that photo. Try again.");
        return;
      }
      onChange(images.filter((u) => u !== url));
      await syncResolved(res);
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(url: string) {
    setBusy(true);
    setError(null);
    await persist([url, ...images.filter((u) => u !== url)]);
    setBusy(false);
  }

  async function move(url: string, dir: -1 | 1) {
    const i = images.indexOf(url);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    setBusy(true);
    setError(null);
    await persist(next);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body">
          Photos ({images.length})
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-[11px] tracking-[0.15em] uppercase text-ink/60 hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
        >
          {busy ? "Working…" : "+ Add photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && onSelectShopImage && (
        <p className="text-[11px] text-ink/45 font-body">
          Tick <span className="text-gold-dark">Shop image</span> to choose the
          photo shoppers see for this product on the shop grid — that also picks
          which metal is shown there. Only one photo across the whole piece can
          hold it.
        </p>
      )}

      {error && <p className="text-[12px] text-red-600 font-body">{error}</p>}

      {images.length === 0 ? (
        <p className="border border-dashed border-ink/15 px-4 py-6 text-center text-[12px] text-ink/45 font-body">
          No photos yet. Add one to show it on the product page.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, i) => {
            const isShopImage = url === shopImageUrl;
            return (
              <div
                key={url}
                className={`group relative border ${
                  isShopImage
                    ? "border-gold-dark ring-1 ring-gold-dark"
                    : i === 0
                      ? "border-ink"
                      : "border-ink/15"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                {i === 0 && (
                  <span className="absolute left-0 top-0 bg-ink px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-paper">
                    Primary
                  </span>
                )}

                {onSelectShopImage && (
                  <label
                    className={`absolute right-0 top-0 flex cursor-pointer items-center gap-1.5 px-2 py-1 text-[9px] uppercase tracking-[0.12em] transition-colors ${
                      isShopImage
                        ? "bg-gold-dark text-paper"
                        : "bg-paper/90 text-ink/60 hover:text-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isShopImage}
                      disabled={busy}
                      onChange={() => {
                        // Untickable by design: the piece always needs one shop
                        // photo, so choosing a different one is how you change it.
                        if (!isShopImage) onSelectShopImage(url);
                      }}
                      className="h-3 w-3 accent-gold-dark cursor-pointer"
                      aria-label="Use this photo on the shop grid"
                    />
                    Shop image
                  </label>
                )}

                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-ink/10 bg-paper px-1.5 py-1">
                  <div className="flex gap-1">
                    <IconBtn
                      label="◀"
                      onClick={() => move(url, -1)}
                      disabled={busy || i === 0}
                    />
                    <IconBtn
                      label="▶"
                      onClick={() => move(url, 1)}
                      disabled={busy || i === images.length - 1}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => makePrimary(url)}
                        disabled={busy}
                        className="text-[10px] uppercase tracking-[0.1em] text-ink/60 hover:text-ink cursor-pointer disabled:opacity-40"
                      >
                        Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(url)}
                      disabled={busy}
                      className="text-[10px] uppercase tracking-[0.1em] text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-1.5 text-[11px] text-ink/60 hover:text-ink cursor-pointer disabled:opacity-30"
    >
      {label}
    </button>
  );
}
