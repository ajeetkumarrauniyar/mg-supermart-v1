/**
 * Validation utilities
 *
 * This module provides comprehensive input validation for all data models
 * including users, products, orders, and cart operations. It ensures data
 * integrity before database operations and provides meaningful error messages.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { CreateUserInput, UpdateUserInput } from "../models/User.js";
import { CreateProductInput, UpdateProductInput } from "../models/Product.js";
import type { CreateOrderRequest } from "../models/Order.js";
import { AddToCartInput, UpdateCartItemInput } from "../models/Cart.js";
import type { AddressInput } from "../models/Address.js";

/**
 * Custom error class for validation failures
 * Extends the base Error class to include field-specific information
 * for better error handling and user feedback
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates email format using RFC-compliant regex pattern
 * @param email - Email address to validate
 * @returns true if email format is valid, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates phone number format (supports international formats)
 * Accepts numbers with optional country codes, spaces, dashes, and parentheses
 * @param phone - Phone number to validate
 * @returns true if phone format is valid, false otherwise
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates user creation data including email, password, name, phone, and address
 * @param userData - User data to validate for creation
 * @throws ValidationError when validation rules are not met
 */
export const validateCreateUser = (userData: CreateUserInput): void => {
  if (!userData.email || !validateEmail(userData.email)) {
    throw new ValidationError("Valid email is required", "email");
  }

  if (!userData.password || userData.password.length < 6) {
    throw new ValidationError(
      "Password must be at least 6 characters long",
      "password"
    );
  }

  if (!userData.name || userData.name.trim().length < 2) {
    throw new ValidationError(
      "Name must be at least 2 characters long",
      "name"
    );
  }

  if (!userData.phoneNumber || !validatePhoneNumber(userData.phoneNumber)) {
    throw new ValidationError("Valid phone number is required", "phoneNumber");
  }

  /*if (
    !userData.address ||
    !userData.address.street ||
    !userData.address.city ||
    !userData.address.state ||
    !userData.address.zipCode
  ) {
    throw new ValidationError("Complete address is required", "address");
  }*/
};

/**
 * Validates user update data (partial validation for optional fields)
 * Only validates fields that are provided in the update request
 * @param userData - User data to validate for updates
 * @throws ValidationError when validation rules are not met
 */
export const validateUpdateUser = (userData: UpdateUserInput): void => {
  if (userData.name && userData.name.trim().length < 2) {
    throw new ValidationError(
      "Name must be at least 2 characters long",
      "name"
    );
  }

  if (userData.phoneNumber && !validatePhoneNumber(userData.phoneNumber)) {
    throw new ValidationError("Valid phone number is required", "phoneNumber");
  }
};

/**
 * Validates product creation data including name, description, price, stock, and image
 * Ensures all required fields are present and meet business rules
 * @param productData - Product data to validate for creation
 * @throws ValidationError when validation rules are not met
 */
export const validateCreateProduct = (
  productData: CreateProductInput
): void => {
  if (!productData.name || productData.name.trim().length < 2) {
    throw new ValidationError(
      "Product name must be at least 2 characters long",
      "name"
    );
  }

  if (!productData.description || productData.description.trim().length < 10) {
    throw new ValidationError(
      "Product description must be at least 10 characters long",
      "description"
    );
  }

  if (!productData.price || productData.price <= 0) {
    throw new ValidationError("Product price must be greater than 0", "price");
  }

  if (!productData.stock || productData.stock < 0) {
    throw new ValidationError("Product stock cannot be negative", "stock");
  }

  if (!productData.imageUrl || !isValidUrl(productData.imageUrl)) {
    throw new ValidationError("Valid image URL is required", "imageUrl");
  }
};

/**
 * Validates product update data (partial validation for optional fields)
 * Only validates fields that are provided in the update request
 * @param productData - Product data to validate for updates
 * @throws ValidationError when validation rules are not met
 */
