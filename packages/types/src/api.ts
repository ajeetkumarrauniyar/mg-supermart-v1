/**
 * Shared API types for MG Mart grocery application
 *
 * This module defines common API response patterns, error handling types,
 * and pagination structures used consistently across all API endpoints.
 * Ensures standardized communication between frontend and backend.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import type { Blocker, LineBlockerReason } from './bill.js';
import type { Serviceability } from './address.js';

/**
 * Standardized API response wrapper for all endpoints
 * Provides consistent response structure across the entire application
 *
 * @template T - Type of the response data
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * API error structure for detailed error information
 *
 * @deprecated Does not match the wire format; `ApiErrorEnvelope` does. Kept
 * because existing callers still reference it.
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * Machine-readable error codes the API may return.
 *
 * This is the full set the server can emit, not only the subset a particular
 * client triggers, so that narrowing on `code` stays exhaustive. Errors that
 * predate these codes, and unexpected internal failures, carry no code at all.
 */
export type ErrorCode =
  | 'ADDRESS_NOT_SERVICEABLE'
  | 'ADDRESS_REQUIRED'
  | 'ADDRESS_NOT_OWNED'
  | 'ORDER_BELOW_MINIMUM'
  | 'LINE_NOT_ORDERABLE'
  | 'CART_EMPTY'
  | 'CONFIG_UNAVAILABLE'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND';

/**
 * The actual error body the API returns.
 *
 * Note that endpoint-specific detail is merged in at the top level rather than
 * nested, so `blockers`, `serviceability`, `reason` and `productId` appear as
 * siblings of `code`. Which of them is present depends on `code`.
 */
export interface ApiErrorEnvelope {
  success: false;
  /** Human-readable message. Generic for unexpected internal failures. */
  error: string;
  /** Which input field was rejected, on validation failures. */
  field?: string;
  /** Absent on errors that predate error codes and on internal failures. */
  code?: ErrorCode;
  /** Every reason a cart could not be ordered, on order rejections. */
  blockers?: Blocker[];
  /** The delivery verdict in force when the order was rejected. */
  serviceability?: Serviceability;
  /** Why a single line was rejected, on cart rejections. */
  reason?: LineBlockerReason;
  /** Which product a line-level rejection refers to. */
  productId?: string;
}

/**
 * Pagination parameters for list endpoints
 * Used for implementing cursor-based or offset-based pagination
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure for list endpoints
 * Includes data array and comprehensive pagination metadata
 *
 * @template T - Type of the items in the data array
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Sorting parameters for list endpoints
 * Used for ordering results by specific fields
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
