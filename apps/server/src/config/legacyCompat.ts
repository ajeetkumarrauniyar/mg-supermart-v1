/**
 * Compatibility values for legacy response shapes (Phase 1 T5.2).
 *
 * The admin panel on `main` renders order.shippingAddress as
 * `${street}, ${city}, ${state} ${zipCode}`. The M1 address model (D-012)
 * intentionally collects no state, so the value comes from this explicit
 * env var. It is NOT a business rule and is NOT part of StoreConfig (D-014's
 * typed shape is unchanged). Empty/absent ⇒ "" (blank segment; nothing breaks).
 */
export interface LegacyCompat {
  /** Written to order.shippingAddress.state for the admin panel. */
  shippingState: string;
}

export const parseLegacyCompat = (env: Record<string, string | undefined>): LegacyCompat => ({
  shippingState: (env.LEGACY_SHIPPING_STATE ?? "").trim(),
});

let cached: LegacyCompat | null = null;

export const getLegacyCompat = (): LegacyCompat => {
  if (!cached) {
    cached = parseLegacyCompat(process.env);
  }
  return cached;
};

/** Test hook. */
export const resetLegacyCompatCache = (): void => {
  cached = null;
};
