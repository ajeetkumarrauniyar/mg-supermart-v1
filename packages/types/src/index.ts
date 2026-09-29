/**
 * Shared TypeScript types for MG Mart grocery application
 * 
 * This package provides consistent type definitions that are shared across
 * the entire monorepo including mobile app, web app, admin panel, and backend.
 * Ensures type safety and consistency in API contracts and data structures.
 * 
 * @author MG Mart Development Team
 * @version 1.0.0
 */

// User management types for authentication and profiles
export * from './user.js';

// Product catalog types for inventory and shopping
export * from './product.js';

// Order processing types for e-commerce functionality
export * from './order.js';

// Shopping cart types for cart management
export * from './cart.js';

// Delivery address and computed serviceability types
export * from './address.js';

// Store configuration contract shapes (no values)
export * from './config.js';

// Authoritative bill and quote types for checkout
export * from './bill.js';

// Common API types for request/response patterns
export * from './api.js';