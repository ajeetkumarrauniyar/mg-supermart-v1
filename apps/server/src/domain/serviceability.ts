import { haversineKm } from "./geo.js";
import type { GeoPoint, Serviceability, StoreConfig } from "./types.js";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Serviceability of a point against the current store configuration (D-012).
 *
 * - Hard rule: distanceKm <= deliveryRadiusKm. No warning band.
 * - Missing coordinates ⇒ `unknown` / NO_COORDINATES (cannot be ordered to).
 * - Always returns distanceKm (2 dp) and radiusKm for messaging.
 * - Never persisted; recomputed on every list, quote and order.
 */
export const computeServiceability = (
  point: GeoPoint | null | undefined,
  config: Pick<StoreConfig, "store" | "deliveryRadiusKm">
): Serviceability => {
  const radiusKm = config.deliveryRadiusKm;

  if (
    !point ||
    typeof point.lat !== "number" ||
    typeof point.lng !== "number" ||
    Number.isNaN(point.lat) ||
    Number.isNaN(point.lng)
  ) {
    return { status: "unknown", distanceKm: null, radiusKm, reason: "NO_COORDINATES" };
  }

  const distanceKm = round2(haversineKm(config.store, point));

  if (distanceKm <= radiusKm) {
    return { status: "serviceable", distanceKm, radiusKm };
  }
  return { status: "not_serviceable", distanceKm, radiusKm, reason: "OUTSIDE_RADIUS" };
};
