/**
 * Shared address and serviceability types for MG Mart grocery application
 *
 * A customer delivery address is an owned entity: it is keyed to the user,
 * carries the coordinates the delivery depends on, and is referenced by id at
 * checkout. Whether the shop can deliver to it is NOT part of the address —
 * it is recomputed by the server on every read against the current store
 * configuration and returned alongside the address.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

/** Whether the shop delivers to a point right now. */
export type ServiceabilityStatus =
    | 'serviceable'      // inside the current delivery radius
    | 'not_serviceable'  // outside it
    | 'unknown';         // no usable coordinates, so undecidable

/** Why an address is not serviceable. Absent when it is. */
export type ServiceabilityReason =
    | 'OUTSIDE_RADIUS'   // coordinates are beyond the configured radius
    | 'NO_COORDINATES';  // the address has no usable coordinates

/**
 * Computed delivery verdict for a point. Never stored on the address, because
 * the radius is configuration and can change after an address is saved.
 */
export interface Serviceability {
    /** Verdict for this address against the configuration in force now. */
    status: ServiceabilityStatus;
    /** Straight-line distance from the store in km; null when undecidable. */
    distanceKm: number | null;
    /** The radius the verdict was measured against, for display. */
    radiusKm: number;
    /** Present only when status is not 'serviceable'. */
    reason?: ServiceabilityReason;
}

/**
 * A saved customer delivery address.
 *
 * Named `CustomerAddress` to leave the legacy embedded `Address`
 * (street/city/state/zipCode) in place for order history compatibility.
 * Deliberately has no city/state and no stored serviceability flag.
 */
export interface CustomerAddress {
    /** Unique identifier, used as the checkout reference. */
    addressId: string;
    /** Short customer-chosen name, e.g. "Home". */
    label: string;
    /** Who should receive the delivery. */
    recipientName: string;
    /** Contact number for the delivery. */
    phone: string;
    /** Street/house line, landmark-first in practice. */
    line1: string;
    /** Optional nearby landmark. */
    landmark?: string;
    /** Locality or neighbourhood. */
    area: string;
    /** Optional postal code; never used to decide delivery. */
    pincode?: string;
    /** Latitude; required, since delivery depends on it. */
    lat: number;
    /** Longitude; required, since delivery depends on it. */
    lng: number;
    /** Accuracy in metres of the captured coordinates, when known. */
    accuracyM?: number;
    /** Whether this address is pre-selected at checkout. */
    isDefault: boolean;
    /** Creation timestamp as ISO string. */
    createdAt: string;
    /** Last update timestamp as ISO string. */
    updatedAt: string;
}

/**
 * Request payload for creating or replacing an address.
 * Coordinates are required; a well-formed address is accepted even when it is
 * currently outside the delivery radius.
 */
export interface AddressInput {
    label: string;
    recipientName: string;
    phone: string;
    line1: string;
    landmark?: string;
    area: string;
    pincode?: string;
    lat: number;
    lng: number;
    accuracyM?: number;
}

/**
 * What address endpoints actually return: the stored address plus the freshly
 * computed verdict. Clients should treat this as the address shape they see.
 */
export interface AddressWithServiceability extends CustomerAddress {
    serviceability: Serviceability;
}
