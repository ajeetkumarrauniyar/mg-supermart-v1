/**
 * Integration-test environment.
 *
 * Runs (via vitest `setupFiles`) before any test file module is evaluated, so
 * every value below is in place before `app.ts` → `services/firebase.ts` runs
 * its import-time `initializeFirebase()`, which needs no change for this to
 * work.
 *
 * The project id carries the `demo-` prefix: firebase-tools treats it as an
 * offline, emulator-only project, so no credentials or login are ever needed
 * and it can never resolve to a real project.
 */
process.env.NODE_ENV = "test";
process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
process.env.FIREBASE_PROJECT_ID = "demo-mg-mart-test";
process.env.JWT_SECRET = "test";

// Store configuration: real coordinates, 5 km radius, ₹500 minimum, placeholder fees.
process.env.STORE_LAT = "26.48872184";
process.env.STORE_LNG = "84.98157501";
process.env.DELIVERY_RADIUS_KM = "5";
process.env.MIN_ORDER_VALUE = "500";
process.env.DELIVERY_FEE_AMOUNT = "40"; // placeholder; the real fee is not set yet
process.env.DELIVERY_FEE_WAIVED_AT = "";
process.env.HANDLING_FEE_AMOUNT = "5"; // placeholder; the real fee is not set yet
process.env.HANDLING_FEE_WAIVED_AT = "";

// Compatibility value for the legacy admin-panel shippingAddress.state field.
process.env.LEGACY_SHIPPING_STATE = "Bihar";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Integration tests must run against the Firestore emulator");
}
