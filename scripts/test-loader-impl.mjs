/**
 * Custom resolve hook (loaded by test-loader.mjs via module.register).
 * Translates `@/foo` specifiers into `file:///…/src/foo` URLs so route
 * handler imports resolve under plain Node.
 */

import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const SRC_URL = pathToFileURL(path.resolve(process.cwd(), "src")).href + "/";

// Imports under `src/` from route files don't carry extensions (the Next
// bundler resolves them). Try `.ts`, then `.tsx`, then `/index.ts(x)`.
function tryExtensions(baseUrl) {
  const basePath = fileURLToPath(baseUrl);
  for (const ext of [".ts", ".tsx", ".mts"]) {
    if (fs.existsSync(basePath + ext)) return baseUrl + ext;
  }
  for (const idx of ["/index.ts", "/index.tsx"]) {
    if (fs.existsSync(basePath + idx)) return baseUrl + idx;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const baseUrl = SRC_URL + specifier.slice(2);
    const resolved = tryExtensions(baseUrl);
    if (resolved) return nextResolve(resolved, context);
    return nextResolve(baseUrl, context);
  }
  // Relative imports inside src/ also tend to lack extensions.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL &&
    context.parentURL.startsWith(SRC_URL)
  ) {
    const parentDir = new URL(".", context.parentURL).href;
    const candidate = new URL(specifier, parentDir).href;
    if (!/\.[a-zA-Z0-9]+$/.test(specifier)) {
      const resolved = tryExtensions(candidate);
      if (resolved) return nextResolve(resolved, context);
    }
  }
  return nextResolve(specifier, context);
}
