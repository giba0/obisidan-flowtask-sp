import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { obsidian: resolve(__dirname, "tests/obsidian-shim.ts") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
