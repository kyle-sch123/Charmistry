/**
 * Node resolve hook that rewrites the `@/` path alias from tsconfig.json
 * to file URLs under `src/`. Lets test-runtime.mjs import the actual
 * Next.js route handlers (which use `@/lib/...` etc.) under plain Node.
 *
 * Usage: node --experimental-strip-types --import ./scripts/test-loader.mjs scripts/test-runtime.mjs
 */

import { register } from "node:module";

register("./test-loader-impl.mjs", import.meta.url);
