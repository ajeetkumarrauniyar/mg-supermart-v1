import { describe, it, expect } from "vitest";
import { toLegacyShippingAddress } from "./legacyShippingAddress.js";
import { parseLegacyCompat } from "../config/legacyCompat.js";

describe("toLegacyShippingAddress", () => {
  const compat = parseLegacyCompat({ LEGACY_SHIPPING_STATE: "StateFromEnv" });

  it("maps line1+landmark → street, area → city, pincode → zipCode, compat → state", () => {
    expect(
      toLegacyShippingAddress(
        { line1: "Ward 4", landmark: "Near temple", area: "Pipra Bazar", pincode: "845416" },
        compat
      )
    ).toEqual({ street: "Ward 4, Near temple", city: "Pipra Bazar", state: "StateFromEnv", zipCode: "845416" });
  });

  it("omits an absent landmark and pincode", () => {
    expect(toLegacyShippingAddress({ line1: "Ward 4", area: "Pipra" }, compat)).toEqual({
      street: "Ward 4",
      city: "Pipra",
      state: "StateFromEnv",
      zipCode: "",
    });
  });

  it("prefers a state carried by the address when present", () => {
    expect(
      toLegacyShippingAddress({ line1: "x", area: "y", state: "FromAddress" }, compat).state
    ).toBe("FromAddress");
  });

  it("empty/absent LEGACY_SHIPPING_STATE ⇒ empty state", () => {
    expect(toLegacyShippingAddress({ line1: "x", area: "y" }, parseLegacyCompat({})).state).toBe("");
    expect(
      toLegacyShippingAddress({ line1: "x", area: "y" }, parseLegacyCompat({ LEGACY_SHIPPING_STATE: "  " })).state
    ).toBe("");
  });
});
