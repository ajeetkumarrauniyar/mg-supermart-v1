import { api } from "./apiService";
import type { Cart, CartItem, Quote } from "@mg-mart/types";

// Cart request types
export interface AddToCartRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  productId: string;
  quantity: number;
}

export interface RemoveFromCartRequest {
  productId: string;
}

export interface CartResponse {
  cart: Cart;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  tax: number;
  total: number;
}

// Cart service
export const cartService = {
  // Get current user's cart
  getCart: async (): Promise<Cart> => {
    const response = await api.get<Cart>("/cart");
    return response;
  },

  // Add item to cart
  addItem: async (item: AddToCartRequest): Promise<CartItem> => {
    return await api.post<CartItem>("/cart/add", item);
  },

  // Update cart item quantity
  updateItem: async (update: UpdateCartItemRequest): Promise<CartItem> => {
    return await api.put<CartItem>(`/cart/items/${update.productId}`, { quantity: update.quantity });
  },

  // Remove item from cart
  removeItem: async (productId: string): Promise<void> => {
    await api.delete(`/cart/items/${productId}`);
  },

  // Clear entire cart
  clearCart: async (): Promise<void> => {
    await api.delete("/cart/clear");
  },

  // Authoritative bill for the current cart. Fees, the minimum order value and
  // every blocker are server configuration; the client renders them unchanged.
  // Omitting addressId is valid: the bill still prices correctly and reports
  // ADDRESS_REQUIRED instead of failing.
  quote: async (addressId?: string): Promise<Quote> => {
    return await api.post<Quote>("/cart/quote", addressId ? { addressId } : {});
  },

  //TODO: Get cart summary (totals, counts, etc.)
  getCartSummary: async (): Promise<CartSummary> => {
    return await api.get<CartSummary>("/cart/summary");
  },

  //TODO: Sync local cart with server (useful after login)
  syncCart: async (localCartItems: CartItem[]): Promise<Cart> => {
    const response = await api.post<Cart>("/cart/sync", {
      items: localCartItems,
    });
    return response;
  },

  //TODO: Validate cart items (check availability, prices, etc.)
  validateCart: async (): Promise<{
    valid: boolean;
    issues: Array<{
      productId: string;
      issue: "out_of_stock" | "price_changed" | "not_available";
      message: string;
    }>;
  }> => {
    return await api.get("/cart/validate");
  },

  //TODO: Apply coupon/discount code
  applyCoupon: async (couponCode: string): Promise<Cart> => {
    const response = await api.post<Cart>("/cart/coupon", {
      code: couponCode,
    });
    return response;
  },

  //TODO: Remove applied coupon
  removeCoupon: async (): Promise<Cart> => {
    const response = await api.delete<Cart>("/cart/coupon");
    return response;
  },

  //TODO: Estimate shipping for cart
  estimateShipping: async (address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }): Promise<{
    options: Array<{
      id: string;
      name: string;
      cost: number;
      estimatedDays: number;
    }>;
  }> => {
    return await api.post("/cart/shipping-estimate", { address });
  },
};

export default cartService;
