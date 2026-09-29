/**
 * Shared cart types for MG Mart grocery application
 * 
 * This module defines client-side cart types used across all frontend applications
 * for shopping cart management, display, and operations. These types represent
 * the cart data structure as received from API responses.
 * 
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import type { LineBlockerReason } from './bill.js';

/**
 * Cart item data structure as received from API responses
 * Contains product information and cart-specific metadata
 */
export interface CartItem {
    /** Reference to the product ID */
    productId: string;
    /** Product display name */
    name: string;
    /** Current product price */
    price: number;
    /** URL to the product image */
    imageUrl: string;
    /** Product unit of measurement */
    unit: string;
    /** Quantity of the product in cart */
    quantity: number;
    /** Timestamp when item was added as ISO string */
    addedAt: string;
    /** Server's verdict that this line may be ordered */
    isOrderable: boolean;
    /** Whether this line counts toward the minimum order value */
    minOrderExempt: boolean;
    /**
     * Why the line cannot be ordered. Present only when isOrderable is false;
     * such lines are kept in the cart and flagged, never silently removed.
     */
    blocker?: LineBlockerReason;
}

/**
 * Complete cart data structure as received from API responses
 * Contains all cart items with calculated totals for display
 */
export interface Cart {
    /** Array of cart items with product details */
    items: CartItem[];
    /** Total number of items in cart (sum of all quantities) */
    totalItems: number;
    /** Total monetary amount for all items in cart */
    totalAmount: number;
}

/**
 * Request payload for adding items to cart
 * Contains the minimum required information for cart operations
 */
export interface AddToCartRequest {
    /** ID of the product to add */
    productId: string;
    /** Quantity to add to cart */
    quantity: number;
}

/**
 * Request payload for updating cart item quantities
 * Used for modifying existing cart items (0 quantity removes item)
 */
export interface UpdateCartItemRequest {
    /** New quantity for the cart item */
    quantity: number;
}