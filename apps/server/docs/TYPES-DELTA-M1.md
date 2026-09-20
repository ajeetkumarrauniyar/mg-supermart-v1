# `packages/types` delta for M1 — Phase 1 note (committed in Phase 2)

Per D-007 item 4, `packages/types` is changed as **one self-contained commit on `main`** and cherry-picked to
`server` and `grocery-mobile` in Phase 2. Phase 1 only documents the exact additive delta; nothing in
`packages/types` is touched on this branch (`git diff main server -- packages/types` stays empty).

Types only — never values. Every entry below has a server counterpart in `apps/server/src/models` or
`apps/server/src/domain/types.ts`.

## New files

### `address.ts`
```ts
export interface Address {           // ← server models/Address.ts AddressResponse (minus serviceability)
  addressId: string; label: string; recipientName: string; phone: string;
  line1: string; landmark?: string; area: string; pincode?: string;
  lat: number; lng: number; accuracyM?: number; isDefault: boolean;
  createdAt: string; updatedAt: string;
}
export interface AddressInput {      // ← models/Address.ts AddressInput
  label: string; recipientName: string; phone: string; line1: string; landmark?: string;
  area: string; pincode?: string; lat: number; lng: number; accuracyM?: number;
}
export type ServiceabilityStatus = "serviceable" | "not_serviceable" | "unknown";
export type ServiceabilityReason = "OUTSIDE_RADIUS" | "NO_COORDINATES";
export interface Serviceability {    // ← domain/types.ts
  status: ServiceabilityStatus; distanceKm: number | null; radiusKm: number; reason?: ServiceabilityReason;
}
export type AddressWithServiceability = Address & { serviceability: Serviceability };
```

### `config.ts`
```ts
export interface FeeRule { amount: number; waivedAtOrAbove: number | null }   // ← domain/types.ts
export interface StoreConfigPublic {                                            // what the client may display
  deliveryRadiusKm: number; minOrderValue: number; deliveryFee: FeeRule; handlingFee: FeeRule;
}
```

### `bill.ts`
```ts
export type LineBlockerReason = "INACTIVE" | "UNAVAILABLE";
export type BlockerCode = "CART_EMPTY" | "LINE_NOT_ORDERABLE" | "ORDER_BELOW_MINIMUM" | "ADDRESS_REQUIRED" | "ADDRESS_NOT_SERVICEABLE";
export interface Blocker { code: BlockerCode; message: string; productId?: string; reason?: LineBlockerReason; shortfall?: number; distanceKm?: number | null; radiusKm?: number }
export interface BillLine { productId: string; name: string; unitPrice: number; quantity: number; lineTotal: number; minOrderExempt: boolean; isOrderable: boolean; blocker?: LineBlockerReason }
export interface AppliedConfig { minOrderValue: number; deliveryFee: FeeRule; handlingFee: FeeRule; deliveryRadiusKm: number }
export interface Bill {                                                         // ← domain/types.ts
  lines: BillLine[]; subtotal: number; eligibleAmount: number; minOrderValue: number; minOrderMet: boolean; shortfall: number;
  deliveryFee: number; handlingFee: number; total: number; orderable: boolean; blockers: Blocker[]; appliedConfig: AppliedConfig;
}
export interface Quote {                                                        // ← POST /cart/quote data
  addressId: string | null; serviceability: Serviceability; bill: Bill; orderable: boolean; blockers: Blocker[];
}
```

## Changed files (additive)

### `product.ts`
```ts
// Product / ProductResponse +
mrp?: number; isActive: boolean; isAvailable: boolean; minOrderExempt: boolean; isOrderable: boolean; // isOrderable derived, never persisted
// UpdateProductInput +
mrp?: number; isActive?: boolean; isAvailable?: boolean; minOrderExempt?: boolean;
```

### `cart.ts`
```ts
// CartItem (response line) +
isOrderable: boolean; minOrderExempt: boolean; blocker?: LineBlockerReason;
```

### `order.ts`
```ts
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
// OrderItem +
unitPrice?: number; lineTotal?: number; minOrderExempt?: boolean;
export interface AddressSnapshot { addressId: string; label: string; recipientName: string; phone: string; line1: string; landmark?: string; area: string; pincode?: string; lat: number; lng: number; accuracyM?: number; distanceKm: number | null; radiusKm: number }
// Order +
paymentStatus?: PaymentStatus; bill?: Bill; appliedConfig?: AppliedConfig; addressSnapshot?: AddressSnapshot; idempotencyKey?: string;
// CreateOrderRequest (replaces the client-built shape)
export interface CreateOrderRequest { addressId: string; paymentMethod: "COD"; idempotencyKey: string }
// Address (legacy embedded {street, city, state, zipCode}) is kept for `shippingAddress` and `user.address` (deprecated).
```

### `api.ts`
```ts
// ApiError / error envelope +
code?: "ADDRESS_NOT_SERVICEABLE" | "ADDRESS_REQUIRED" | "ADDRESS_NOT_OWNED" | "ORDER_BELOW_MINIMUM" | "LINE_NOT_ORDERABLE" | "CART_EMPTY" | "CONFIG_UNAVAILABLE" | "IDEMPOTENCY_KEY_REQUIRED" | "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND";
```

## Review checklist (Phase 2)
- [ ] no field in this delta lacks a server counterpart (checked against `src/models/*.ts`, `src/domain/types.ts`, `src/utils/errorCodes.ts`)
- [ ] no values, defaults or business numbers in `packages/types`
- [ ] one commit on `main`, cherry-picked to `server` and `grocery-mobile`; `git diff main server -- packages/types` empty afterwards
