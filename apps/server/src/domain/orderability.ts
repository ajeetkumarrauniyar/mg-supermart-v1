import type { LineBlockerReason, ProductFlags } from "./types.js";

/**
 * Normalises the admin-owned flags on a product document (D-013).
 * Missing fields on existing documents are backward compatible:
 * isActive → true, isAvailable → true, minOrderExempt → false.
 * Only an explicit `false` hides or disables a product.
 */
export const normalizeProductFlags = (
  doc: Partial<Record<keyof ProductFlags, unknown>> | null | undefined
): ProductFlags => ({
  isActive: doc?.isActive !== false,
  isAvailable: doc?.isAvailable !== false,
  minOrderExempt: doc?.minOrderExempt === true,
});

/**
 * Derived verdict — returned in every response, NEVER persisted (D-013).
 * M1: isActive && isAvailable. Stock is not consulted until Phase 6.
 */
export const deriveOrderable = (flags: ProductFlags): boolean =>
  flags.isActive && flags.isAvailable;

/** Why a line cannot be ordered, or null when it can. */
export const lineBlocker = (flags: ProductFlags): LineBlockerReason | null => {
  if (!flags.isActive) return "INACTIVE";
  if (!flags.isAvailable) return "UNAVAILABLE";
  return null;
};
