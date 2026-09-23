import { defineConfig } from "vitest/config";

// Unit tests: pure modules only (src/domain, src/config, src/utils). No Firebase.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/*.int.test.ts", "node_modules", "dist"],
    environment: "node",
  },
});
