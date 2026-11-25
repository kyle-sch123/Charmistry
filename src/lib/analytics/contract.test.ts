import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVENT_NAMES, isEventName, scrubSearchTerm } from "./events";
import { isUuid, newId } from "./ids";
import { ANALYTICS_RPC } from "./rpc";
import {
  ANALYTICS_MIGRATION,
  isAnalyticsMissingError,
  missingFunctions,
  setupRequiredResponse,
} from "./setup";
import { STAFF_KEY } from "./types";

describe("constants", () => {
  it("treats a browser that used the admin key as staff", () => {
    // shared.tsx is JSX that vitest's node environment can't import, so read
    // the constant from source; the admin gate stores the key under this name.
    const source = readFileSync(
      fileURLToPath(new URL("../../app/admin/catalogue/shared.tsx", import.meta.url)),
      "utf8",
    );
    const keyStorage = /KEY_STORAGE\s*=\s*"([^"]+)"/.exec(source)?.[1];
    expect(STAFF_KEY).toBe(keyStorage);
  });
  it("lists every event name once", () => {
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
    expect(isEventName("add_to_cart")).toBe(true);
    expect(isEventName("drop_table")).toBe(false);
  });
});

describe("scrubSearchTerm", () => {
  it("replaces email-looking terms and tidies whitespace", () => {
    expect(scrubSearchTerm("thandi@example.com")).toBe("[email]");
    expect(scrubSearchTerm("  gold   hoops ")).toBe("gold hoops");
  });
});

describe("ids", () => {
  it("makes v4 uuids that isUuid accepts", () => {
    const id = newId();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4");
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe("setup", () => {
  it("recognises missing tables and functions from Postgres and PostgREST", () => {
    for (const code of ["42P01", "PGRST205", "PGRST202", "42883"]) {
      expect(isAnalyticsMissingError({ code })).toBe(true);
    }
    expect(isAnalyticsMissingError({ code: "23505" })).toBe(false);
    expect(isAnalyticsMissingError(null)).toBe(false);
  });

  it("answers setup_required with HTTP 200 and no caching", async () => {
    const res = setupRequiredResponse(["analytics_summary"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      status: "setup_required",
      missing: ["analytics_summary"],
      migration: ANALYTICS_MIGRATION,
    });
  });

  it("lists every function when none could be pinned down", () => {
    expect(missingFunctions([])).toHaveLength(Object.keys(ANALYTICS_RPC).length);
    expect(missingFunctions(["analytics_funnel", "analytics_funnel"])).toEqual(["analytics_funnel"]);
  });
});
