import type { GeoPoint } from "./types.js";

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle (Haversine) distance between two points, in kilometres.
 * Straight-line, not road distance. Matches the formula the mobile app uses
 * so client and server agree on the same coordinates.
 */
export const haversineKm = (a: GeoPoint, b: GeoPoint): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

/**
 * Moves `km` kilometres from `origin` along `bearingDeg` (0 = north).
 * Test-fixture helper so specs can build "exactly 4.9 km away" points.
 */
export const destinationPoint = (origin: GeoPoint, km: number, bearingDeg: number): GeoPoint => {
  const d = km / EARTH_RADIUS_KM;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
};
