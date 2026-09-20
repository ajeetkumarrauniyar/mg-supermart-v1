import { describe, it, expect } from "vitest";
import { computeServiceability } from "./serviceability.js";
import { destinationPoint, haversineKm } from "./geo.js";
import { baseConfig, STORE, mobileCalculateDistance } from "../test/fixtures.js";

const cfg = baseConfig();

describe("computeServiceability (D-012)", () => {
  it("the store itself is 0 km and serviceable", () => {
    expect(computeServiceability(STORE, cfg)).toEqual({
      status: "serviceable",
      distanceKm: 0,
      radiusKm: 5,
    });
  });

  it.each([
    [4.9, "serviceable"],
    [5.0, "serviceable"],
    [5.1, "not_serviceable"],
  ] as const)("%s km from the store ⇒ %s (hard radius, no warning band)", (km, status) => {
    const p = destinationPoint(STORE, km, 45);
    const s = computeServiceability(p, cfg);
    expect(s.status).toBe(status);
    expect(s.distanceKm).toBeCloseTo(km, 1);
    expect(s.radiusKm).toBe(5);
    if (status === "not_serviceable") expect(s.reason).toBe("OUTSIDE_RADIUS");
    else expect(s.reason).toBeUndefined();
  });

  it("7 km away is not serviceable (the old 5–7 km warning band is gone)", () => {
    const s = computeServiceability(destinationPoint(STORE, 7, 200), cfg);
    expect(s.status).toBe("not_serviceable");
    expect(s.distanceKm).toBeCloseTo(7, 1);
  });

  it("missing coordinates ⇒ unknown / NO_COORDINATES", () => {
    expect(computeServiceability(null, cfg)).toEqual({
      status: "unknown",
      distanceKm: null,
      radiusKm: 5,
      reason: "NO_COORDINATES",
    });
    expect(computeServiceability({ lat: NaN, lng: 1 }, cfg).status).toBe("unknown");
  });

  it("recomputes against whatever radius the config carries", () => {
    const p = destinationPoint(STORE, 5.1, 90);
    expect(computeServiceability(p, baseConfig({ deliveryRadiusKm: 6 })).status).toBe("serviceable");
  });

  it("agrees with the mobile calculateDistance on the same fixture", () => {
    const p = { lat: 26.5203, lng: 85.0102 }; // a point a few km NE of the store
    const server = Math.round(haversineKm(STORE, p) * 100) / 100;
    const mobile = mobileCalculateDistance(STORE.lat, STORE.lng, p.lat, p.lng);
    expect(server).toBe(mobile);
    expect(computeServiceability(p, cfg).distanceKm).toBe(mobile);
  });
});
