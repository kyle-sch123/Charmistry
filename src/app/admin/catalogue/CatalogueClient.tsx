/**
 * Catalogue console (client).
 *
 * Auth mirrors the fulfilment page: the admin key is entered once, kept in
 * localStorage, and sent as `x-admin-key` on every request; a 401 clears it and
 * drops back to the gate. Loads all pieces + categories in one GET, then lets
 * the owner create products, edit them, manage photos, and manage categories.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KEY_STORAGE, type AdminCategory, type AdminPiece } from "./shared";
import PieceEditor from "./PieceEditor";
import NewProductForm from "./NewProductForm";
import CategoryManager from "./CategoryManager";

type AdminRequest = (input: string, init?: RequestInit) => Promise<Response>;

export default function CatalogueClient() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [pieces, setPieces] = useState<AdminPiece[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const request = useCallback<AdminRequest>(
    async (input, init) => {
      const headers = new Headers(init?.headers);
      if (adminKey) headers.set("x-admin-key", adminKey);
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        localStorage.removeItem(KEY_STORAGE);
        setAdminKey(null);
        setPieces(null);
        setGateError("That key was rejected. Enter the current admin key.");
      }
      return res;
    },
    [adminKey],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await request("/api/admin/products", { cache: "no-store" });
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`list failed (${res.status})`);
      const data = (await res.json()) as {
        pieces: AdminPiece[];
        categories: AdminCategory[];
      };
      setPieces(data.pieces);
      setCategories(data.categories);
    } catch (err) {
      console.error(err);
      setListError("Couldn't load the catalogue. Check the connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  // Hydrate the stored key once (localStorage is client-only).
  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    if (stored) setAdminKey(stored);
  }, []);

  // Load whenever we have a key (also re-runs after unlock).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (adminKey) loadData();
  }, [adminKey, loadData]);

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) return;
    localStorage.setItem(KEY_STORAGE, key);
    setAdminKey(key);
    setGateError(null);
    setKeyInput("");
  }

  const filtered = useMemo(() => {
    if (!pieces) return [];
    const term = search.trim().toLowerCase();
    return pieces.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (categoryFilter === "all") return true;
      if (categoryFilter === "none") return p.category_id === null;
      return p.category_id === categoryFilter;
    });
  }, [pieces, search, categoryFilter]);

  if (!hydrated) return null;

  // ---- Key gate -----------------------------------------------------------
  if (!adminKey) {
    return (
      <form onSubmit={unlock} className="max-w-sm space-y-4">
        <label className="block">
          <span className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
            Admin key
          </span>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoFocus
            className="w-full border border-ink/15 bg-paper px-4 py-3 text-sm font-body focus:outline-none focus:border-ink transition-colors"
          />
        </label>
        {gateError && <p className="text-[12px] text-red-600 font-body">{gateError}</p>}
        <button
          type="submit"
          disabled={!keyInput.trim()}
          className="bg-ink px-8 py-3 text-xs uppercase tracking-[0.2em] text-paper hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    );
  }

  // ---- Catalogue ----------------------------------------------------------
  return (
    <div className="space-y-6">
      <NewProductForm categories={categories} request={request} onCreated={loadData} />

      <CategoryManager request={request} onChanged={loadData} />

      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="flex-1 min-w-[180px] border border-ink/15 bg-paper px-3 py-2.5 text-sm font-body focus:outline-none focus:border-ink transition-colors"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-ink/15 bg-paper px-3 py-2.5 text-sm font-body focus:outline-none focus:border-ink transition-colors cursor-pointer"
        >
          <option value="all">All categories</option>
          <option value="none">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="text-[11px] tracking-[0.15em] uppercase text-ink/55 hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <p className="text-[11px] tracking-[0.2em] uppercase text-ink/45 font-body">
        {pieces ? `${filtered.length} of ${pieces.length} products` : "Loading…"}
      </p>

      {listError && (
        <p className="border border-red-900/30 bg-red-50 px-4 py-3 text-sm text-red-900 font-body">
          {listError}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((piece) => (
          <PieceEditor
            key={piece.key}
            piece={piece}
            categories={categories}
            request={request}
            onChanged={loadData}
          />
        ))}
        {pieces && filtered.length === 0 && !listError && (
          <p className="border border-ink/10 bg-paper-warm px-4 py-8 text-center text-sm text-ink/50 font-body">
            No products match.
          </p>
        )}
      </div>
    </div>
  );
}
