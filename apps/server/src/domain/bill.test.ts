import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeBill, feeFor } from "./bill.js";
import { baseConfig } from "../test/fixtures.js";
import type { BillLineInput, Serviceability } from "./types.js";

const ok: Serviceability = { status: "serviceable", distanceKm: 1.2, radiusKm: 5 };
const far: Serviceability = { status: "not_serviceable", distanceKm: 7.3, radiusKm: 5, reason: "OUTSIDE_RADIUS" };
const unknown: Serviceability = { status: "unknown", distanceKm: null, radiusKm: 5, reason: "NO_COORDINATES" };

const line = (o: Partial<BillLineInput> & { unitPrice: number; quantity: number }): BillLineInput => ({
  productId: o.productId ?? "P",
  name: o.name ?? "Product",
  minOrderExempt: o.minOrderExempt ?? false,
  isOrderable: o.isOrderable ?? true,
  ...(o.blocker !== undefined && { blocker: o.blocker }),
  unitPrice: o.unitPrice,
  quantity: o.quantity,
});

describe("computeBill (D-014 §4, D-002)", () => {
  it("happy path: eligible ≥ 500, fees apply, total = subtotal + fees", () => {
    const b = computeBill(
      [line({ productId: "RICE", unitPrice: 320, quantity: 2 })],
      baseConfig(),
      ok
    );
    expect(b.subtotal).toBe(640);
    expect(b.eligibleAmount).toBe(640);
    expect(b.minOrderMet).toBe(true);
    expect(b.shortfall).toBe(0);
    expect(b.deliveryFee).toBe(40);
    expect(b.handlingFee).toBe(5);
    expect(b.total).toBe(685);
    expect(b.orderable).toBe(true);
    expect(b.blockers).toEqual([]);
    expect(b.appliedConfig).toEqual({
      minOrderValue: 500,
      deliveryFee: { amount: 40, waivedAtOrAbove: null },
      handlingFee: { amount: 5, waivedAtOrAbove: null },
      deliveryRadiusKm: 5,
    });
  });

  it("exempt-only cart: subtotal > 500 but eligible < 500 ⇒ ORDER_BELOW_MINIMUM", () => {
    const b = computeBill(
      [
        line({ productId: "OIL", unitPrice: 180, quantity: 3, minOrderExempt: true }),
        line({ productId: "SUGAR", unitPrice: 45, quantity: 2, minOrderExempt: true }),
      ],
      baseConfig(),
      ok
    );
    expect(b.subtotal).toBe(630);
    expect(b.eligibleAmount).toBe(0);
    expect(b.minOrderMet).toBe(false);
    expect(b.shortfall).toBe(500);
    expect(b.orderable).toBe(false);
    expect(b.blockers.map((x) => x.code)).toEqual(["ORDER_BELOW_MINIMUM"]);
    expect(b.blockers[0]?.shortfall).toBe(500);
  });

  it("₹499 / ₹500 / ₹501 eligible boundary", () => {
    for (const [amt, met] of [[499, false], [500, true], [501, true]] as const) {
      const b = computeBill([line({ unitPrice: amt, quantity: 1 })], baseConfig(), ok);
      expect(b.minOrderMet).toBe(met);
      expect(b.shortfall).toBe(met ? 0 : 1);
    }
  });

  it("fee waiver honoured on subtotal (including exempt lines), amount:0 ⇒ no fee", () => {
    const cfg = baseConfig({
      deliveryFee: { amount: 40, waivedAtOrAbove: 700 },
      handlingFee: { amount: 0, waivedAtOrAbove: null },
    });
    const below = computeBill([line({ unitPrice: 600, quantity: 1 })], cfg, ok);
    expect(below.deliveryFee).toBe(40);
    expect(below.handlingFee).toBe(0);

    const above = computeBill(
      [line({ unitPrice: 600, quantity: 1 }), line({ productId: "OIL", unitPrice: 150, quantity: 1, minOrderExempt: true })],
      cfg,
      ok
    );
    expect(above.subtotal).toBe(750);
    expect(above.deliveryFee).toBe(0);
    expect(above.total).toBe(750);
    expect(feeFor({ amount: 40, waivedAtOrAbove: 750 }, 750)).toBe(0);
    expect(feeFor({ amount: 40, waivedAtOrAbove: 751 }, 750)).toBe(40);
  });

  it("non-orderable lines block with their reason but still count in the bill", () => {
    const b = computeBill(
      [
        line({ productId: "A", unitPrice: 300, quantity: 2 }),
        line({ productId: "B", name: "Ghee", unitPrice: 200, quantity: 1, isOrderable: false, blocker: "INACTIVE" }),
        line({ productId: "C", name: "Paneer", unitPrice: 100, quantity: 1, isOrderable: false, blocker: "UNAVAILABLE" }),
      ],
      baseConfig(),
      ok
    );
    expect(b.subtotal).toBe(900);
    expect(b.orderable).toBe(false);
    expect(b.blockers).toEqual([
      expect.objectContaining({ code: "LINE_NOT_ORDERABLE", productId: "B", reason: "INACTIVE" }),
      expect.objectContaining({ code: "LINE_NOT_ORDERABLE", productId: "C", reason: "UNAVAILABLE" }),
    ]);
  });

  it("address states: null ⇒ ADDRESS_REQUIRED; unknown/not_serviceable ⇒ ADDRESS_NOT_SERVICEABLE with distance", () => {
    const lines = [line({ unitPrice: 600, quantity: 1 })];
    expect(computeBill(lines, baseConfig(), null).blockers.map((x) => x.code)).toEqual(["ADDRESS_REQUIRED"]);
    const f = computeBill(lines, baseConfig(), far);
    expect(f.blockers).toEqual([
      expect.objectContaining({ code: "ADDRESS_NOT_SERVICEABLE", distanceKm: 7.3, radiusKm: 5 }),
    ]);
    expect(f.total).toBe(645); // bill is still computed
    const u = computeBill(lines, baseConfig(), unknown);
    expect(u.blockers[0]?.code).toBe("ADDRESS_NOT_SERVICEABLE");
    expect(u.blockers[0]?.distanceKm).toBeNull();
  });

  it("empty cart ⇒ CART_EMPTY (and no minimum-order noise)", () => {
    const b = computeBill([], baseConfig(), ok);
    expect(b.blockers.map((x) => x.code)).toEqual(["CART_EMPTY"]);
    expect(b.total).toBe(45); // fees still shown; client renders CART_EMPTY
  });

  it("property: total === subtotal + deliveryFee + handlingFee and blockers ⇔ !orderable", () => {
    const lineArb = fc.record({
      productId: fc.string({ minLength: 1, maxLength: 6 }),
      name: fc.constant("P"),
      unitPrice: fc.integer({ min: 1, max: 2000 }),
      quantity: fc.integer({ min: 1, max: 20 }),
      minOrderExempt: fc.boolean(),
      isOrderable: fc.boolean(),
    });
    const feeArb = fc.record({
      amount: fc.integer({ min: 0, max: 100 }),
      waivedAtOrAbove: fc.option(fc.integer({ min: 0, max: 5000 }), { nil: null }),
    });
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 8 }),
        feeArb,
        feeArb,
        fc.constantFrom(ok, far, unknown, null),
        (lines, d, h, sv) => {
          const b = computeBill(lines, baseConfig({ deliveryFee: d, handlingFee: h }), sv);
          expect(b.total).toBe(b.subtotal + b.deliveryFee + b.handlingFee);
          expect(b.orderable).toBe(b.blockers.length === 0);
          expect(b.eligibleAmount).toBeLessThanOrEqual(b.subtotal);
          expect(b.minOrderMet).toBe(b.eligibleAmount >= 500);
          expect(Number.isInteger(b.total)).toBe(true);
        }
      )
    );
  });
});
