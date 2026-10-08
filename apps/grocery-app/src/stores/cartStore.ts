import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CartItem, Product } from "@mg-mart/types";
import { cartService } from "../services";
import { useProductStore } from "./productStore";

export interface CartItemWithProduct extends CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  unit: string;
  quantity: number;
  addedAt: string;
  subtotal: number;
  category?: string;
}

export interface CartStore {
  // State
  items: CartItemWithProduct[];
  totalAmount: number;    // subtotal of the items, at the prices last synced
  totalItems: number;
  isLoading: boolean;
  error: string | null;
  lastSyncTime: number | null;

  // Actions
  addItem: (productId: string, quantity: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: (skipApiCall?: boolean) => Promise<void>;
  syncWithServer: () => Promise<void>;
  loadPersistedCart: () => void;
  calculateTotals: () => void;
  clearError: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      totalAmount: 0,
      totalItems: 0,
      isLoading: false,
      error: null,
      lastSyncTime: null,

      // Actions
      addItem: async (productId: string, quantity: number) => {
        try {
          // Get product details from product store
          const productStore = useProductStore.getState();
          const product = productStore.products.find((p: Product) => p.productId === productId);

          if (!product) {
            console.error("❌ Product not found in store:", productId);
            throw new Error("Product not found");
          }

          console.log("🛒 Adding to cart:", { productId, quantity, productName: product.name });

          const { items } = get();

          // Check if item already exists
          const existingItemIndex = items.findIndex(
            (item) => item.productId === productId
          );

          let updatedItems: CartItemWithProduct[];
          if (existingItemIndex >= 0) {
            // Update existing item
            console.log("📝 Updating existing item");
            updatedItems = items.map((item, index) =>
              index === existingItemIndex
                ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  subtotal: (item.quantity + quantity) * item.price,
                }
                : item
            );
          } else {
            // Add new item with product details
            console.log("➕ Adding new item to cart");
            // Orderability is optimistic here, from the catalog copy we hold.
            // The quote re-derives both flags server-side before anything is
            // priced or ordered, so a stale catalog cannot let a blocked line
            // through or wrongly exempt one from the minimum.
            const newItem: CartItemWithProduct = {
              productId: product.productId,
              quantity,
              price: product.price,
              subtotal: quantity * product.price,
              addedAt: new Date().toISOString(),
              imageUrl: product.imageUrl || '',
              unit: product.unit,
              name: product.name,
              isOrderable: product.isOrderable ?? true,
              minOrderExempt: product.minOrderExempt ?? false,
            };
            updatedItems = [...items, newItem];
          }

          // Update local state immediately (optimistic update)
          set({
            items: updatedItems,
            isLoading: false,
            lastSyncTime: Date.now(),
            error: null,
          });

          get().calculateTotals();
          console.log("✅ Cart updated successfully. Total items:", updatedItems.length);

          // Sync with API in background (don't block UI)
          // Check if user is still authenticated before making API call
          try {
            const { useAuthStore } = require('./authStore');
            if (useAuthStore.getState().isAuthenticated) {
              cartService.addItem({ productId, quantity })
                .then(() => {
                  console.log("✅ API sync successful");
                })
                .catch((error) => {
                  console.warn("⚠️ API sync failed:", error);
                });
            }
          } catch (error) {
            console.warn("Failed to check auth state for cart sync:", error);
          }

        } catch (error: any) {
          console.error("❌ Failed to add item to cart:", error);
          set({
            isLoading: false,
            error: error.message || "Failed to add item to cart",
          });
          throw error;
        }
      },

      updateItem: async (productId: string, quantity: number) => {
        try {
          if (quantity <= 0) {
            await get().removeItem(productId);
            return;
          }

          const { items } = get();

          const updatedItems = items.map((item) =>
            item.productId === productId
              ? { ...item, quantity, subtotal: quantity * item.price }
              : item
          );

          // Update local state immediately
          set({
            items: updatedItems,
            isLoading: false,
            lastSyncTime: Date.now(),
            error: null,
          });

          get().calculateTotals();

          // Sync with API in background
          try {
            const { useAuthStore } = require('./authStore');
            if (useAuthStore.getState().isAuthenticated) {
              cartService.updateItem({ productId, quantity })
                .catch((error) => {
                  console.warn("⚠️ API sync failed:", error);
                });
            }
          } catch (error) {
            console.warn("Failed to check auth state for cart sync:", error);
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || "Failed to update cart item",
          });
          throw error;
        }
      },

      removeItem: async (productId: string) => {
        try {
          const { items } = get();

          const updatedItems = items.filter(
            (item) => item.productId !== productId
          );

          // Update local state immediately
          set({
            items: updatedItems,
            isLoading: false,
            lastSyncTime: Date.now(),
            error: null,
          });

          get().calculateTotals();

          // Sync with API in background
          try {
            const { useAuthStore } = require('./authStore');
            if (useAuthStore.getState().isAuthenticated) {
              cartService.removeItem(productId)
                .catch((error) => {
                  console.warn("⚠️ API sync failed:", error);
                });
            }
          } catch (error) {
            console.warn("Failed to check auth state for cart sync:", error);
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || "Failed to remove item from cart",
          });
          throw error;
        }
      },

      clearCart: async (skipApiCall = false) => {
        try {
          // Update local state immediately
          set({
            items: [],
            totalAmount: 0,
            totalItems: 0,
            isLoading: false,
            lastSyncTime: Date.now(),
            error: null,
          });

          // Only sync with API if we have a valid token and not skipping
          if (!skipApiCall) {
            try {
              const { useAuthStore } = await import('./authStore');
              const { token, isAuthenticated } = useAuthStore.getState();

              if (token && isAuthenticated) {
                cartService.clearCart()
                  .catch((error) => {
                    console.warn("⚠️ API sync failed:", error);
                  });
              }
            } catch (error) {
              console.warn("⚠️ Could not check auth state for cart clear:", error);
            }
          }
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || "Failed to clear cart",
          });
          throw error;
        }
      },

      syncWithServer: async () => {
        set({ isLoading: true, error: null });
        try {
          const serverCart = await cartService.getCart();
          // Transform server cart items to include product details and subtotals
          const itemsWithDetails: CartItemWithProduct[] = serverCart.items.map(
            (item) => ({
              ...item,
              subtotal: item.quantity * item.price,
            })
          );

          set({
            items: itemsWithDetails,
            isLoading: false,
            lastSyncTime: Date.now(),
          });

          get().calculateTotals();
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || "Failed to sync cart with server",
          });
        }
      },

      loadPersistedCart: () => {
        // This will be called automatically by the persist middleware
        get().calculateTotals();
      },

      // Item counts and their subtotal only. Fees, the minimum order value and
      // the payable total are priced by the server and live in the quote store.
      calculateTotals: () => {
        const { items } = get();
        const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

        set({ totalAmount, totalItems });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        totalAmount: state.totalAmount,
        totalItems: state.totalItems,
        lastSyncTime: state.lastSyncTime,
      }),
      onRehydrateStorage: () => (state) => {
        // Recalculate totals after rehydration
        if (state) {
          state.calculateTotals();
        }
      },
    }
  )
);
