/**
 * Shared order types for MG Mart grocery application
 * 
 * This module defines client-side order types used across all frontend applications
 * for order placement, tracking, and management. These types represent the order
 * data structure as received from API responses.
 * 
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Address } from './user.js';
import type { Bill } from './bill.js';

/**
 * Order status enumeration for tracking order lifecycle
 * Used for displaying order progress and status updates to users
 */
export type OrderStatus =
    | 'pending'      // Order placed, awaiting processing
    | 'processing'   // Order being prepared/packed
    | 'shipped'      // Order dispatched for delivery
    | 'delivered'    // Order successfully delivered
    | 'cancelled';   // Order cancelled by customer or admin

/**
 * Payment method enumeration for supported payment options
 * Used in checkout flow and order display
 */
export type PaymentMethod =
    | 'COD'          // Cash on Delivery
    | 'Online';      // Online payment (credit card, digital wallet, etc.)

/**
 * Payment progress, stored from the start so that adding a non-cash method
 * later does not reshape orders.
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Individual item within an order
 * Contains product information snapshot at the time of order placement
 */
export interface OrderItem {
    /** Reference to the product ID */
    productId: string;
    /** Product name (snapshot at time of order) */
    name: string;
    /** Product price (snapshot at time of order) */
    price: number;
    /** Quantity ordered */
    quantity: number;
    /** Unit price snapshot; mirrors price on orders that carry a bill */
    unitPrice?: number;
    /** unitPrice x quantity at order time */
    lineTotal?: number;
    /** Whether the line was excluded from the minimum-order calculation */
    minOrderExempt?: boolean;
}

/**
 * The delivery address exactly as it stood when the order was placed, together
 * with the distance facts behind the decision to accept it. Immune to later
 * edits of the saved address.
 */
export interface AddressSnapshot {
    addressId: string;
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
    /** Straight-line distance from the store at order time. */
    distanceKm: number | null;
    /** The delivery radius that distance was accepted against. */
    radiusKm: number;
}

/**
 * Payment details for the order
 * Contains payment method and transaction information
 */
export interface PaymentDetails {
    /** Method used for payment */
    paymentMethod: PaymentMethod;
    /** Transaction ID for online payments (optional for COD) */
    transactionId?: string;
}

/**
 * Order data structure as received from API responses
 * Contains complete order information for display in client applications
 */
export interface Order {
    /** Unique identifier for the order */
    orderId: string;
    /** ID of the user who placed the order */
    userId: string;
    /** Array of items in the order */
    items: OrderItem[];
    /** Total amount for the order */
    totalAmount: number;
    /** Current status of the order */
    status: OrderStatus;
    /**
     * Legacy flattened address, derived at order time for existing consumers.
     * `addressSnapshot` is the authoritative record.
     */
    shippingAddress: Address;
    /** Payment information for the order */
    paymentDetails: PaymentDetails;
    /** Payment progress. Absent on orders placed before it was recorded. */
    paymentStatus?: PaymentStatus;
    /**
     * The authoritative bill as shown to the customer before they confirmed.
     * Absent on orders placed before bills were stored.
     */
    bill?: Bill;
    /** The address as it stood at order time. Absent on older orders. */
    addressSnapshot?: AddressSnapshot;
    /** The key that made order creation safe to retry. */
    idempotencyKey?: string;
    /** Order creation timestamp as ISO string */
    createdAt: string;
    /** Last update timestamp as ISO string */
    updatedAt: string;
}

/**
 * Request payload for creating an order.
 *
 * The client sends only a reference to a saved address, the payment method and
 * a key that makes the call safe to retry. Items, prices, fees, eligibility and
 * serviceability are all read and revalidated server-side from stored data, so
 * they are deliberately absent here.
 */
export interface CreateOrderRequest {
    /** Which saved address to deliver to. */
    addressId: string;
    /** Cash on delivery is the only method currently accepted. */
    paymentMethod: 'COD';
    /**
     * Client-generated key identifying one logical submission. Retrying with
     * the same key returns the original order instead of creating another.
     */
    idempotencyKey: string;
}

/**
 * Request payload for updating existing orders (admin only)
 * Typically used for status updates and payment confirmation
 */
export interface UpdateOrderRequest {
    /** Updated order status */
    status?: OrderStatus;
    /** Updated payment details (for payment confirmation) */
    paymentDetails?: PaymentDetails;
}

/**
 * Filter parameters for order listing and search
 * Used in order history and admin order management pages
 */
export interface OrderFilters {
    /** Filter by order status */
    status?: OrderStatus;
    /** Filter by user ID (admin only) */
    userId?: string;
    /** Filter by start date (ISO string) */
    startDate?: string;
    /** Filter by end date (ISO string) */
    endDate?: string;
}