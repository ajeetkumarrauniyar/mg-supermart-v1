/**
 * Shared configuration contract types for MG Mart grocery application
 *
 * These describe the *shape* of the store configuration the server applies
 * when pricing a cart. They carry no values: fees, thresholds, the delivery
 * radius and the minimum order value are server configuration and reach the
 * client only inside a bill.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

/**
 * A flat fee that may be waived once the cart subtotal reaches a threshold.
 *
 * `amount: 0` means the fee does not exist.
 * `waivedAtOrAbove: null` means the fee always applies.
 */
export interface FeeRule {
    /** Fee in rupees. */
    amount: number;
    /** Subtotal at or above which the fee is waived; null when never waived. */
    waivedAtOrAbove: number | null;
}
