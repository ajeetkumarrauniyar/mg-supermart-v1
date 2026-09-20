/**
 * Integration-test environment.
 *
 * Runs (via vitest `setupFiles`) before any test file module is evaluated, so
 * every value below is in place before `app.ts` → `services/firebase.ts` runs
 * its import-time `initializeFirebase()`. Nothing in firebase.ts is changed for
 * this to work (Phase 1, T1.2).
 *
 * The project id carries the `demo-` prefix: firebase-tools treats it as an
 * offline, emulator-only project, so no credentials or login are ever needed
 * and it can never resolve to a real project.
 */
process.env.NODE_ENV = "test";
process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
process.env.FIREBASE_PROJECT_ID = "demo-mg-mart-test";
process.env.JWT_SECRET = "test";

// StoreConfig (D-014) — D-011 coordinates, 5 km, ₹500, Q-2 placeholder fees.
process.env.STORE_LAT = "26.48872184";
process.env.STORE_LNG = "84.98157501";
process.env.DELIVERY_RADIUS_KM = "5";
process.env.MIN_ORDER_VALUE = "500";
process.env.DELIVERY_FEE_AMOUNT = "40"; // PLACEHOLDER — not a business rule; see .gsd/STATE.md Q-2
process.env.DELIVERY_FEE_WAIVED_AT = "";
process.env.HANDLING_FEE_AMOUNT = "5"; // PLACEHOLDER — not a business rule; see .gsd/STATE.md Q-2
process.env.HANDLING_FEE_WAIVED_AT = "";

// Legacy admin-panel shippingAddress.state compatibility value (T5.2). Not a business rule.
process.env.LEGACY_SHIPPING_STATE = "Bihar";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Integration tests must run against the Firestore emulator");
}
