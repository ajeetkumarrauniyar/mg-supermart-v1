/**
 * Shared product types for MG Mart grocery application
 * 
 * This module defines client-side product types used across all frontend applications
 * for product catalog display, search, filtering, and management. These types represent
 * the product data structure as received from API responses.
 * 
 * @author MG Mart Development Team
 * @version 1.0.0
 */

/**
 * Product category enumeration for organizing the grocery catalog
 * Used for navigation, filtering, and product organization in client apps
 */
export type ProductCategory =
    | 'Fruits & Vegetables'    // Fresh produce section
    | 'Dairy & Eggs'          // Dairy products and eggs
    | 'Bakery'                // Fresh baked goods
    | 'Meat & Seafood'        // Fresh and frozen proteins
    | 'Pantry'                // Shelf-stable goods and staples
    | 'Beverages'             // Drinks and liquid refreshments
    | 'Snacks'                // Packaged snack foods
    | 'Frozen'                // Frozen food products
    | 'Personal Care'         // Health and beauty products
    | 'Household';            // Cleaning and household supplies

/**
 * Product unit enumeration for different measurement types
 * Used for displaying product quantities and pricing information
 */
export type ProductUnit = 'kg' | 'liter' | 'piece' | 'gram' | 'ml' | 'dozen' | 'pack';

/**
 * Product data structure as received from API responses
 * Contains all product information for display in client applications
 */
export interface Product {
    /** Unique identifier for the product */
    productId: string;
    /** Product display name */
    name: string;
    /** Detailed product description */
    description: string;
    /** Product price in the base currency */
    price: number;
    /** Product category for organization */
    category: ProductCategory;
    /** URL to the product image */
    imageUrl: string;
    /** Current stock quantity available */
    stock: number;
    /** Unit of measurement for the product */
    unit: ProductUnit;
    /** Whether the product is featured on homepage */
    isFeatured: boolean;
    /** Maximum retail price, when the catalogue provides one */
    mrp?: number;
    /** Whether the product is listed in the customer catalogue at all */
    isActive: boolean;
    /** Whether the shop can supply the product right now */
    isAvailable: boolean;
    /** Whether the product is excluded from the minimum-order calculation */
    minOrderExempt: boolean;
    /**
     * Server's verdict that the product may be put in an order.
     * Derived from isActive and isAvailable and never stored; `stock` is
     * informational and must not be used to decide orderability.
     */
    isOrderable: boolean;
    /** Product creation timestamp as ISO string */
    createdAt: string;
    /** Last update timestamp as ISO string */
    updatedAt: string;
}

/**
 * Request payload for creating new products (admin only)
 * Contains all required information for adding products to catalog
 */
export interface CreateProductRequest {
    /** Product display name */
    name: string;
    /** Detailed product description */
    description: string;
    /** Product price in base currency */
    price: number;
    /** Product category */
    category: ProductCategory;
    /** URL to product image */
    imageUrl: string;
    /** Initial stock quantity */
    stock: number;
    /** Unit of measurement */
    unit: ProductUnit;
    /** Optional featured status (defaults to false) */
    isFeatured?: boolean;
}

/**
 * Request payload for updating existing products (admin only)
 * All fields are optional to support partial updates
 */
export interface UpdateProductRequest {
    /** Updated product name */
    name?: string;
    /** Updated product description */
    description?: string;
    /** Updated product price */
    price?: number;
    /** Updated product category */
    category?: ProductCategory;
    /** Updated product image URL */
    imageUrl?: string;
    /** Updated stock quantity */
    stock?: number;
    /** Updated unit of measurement */
    unit?: ProductUnit;
    /** Updated featured status */
    isFeatured?: boolean;
}

/**
 * Filter parameters for product search and listing
 * Used in product catalog pages and search functionality
 */
export interface ProductFilters {
    /** Filter by specific category */
    category?: ProductCategory;
    /** Filter by featured status */
    isFeatured?: boolean;
    /** Minimum price filter */
    minPrice?: number;
    /** Maximum price filter */
    maxPrice?: number;
    /** Filter to show only in-stock products */
    inStock?: boolean;
    /** Text search query for product names */
    search?: string;
}