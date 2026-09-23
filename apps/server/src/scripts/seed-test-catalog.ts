/**
 * CLI: load the deterministic seed catalog into an isolated Firestore target.
 *
 *   pnpm --filter @mg-mart/server seed:test            # emulator (FIRESTORE_EMULATOR_HOST)
 *   pnpm --filter @mg-mart/server seed:test -- --reset # delete SEED-* first
 *   FIREBASE_PROJECT_ID=mg-supermart-staging pnpm ... seed:test -- --allow-project
 *
 * Refuses the production project unconditionally.
 */
import dotenv from "dotenv";
dotenv.config();

import { resolveSeedTarget, SeedTargetError } from "../seed/seedGuard.js";

const args = new Set(process.argv.slice(2));
const flags = { allowProject: args.has("--allow-project") };
const reset = args.has("--reset");

let target;
try {
  target = resolveSeedTarget(process.env, flags);
} catch (e) {
  if (e instanceof SeedTargetError) {
    console.error(`seed:test refused — ${e.message}`);
    process.exit(2);
  }
  throw e;
}

// Import Firebase only after the guard passed (firebase.ts initialises on import)
const { getDb } = await import("../services/firebase.js");
const { loadSeed, readSeedCatalog } = await import("../seed/loadSeed.js");

const catalog = readSeedCatalog();
const result = await loadSeed(getDb(), catalog, { reset });
console.log(
  `seed:test → ${target.kind === "emulator" ? `emulator ${target.host}` : target.projectId}: ` +
    `${result.products} SEED-* products written (${result.deleted} deleted first), admin ${result.adminUserId}`
);
