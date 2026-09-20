/**
 * Cart Controller for MG Mart grocery application
 *
 * Handles cart operations including adding/removing items, updating quantities,
 * cart management, and cart-to-order conversion with proper validation.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from "express";
import { CartRepository } from "../repositories/CartRepository.js";
import { ProductRepository } from "../repositories/ProductRepository.js";
import {
  validateRequired,
  validatePositiveNumber,
  validateId,
} from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";
import { AddToCartInput, UpdateCartItemInput } from "../models/Cart.js";
import { lineBlocker } from "../domain/orderability.js";
import type { ProductResponse } from "../models/Product.js";
import {
  QuoteService,
  AddressNotOwnedError,
  noAddressServiceability,
} from "../services/QuoteService.js";
import { requireStoreConfig } from "./AddressController.js";

/** D-013: only the derived verdict gates carting; stock is informational in M1. */
const assertOrderable = (product: ProductResponse): void => {
  const reason = lineBlocker(product);
  if (reason !== null) {
    throw new ApiError(
      reason === "INACTIVE"
        ? `${product.name} is no longer listed`
        : `${product.name} is not available right now`,
      422,
      "productId",
      "LINE_NOT_ORDERABLE",
      { reason, productId: product.productId }
    );
  }
};

export class CartController {
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;
  private quoteService: QuoteService;

  constructor() {
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
    this.quoteService = new QuoteService();
  }

  /**
   * POST /cart/quote { addressId? } — the authoritative bill for this cart
   * and address (D-012 §6, D-014 §4). Always 200 with serviceability, bill,
   * orderable and blockers; a quote is a report, never an HTTP error. The
   * only exceptions: 503 CONFIG_UNAVAILABLE, and 403 ADDRESS_NOT_OWNED for an
   * explicit addressId that is not the caller's.
   */
  quote = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const body = (req.body ?? {}) as { addressId?: unknown };
      const addressId =
        typeof body.addressId === "string" && body.addressId.trim() !== ""
          ? validateId(body.addressId, "addressId")
          : undefined;

      const config = requireStoreConfig();
      const quote = await this.quoteService.assemble(userId, addressId, config);

      res.json({
        success: true,
        data: {
          addressId: quote.address?.addressId ?? null,
          serviceability: quote.serviceability ?? noAddressServiceability(config),
          bill: quote.bill,
          orderable: quote.bill.orderable,
          blockers: quote.bill.blockers,
        },
      });
    } catch (error) {
      if (error instanceof AddressNotOwnedError) {
        next(new ApiError("Address not found for this account", 403, "addressId", "ADDRESS_NOT_OWNED"));
        return;
      }
      next(error);
    }
  };

  /**
   * Get user's current cart with all items and totals
   */
  getCart = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const cart = await this.cartRepository.getCart(userId);
      if (!cart) {
        // Return empty cart if none exists
        res.json({
          success: true,
          data: {
            cartId: null,
            userId,
            items: [],
            totalAmount: 0,
            totalItems: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
        return;
      }

      res.json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add item to cart or update quantity if item already exists
   */
  addItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { productId, quantity } = req.body;

      // Validate input
      validateRequired(productId, "productId");
      validateRequired(quantity, "quantity");
      validatePositiveNumber(quantity, "Quantity");

      // Verify product exists and is orderable (D-013)
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new ApiError("Product not found", 404, undefined, "NOT_FOUND");
      }
      assertOrderable(product);

      // Add item to cart using repository
      const addItemInput = {
        productId,
        quantity: parseInt(quantity, 10),
      };

      await this.cartRepository.addItem(userId, addItemInput);

      // Get updated cart to return
      const updatedCart = await this.cartRepository.getCart(userId);

      res.json({
        success: true,
        message: "Item added to cart successfully",
        data: updatedCart,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update item quantity in cart
   */
  updateItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { productId } = req.params as Record<string, string>;
      const { quantity } = req.body;

      // Validate input
      validateRequired(quantity, "quantity");
      validatePositiveNumber(quantity, "Quantity");

      // Get user's cart
      const cart = await this.cartRepository.getCart(userId);
      if (!cart) {
        throw new ApiError("Cart not found", 404);
      }

      // Check if item exists in cart
      const existingItem = cart.items.find(
        (item) => item.productId === productId
      );
      if (!existingItem) {
        throw new ApiError("Item not found in cart", 404);
      }

      // Verify product is still orderable (D-013)
      const product = await this.productRepository.findById(productId!);
      if (!product) {
        throw new ApiError("Product not found", 404, undefined, "NOT_FOUND");
      }
      assertOrderable(product);

      // Update item quantity
      const updateInput: UpdateCartItemInput = {
        quantity: parseInt(quantity, 10),
      };

      await this.cartRepository.updateItem(userId, productId!, updateInput);
      const updatedCart = await this.cartRepository.getCart(userId);

      res.json({
        success: true,
        message: "Cart item updated successfully",
        data: updatedCart,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove item from cart
   */
  removeItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { productId } = req.params as Record<string, string>;

      if (!productId) {
        throw new ApiError("Product ID is required", 400);
      }

      // Get user's cart
      const cart = await this.cartRepository.getCart(userId);
      if (!cart) {
        throw new ApiError("Cart not found", 404);
      }

      // Check if item exists in cart
      const existingItem = cart.items.find(
        (item) => item.productId === productId
      );
      if (!existingItem) {
        throw new ApiError("Item not found in cart", 404);
      }

      // Remove item from cart
      const updatedCart = await this.cartRepository.removeItem(
        userId,
        productId!
      );

      res.json({
        success: true,
        message: "Item removed from cart successfully",
        data: updatedCart,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Clear all items from cart
   */
  clearCart = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      // Get user's cart
      const cart = await this.cartRepository.getCart(userId);
      if (!cart) {
        throw new ApiError("Cart not found", 404);
      }

      // Clear cart
      await this.cartRepository.clearCart(userId);
      const clearedCart = await this.cartRepository.getCart(userId);

      res.json({
        success: true,
        message: "Cart cleared successfully",
        data: clearedCart,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get cart item count for user
   */
  getCartItemCount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const cart = await this.cartRepository.getCart(userId);
      const itemCount = cart ? cart.totalItems : 0;

      res.json({
        success: true,
        data: {
          itemCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Validate cart items before checkout
   * Checks product availability and stock levels
   */
  validateCart = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const cart = await this.cartRepository.getCart(userId);
      if (!cart || cart.items.length === 0) {
        throw new ApiError("Cart is empty", 400);
      }

      const validationErrors: string[] = [];
      const validatedItems = [];

      // Validate each cart item
      for (const item of cart.items) {
        const product = await this.productRepository.findById(item.productId);

        if (!product) {
          validationErrors.push(
            `Product ${item.productId} is no longer available`
          );
          continue;
        }

        if (product.stock < item.quantity) {
          validationErrors.push(
            `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
          );
          continue;
        }

        validatedItems.push({
          ...item,
          product: {
            name: product.name,
            price: product.price,
            stock: product.stock,
          },
        });
      }

      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: "Cart validation failed",
          errors: validationErrors,
        });
        return;
      }

      res.json({
        success: true,
        message: "Cart is valid for checkout",
        data: {
          // Cart response doesn't include cartId
          items: validatedItems,
          totalAmount: cart.totalAmount,
          totalItems: cart.totalItems,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
