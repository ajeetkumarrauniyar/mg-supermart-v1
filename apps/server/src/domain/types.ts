/**
 * Pure domain types for checkout (D-012, D-013, D-014).
 *
 * Nothing in src/domain imports Firebase or reads process.env; every function
 * takes plain data and returns plain data so it is unit-testable without the
 * emulator (PD-6).
 */

/** A flat fee, optionally waived once `subtotal` reaches a threshold (D-014). */
export interface FeeRule {
  /** 0 ⇒ the fee does not exist. */
  amount: number;
  /** null ⇒ the fee always applies; a number ⇒ waived when subtotal >= it. */
  waivedAtOrAbove: number | null;
}

/** Typed business configuration — the single interface for rules (D-014 §1). */
export interface StoreConfig {
  store: { lat: number; lng: number }; // D-011
  deliveryRadiusKm: number; // D-011 / D-012
  minOrderValue: number; // Founder Brief §9
  deliveryFee: FeeRule;
  handlingFee: FeeRule;
  source: "env";
  loadedAt: string;
}

export type ServiceabilityStatus = "serviceable" | "not_serviceable" | "unknown";
export type ServiceabilityReason = "OUTSIDE_RADIUS" | "NO_COORDINATES";

/** Computed, never persisted (D-012 §1). */
export interface Serviceability {
  status: ServiceabilityStatus;
  /** Straight-line distance in km, 2 dp; null when coordinates are missing. */
  distanceKm: number | null;
  radiusKm: number;
  reason?: ServiceabilityReason;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Admin-owned persisted product facts (D-013). */
export interface ProductFlags {
  isActive: boolean;
  isAvailable: boolean;
  minOrderExempt: boolean;
}

export type LineBlockerReason = "INACTIVE" | "UNAVAILABLE";

export type BlockerCode =
  | "CART_EMPTY"
  | "LINE_NOT_ORDERABLE"
  | "ORDER_BELOW_MINIMUM"
  | "ADDRESS_REQUIRED"
  | "ADDRESS_NOT_SERVICEABLE";

export interface Blocker {
  code: BlockerCode;
  message: string;
  /** Present on LINE_NOT_ORDERABLE. */
  productId?: string;
  reason?: LineBlockerReason;
  /** Present on ORDER_BELOW_MINIMUM. */
  shortfall?: number;
  /** Present on ADDRESS_NOT_SERVICEABLE. */
  distanceKm?: number | null;
  radiusKm?: number;
}

/** Input line for computeBill — what the cart + product read produced. */
export interface BillLineInput {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  minOrderExempt: boolean;
  isOrderable: boolean;
  blocker?: LineBlockerReason;
}

export interface BillLine extends BillLineInput {
  lineTotal: number;
}

export interface AppliedConfig {
  minOrderValue: number;
  deliveryFee: FeeRule;
  handlingFee: FeeRule;
  deliveryRadiusKm: number;
}

/** The authoritative bill (D-014 §4). Same object for quote and order. */
export interface Bill {
  lines: BillLine[];
  subtotal: number;
  eligibleAmount: number;
  minOrderValue: number;
  minOrderMet: boolean;
  shortfall: number;
  deliveryFee: number;
  handlingFee: number;
  total: number;
  orderable: boolean;
  blockers: Blocker[];
  appliedConfig: AppliedConfig;
}