export const validateUpdateProduct = (
  productData: UpdateProductInput
): void => {
  if (productData.name && productData.name.trim().length < 2) {
    throw new ValidationError(
      "Product name must be at least 2 characters long",
      "name"
    );
  }

  if (productData.description && productData.description.trim().length < 10) {
    throw new ValidationError(
      "Product description must be at least 10 characters long",
      "description"
    );
  }

  if (productData.price !== undefined && productData.price <= 0) {
    throw new ValidationError("Product price must be greater than 0", "price");
  }

  if (productData.stock !== undefined && productData.stock < 0) {
    throw new ValidationError("Product stock cannot be negative", "stock");
  }

  if (productData.imageUrl && !isValidUrl(productData.imageUrl)) {
    throw new ValidationError("Valid image URL is required", "imageUrl");
  }

  validateProductFlags(productData);
};

/**
 * Validates the admin-owned catalogue flags when present (D-013).
 * They must be real booleans — "false" strings would otherwise be truthy.
 * @param data - Object that may carry isActive / isAvailable / minOrderExempt / mrp
 * @throws ValidationError when a provided flag is not a boolean
 */
export const validateProductFlags = (data: {
  isActive?: unknown;
  isAvailable?: unknown;
  minOrderExempt?: unknown;
  mrp?: unknown;
}): void => {
  for (const key of ["isActive", "isAvailable", "minOrderExempt"] as const) {
    if (data[key] !== undefined && typeof data[key] !== "boolean") {
      throw new ValidationError(`${key} must be a boolean`, key);
    }
  }
  if (data.mrp !== undefined && (typeof data.mrp !== "number" || data.mrp < 0)) {
    throw new ValidationError("mrp must be a non-negative number", "mrp");
  }
};

/**
 * Validates a client-supplied identifier that becomes a Firestore document id
 * (addressId, idempotencyKey). Anything else — "..", "a/b", "__x__" — would
 * reach the SDK as a raw path segment and surface as a 500 or a stray nested
 * document. Firestore auto-ids and UUIDs always match.
 * @param value - Raw value
 * @param fieldName - Field name for the error
 * @returns The trimmed id
 * @throws ValidationError when missing or malformed
 */
export const validateId = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
  const id = value.trim();
  // charset + length, and Firestore's reserved __name__ pattern
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || /^__.*__$/.test(id)) {
    throw new ValidationError(`${fieldName} is not a valid id`, fieldName);
  }
  return id;
};

/**
 * Validates the POST /orders body (D-004, D-005, D-012 §7).
 * Shape: { addressId, paymentMethod: "COD", idempotencyKey }. The cart, prices,
 * rules and serviceability are read server-side inside the transaction — the
 * client sends none of them. The idempotency key is checked by the controller
 * so it can carry its own error code.
 * @param body - Raw request body
 * @returns The validated request
 * @throws ValidationError when a field is missing or unsupported
 */
export const validateCreateOrder = (body: Record<string, unknown>): CreateOrderRequest => {
  const addressId = validateId(body.addressId, "addressId");

  const paymentMethod = body.paymentMethod;
  if (paymentMethod === undefined || paymentMethod === null || paymentMethod === "") {
    throw new ValidationError("paymentMethod is required", "paymentMethod");
  }
  if (paymentMethod !== "COD") {
    // D-005: cash on delivery only in M1; "Online" is reserved, not accepted
    throw new ValidationError("Only COD is supported at the moment", "paymentMethod");
  }

  // Absence is reported by the controller as IDEMPOTENCY_KEY_REQUIRED; a present
  // key must be a safe document id.
  const rawKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const idempotencyKey = rawKey === "" ? "" : validateId(rawKey, "idempotencyKey");

  return { addressId, paymentMethod: "COD", idempotencyKey };
};

/**
 * Validates cart item addition data
 * Ensures product ID is provided and quantity is positive
 * @param cartData - Cart item data to validate
 * @throws ValidationError when validation rules are not met
 */
