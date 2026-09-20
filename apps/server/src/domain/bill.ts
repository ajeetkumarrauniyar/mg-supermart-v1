import type {
  Bill,
  BillLine,
  BillLineInput,
  Blocker,
  FeeRule,
  Serviceability,
  StoreConfig,
} from "./types.js";

/**
 * Rounding rule: money is integer rupees. Product prices are integers today;
 * should a fractional price ever appear, every aggregate is rounded to the
 * nearest rupee *once*, at the point it is produced, so `total` is always
 * exactly `subtotal + deliveryFee + handlingFee` in whole rupees.
 */
const rupees = (n: number): number => Math.round(n);

/** A fee applies iff it exists and the waiver threshold (on subtotal) is not met (D-014). */
export const feeFor = (rule: FeeRule, subtotal: number): number => {
  if (rule.amount <= 0) return 0;
  if (rule.waivedAtOrAbove !== null && subtotal >= rule.waivedAtOrAbove) return 0;
  return rupees(rule.amount);
};

/**
 * The authoritative bill (D-014 §4, D-002, D-012 §6).
 *
 * Pure: takes a StoreConfig literal and a precomputed serviceability, never
 * touches process.env or Firestore. Quote and order creation both call this;
 * order creation calls it inside the transaction.
 *
 * `serviceability === null` means "no address selected" (ADDRESS_REQUIRED).
 */
export const computeBill = (
  inputs: BillLineInput[],
  config: StoreConfig,
  serviceability: Serviceability | null
): Bill => {
  const lines: BillLine[] = inputs.map((l) => ({
    ...l,
    lineTotal: rupees(l.unitPrice * l.quantity),
  }));

  const subtotal = rupees(lines.reduce((s, l) => s + l.lineTotal, 0));
  const eligibleAmount = rupees(
    lines.filter((l) => !l.minOrderExempt).reduce((s, l) => s + l.lineTotal, 0)
  );

  const minOrderValue = config.minOrderValue;
  const minOrderMet = eligibleAmount >= minOrderValue;
  const shortfall = minOrderMet ? 0 : rupees(minOrderValue - eligibleAmount);

  const deliveryFee = feeFor(config.deliveryFee, subtotal);
  const handlingFee = feeFor(config.handlingFee, subtotal);
  const total = subtotal + deliveryFee + handlingFee;

  const blockers: Blocker[] = [];

  if (lines.length === 0) {
    blockers.push({ code: "CART_EMPTY", message: "Your cart is empty" });
  }

  for (const l of lines) {
    if (!l.isOrderable) {
      const reason = l.blocker ?? "UNAVAILABLE";
      blockers.push({
        code: "LINE_NOT_ORDERABLE",
        message:
          reason === "INACTIVE"
            ? `${l.name} is no longer listed`
            : `${l.name} is not available right now`,
        productId: l.productId,
        reason,
      });
    }
  }

  if (lines.length > 0 && !minOrderMet) {
    blockers.push({
      code: "ORDER_BELOW_MINIMUM",
      message: `Add ₹${shortfall} more of eligible items to reach the ₹${minOrderValue} minimum`,
      shortfall,
    });
  }

  if (serviceability === null) {
    blockers.push({ code: "ADDRESS_REQUIRED", message: "Choose a delivery address" });
  } else if (serviceability.status !== "serviceable") {
    blockers.push({
      code: "ADDRESS_NOT_SERVICEABLE",
      message:
        serviceability.reason === "NO_COORDINATES"
          ? "This address has no location; add it from the map or your current location"
          : `This address is ${serviceability.distanceKm} km away; we deliver within ${serviceability.radiusKm} km`,
      distanceKm: serviceability.distanceKm,
      radiusKm: serviceability.radiusKm,
    });
  }

  return {
    lines,
    subtotal,
    eligibleAmount,
    minOrderValue,
    minOrderMet,
    shortfall,
    deliveryFee,
    handlingFee,
    total,
    orderable: blockers.length === 0,
    blockers,
    appliedConfig: {
      minOrderValue,
      deliveryFee: { ...config.deliveryFee },
      handlingFee: { ...config.handlingFee },
      deliveryRadiusKm: config.deliveryRadiusKm,
    },
  };
};
