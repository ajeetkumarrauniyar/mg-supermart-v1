/**
 * Machine-readable API error codes (D-012 §9).
 *
 * Additive: `ApiError.code` is optional, and responses without a code are
 * unchanged. Clients use these to distinguish e.g. "not serviceable" from
 * other 4xx responses without parsing messages.
 */
export const ERROR_CODES = [
  "ADDRESS_NOT_SERVICEABLE",
  "ADDRESS_REQUIRED",
  "ADDRESS_NOT_OWNED",
  "ORDER_BELOW_MINIMUM",
  "LINE_NOT_ORDERABLE",
  "CART_EMPTY",
  "CONFIG_UNAVAILABLE",
  "IDEMPOTENCY_KEY_REQUIRED",
  "VALIDATION_ERROR",
  "FORBIDDEN",
  "NOT_FOUND",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