export const validateAddToCart = (cartData: AddToCartInput): void => {
  if (!cartData.productId) {
    throw new ValidationError("Product ID is required", "productId");
  }

  if (!cartData.quantity || cartData.quantity <= 0) {
    throw new ValidationError("Quantity must be greater than 0", "quantity");
  }
};

/**
 * Validates cart item update data
 * Ensures quantity is not negative (0 quantity removes the item)
 * @param cartData - Cart item update data to validate
 * @throws ValidationError when validation rules are not met
 */
export const validateUpdateCartItem = (cartData: UpdateCartItemInput): void => {
  if (cartData.quantity < 0) {
    throw new ValidationError("Quantity cannot be negative", "quantity");
  }
};

/**
 * Validates that a required field is not empty or undefined
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @throws ValidationError when field is empty or undefined
 */
export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === "") {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
};

/**
 * Validates that a number is positive (greater than 0)
 * @param value - Number to validate
 * @param fieldName - Name of the field for error messages
 * @throws ValidationError when number is not positive
 */
export const validatePositiveNumber = (
  value: number,
  fieldName: string
): void => {
  if (typeof value !== "number" || value <= 0) {
    throw new ValidationError(
      `${fieldName} must be a positive number`,
      fieldName
    );
  }
};

/**
 * Validates password strength requirements
 * @param password - Password to validate
 * @throws ValidationError when password doesn't meet requirements
 */
export const validatePassword = (password: string): void => {
  if (!password || password.length < 6) {
    throw new ValidationError(
      "Password must be at least 6 characters long",
      "password"
    );
  }
};

/**
 * Helper function to validate URL format
 * Uses the URL constructor to check if the string is a valid URL
 * @param url - URL string to validate
 * @returns true if URL is valid, false otherwise
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates and normalises an address payload (D-012 §4).
 * Shape only — serviceability is never a validation concern. `lat`/`lng` are
 * required and must be real coordinates; `pincode` is optional and never gating.
 * Errors name the field so the client can highlight it without erasing input.
 * @param body - Raw request body
 * @returns A clean AddressInput (optional keys omitted when absent)
 * @throws ValidationError when a field is missing or malformed
 */
export const validateAddressInput = (body: Record<string, unknown>): AddressInput => {
  const str = (key: keyof AddressInput, required: boolean, max = 200): string | undefined => {
    const v = body[key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      if (required) throw new ValidationError(`${key} is required`, key);
      return undefined;
    }
    if (typeof v !== "string") throw new ValidationError(`${key} must be a string`, key);
    if (v.trim().length > max) throw new ValidationError(`${key} is too long`, key);
    return v.trim();
  };

  const num = (key: keyof AddressInput, required: boolean, min: number, max: number): number | undefined => {
    const v = body[key];
    if (v === undefined || v === null || v === "") {
      if (required) throw new ValidationError(`${key} is required`, key);
      return undefined;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) throw new ValidationError(`${key} must be a number`, key);
    if (n < min || n > max) throw new ValidationError(`${key} must be between ${min} and ${max}`, key);
    return n;
  };

  const phone = str("phone", true, 20)!;
  if (!validatePhoneNumber(phone)) {
    throw new ValidationError("Valid phone number is required", "phone");
  }

  const pincode = str("pincode", false, 10);
  if (pincode !== undefined && !/^\d{6}$/.test(pincode)) {
    throw new ValidationError("pincode must be 6 digits", "pincode");
  }

  const landmark = str("landmark", false);
  const accuracyM = num("accuracyM", false, 0, 100_000);

  return {
    label: str("label", true, 40)!,
    recipientName: str("recipientName", true, 100)!,
    phone,
    line1: str("line1", true)!,
    ...(landmark !== undefined && { landmark }),
    area: str("area", true)!,
    ...(pincode !== undefined && { pincode }),
    lat: num("lat", true, -90, 90)!,
    lng: num("lng", true, -180, 180)!,
    ...(accuracyM !== undefined && { accuracyM }),
  };
};
