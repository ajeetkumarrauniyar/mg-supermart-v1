import { defineConfig } from "vitest/config";

// Integration tests: run under `firebase emulators:exec --only firestore`.
// setup.ts sets every env var BEFORE app.ts is imported (firebase.ts initialises on import).
export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    exclude: ["node_modules", "dist"],
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    fileParallelism: false, // one shared emulator; files clear it between runs
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
