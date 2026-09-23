import type { LegacyCompat } from "../config/legacyCompat.js";

/** The legacy {street, city, state, zipCode} shape the admin panel reads. */
export interface LegacyShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

/** The structured-address fields the mapper needs. */
export interface StructuredAddressLike {
  line1: string;
  landmark?: string | undefined;
  area: string;
  pincode?: string | undefined;
  /** Not collected today; honoured if the address model is ever extended. */
  state?: string | undefined;
}

/**
 * Pure mapper from the structured address to the legacy shippingAddress shape
 * the admin panel renders. Mapping:
 *
 *   street  ← [line1, landmark].filter(Boolean).join(", ")
 *   city    ← area
 *   state   ← address.state if the stored address carries it, else compat.shippingState
 *   zipCode ← pincode ?? ""
 *
 * No literals live here; the compat value comes from LEGACY_SHIPPING_STATE.
 * shippingAddress is derived at order time and never read back by the server;
 * addressSnapshot is the authoritative record.
 */
export const toLegacyShippingAddress = (
  address: StructuredAddressLike,
  compat: LegacyCompat
): LegacyShippingAddress => ({
  street: [address.line1, address.landmark].filter((s) => Boolean(s && s.trim())).join(", "),
  city: address.area,
  state: address.state && address.state.trim() !== "" ? address.state : compat.shippingState,
  zipCode: address.pincode ?? "",
});
