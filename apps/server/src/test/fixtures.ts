/** Shared pure fixtures for unit tests (no Firebase). */
import type { StoreConfig } from "../domain/types.js";

export const STORE = { lat: 26.48872184, lng: 84.98157501 }; // D-011

export const baseConfig = (overrides: Partial<StoreConfig> = {}): StoreConfig => ({
  store: STORE,
  deliveryRadiusKm: 5,
  minOrderValue: 500,
  deliveryFee: { amount: 40, waivedAtOrAbove: null }, // PLACEHOLDER values (Q-2)
  handlingFee: { amount: 5, waivedAtOrAbove: null },
  source: "env",
  loadedAt: "2026-09-20T00:00:00.000Z",
  ...overrides,
});

export const validEnv = (): Record<string, string> => ({
  STORE_LAT: "26.48872184",
  STORE_LNG: "84.98157501",
  DELIVERY_RADIUS_KM: "5",
  MIN_ORDER_VALUE: "500",
  DELIVERY_FEE_AMOUNT: "40",
  DELIVERY_FEE_WAIVED_AT: "",
  HANDLING_FEE_AMOUNT: "5",
  HANDLING_FEE_WAIVED_AT: "",
});

/**
 * Verbatim copy of apps/grocery-app/src/utils/location.ts#calculateDistance
 * (grocery-mobile branch) so the parity test documents that server and
 * client agree on the same fixture (Phase 3 replaces the client verdict).
 */
export function mobileCalculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRadians = (d: number) => (d * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
