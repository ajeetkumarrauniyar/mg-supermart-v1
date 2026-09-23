/**
 * Compatibility values for legacy response shapes.
 *
 * The admin panel renders order.shippingAddress as
 * `${street}, ${city}, ${state} ${zipCode}`. The address model intentionally
 * collects no state, so the value comes from this explicit env var. It is a
 * display compatibility value, not a business rule, and deliberately lives
 * outside StoreConfig. Empty/absent ⇒ "" (blank segment; nothing breaks).
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
