/**
 * Shared bill and quote types for MG Mart grocery application
 *
 * The bill is the server's authoritative answer to "what will this cost and
 * may it be ordered". Clients render it; they never recompute any part of it.
 * The same structure is returned by the quote endpoint and stored on the order,
 * so what the customer saw is what the shop received.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import type { FeeRule } from './config.js';
import type { Serviceability } from './address.js';

/** Why an individual line cannot be ordered. */
export type LineBlockerReason =
    | 'INACTIVE'      // the product is no longer listed
    | 'UNAVAILABLE';  // listed, but the shop cannot supply it right now

/** Why a cart as a whole cannot be ordered. */
export type BlockerCode =
    | 'CART_EMPTY'
    | 'LINE_NOT_ORDERABLE'
    | 'ORDER_BELOW_MINIMUM'
    | 'ADDRESS_REQUIRED'
    | 'ADDRESS_NOT_SERVICEABLE';

/**
 * One reason a cart cannot be ordered, with the detail needed to explain it.
 * Which optional fields are populated depends on `code`.
 */
export interface Blocker {
    code: BlockerCode;
    /** Server-provided explanation, safe to show to the customer. */
    message: string;
    /** On LINE_NOT_ORDERABLE: which product. */
    productId?: string;
    /** On LINE_NOT_ORDERABLE: why that line is blocked. */
    reason?: LineBlockerReason;
    /** On ORDER_BELOW_MINIMUM: eligible rupees still needed. */
    shortfall?: number;
    /** On ADDRESS_NOT_SERVICEABLE: measured distance, or null. */
    distanceKm?: number | null;
    /** On ADDRESS_NOT_SERVICEABLE: the radius it was measured against. */
    radiusKm?: number;
}

/** One priced line of a bill, with the facts behind its treatment. */
export interface BillLine {
    productId: string;
    name: string;
    /** Server price per unit at the time the bill was computed. */
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    /** Whether this line is excluded from the minimum-order calculation. */
    minOrderExempt: boolean;
    isOrderable: boolean;
    /** Present only when the line is not orderable. */
    blocker?: LineBlockerReason;
}

/**
 * The configuration values in force when a bill was computed. Persisted with
 * the order so a historical bill stays explainable after configuration changes.
 */
export interface AppliedConfig {
    minOrderValue: number;
    deliveryFee: FeeRule;
    handlingFee: FeeRule;
    deliveryRadiusKm: number;
}

/** The authoritative cost of a cart, and whether it may be ordered. */
export interface Bill {
    lines: BillLine[];
    /** Total of every line. */
    subtotal: number;
    /** Total of non-exempt lines; the figure compared against minOrderValue. */
    eligibleAmount: number;
    minOrderValue: number;
    minOrderMet: boolean;
    /** Eligible rupees still needed; 0 when the minimum is met. */
    shortfall: number;
    deliveryFee: number;
    handlingFee: number;
    /** subtotal + deliveryFee + handlingFee. */
    total: number;
    /** True only when blockers is empty. */
    orderable: boolean;
    blockers: Blocker[];
    appliedConfig: AppliedConfig;
}

/**
 * Response of the quote endpoint: the bill for a cart against an address.
 * A quote is always a report — blockers live inside it rather than being
 * signalled as request failures.
 */
export interface Quote {
    /** The address the quote was computed for; null when none was available. */
    addressId: string | null;
    serviceability: Serviceability;
    bill: Bill;
    /** Mirrors bill.orderable. */
    orderable: boolean;
    /** Mirrors bill.blockers. */
    blockers: Blocker[];
}
