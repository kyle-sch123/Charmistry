import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure-logic unit tests run in a Node environment. The `@/` alias mirrors the
// tsconfig `paths` mapping so tests import modules exactly as app code does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
