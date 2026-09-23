import { describe, it, expect } from "vitest";
import { parseStoreConfig, ConfigError } from "./storeConfig.js";
import { validEnv } from "../test/fixtures.js";

describe("parseStoreConfig", () => {
  it("parses a complete env into a typed StoreConfig", () => {
    const cfg = parseStoreConfig(validEnv(), () => new Date("2026-09-20T00:00:00Z"));
    expect(cfg).toEqual({
      store: { lat: 26.48872184, lng: 84.98157501 },
      deliveryRadiusKm: 5,
      minOrderValue: 500,
      deliveryFee: { amount: 40, waivedAtOrAbove: null },
      handlingFee: { amount: 5, waivedAtOrAbove: null },
      source: "env",
      loadedAt: "2026-09-20T00:00:00.000Z",
    });
  });

  it("names every missing variable", () => {
    const env = validEnv();
    delete env.STORE_LAT;
    delete env.MIN_ORDER_VALUE;
    expect(() => parseStoreConfig(env)).toThrow(ConfigError);
    try {
      parseStoreConfig(env);
    } catch (e) {
      const problems = (e as ConfigError).problems;
      expect(problems).toContain("STORE_LAT is required");
      expect(problems).toContain("MIN_ORDER_VALUE is required");
    }
  });

  it("empty *_WAIVED_AT ⇒ null (fee always applies); a number ⇒ threshold", () => {
    const env = { ...validEnv(), DELIVERY_FEE_WAIVED_AT: "999", HANDLING_FEE_WAIVED_AT: "  " };
    const cfg = parseStoreConfig(env);
    expect(cfg.deliveryFee.waivedAtOrAbove).toBe(999);
    expect(cfg.handlingFee.waivedAtOrAbove).toBeNull();
  });

  it("rejects NaN and negative values", () => {
    expect(() => parseStoreConfig({ ...validEnv(), DELIVERY_RADIUS_KM: "five" })).toThrow(
      /DELIVERY_RADIUS_KM must be a number/
    );
    expect(() => parseStoreConfig({ ...validEnv(), DELIVERY_RADIUS_KM: "0" })).toThrow(
      /DELIVERY_RADIUS_KM must be > 0/
    );
    expect(() => parseStoreConfig({ ...validEnv(), HANDLING_FEE_AMOUNT: "-5" })).toThrow(
      /HANDLING_FEE_AMOUNT must be >= 0/
    );
    expect(() => parseStoreConfig({ ...validEnv(), DELIVERY_FEE_WAIVED_AT: "-1" })).toThrow(
      /DELIVERY_FEE_WAIVED_AT/
    );
    expect(() => parseStoreConfig({ ...validEnv(), STORE_LAT: "91" })).toThrow(/STORE_LAT/);
  });

  it("has no hidden defaults: an empty env fails on all required vars", () => {
    try {
      parseStoreConfig({});
      expect.fail("should throw");
    } catch (e) {
      expect((e as ConfigError).problems).toHaveLength(6); // 6 required numbers; waivers may be empty
    }
  });
});
