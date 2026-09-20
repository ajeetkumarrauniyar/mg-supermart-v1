/**
 * Cart Repository for MG Mart grocery application
 *
 * This repository handles all database operations related to shopping cart management
 * including adding/removing items, updating quantities, and cart validation.
 * Uses Firestore subcollections for efficient user-specific cart storage.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import {
  getDb,
  COLLECTIONS,
  createTimestamp,
  timestampToString,
} from "../services/firebase.js";
import {
  CartItem,
  CartItemWithProduct,
  AddToCartInput,
  UpdateCartItemInput,
  CartResponse,
  CartItemResponse,
} from "../models/Cart.js";
import { ProductRepository } from "./ProductRepository.js";
import { lineBlocker } from "../domain/orderability.js";

/**
 * Repository class for shopping cart operations
 * Manages cart items stored as subcollections under user documents
 */
export class CartRepository {
  /** Firestore database instance */
  private db = getDb();
  /** Product repository for fetching product details */
  private productRepository = new ProductRepository();

  /**
   * Gets the cart subcollection reference for a specific user
   * Cart items are stored as subcollections for better data locality and performance
   *
   * @param userId - ID of the user whose cart to access
   * @returns Firestore collection reference for the user's cart
   */
  private getCartCollection(userId: string) {
    return this.db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(COLLECTIONS.CART);
  }

  /**
   * Adds an item to the user's cart or updates quantity if item already exists
   * Automatically merges quantities if the same product is added multiple times
   *
   * @param userId - ID of the user adding the item
   * @param itemData - Item data including product ID and quantity
   * @returns Promise resolving to true if operation succeeds
   * @throws Error if the operation fails
   */
  async addItem(userId: string, itemData: AddToCartInput): Promise<boolean> {
    const cartCollection = this.getCartCollection(userId);
    const itemRef = cartCollection.doc(itemData.productId);

    // Check if item already exists in cart
    const existingItem = await itemRef.get();

    if (existingItem.exists) {
      // Update existing item quantity
      const currentData = existingItem.data() as CartItem;
      await itemRef.update({
        quantity: currentData.quantity + itemData.quantity,
        addedAt: createTimestamp(), // Update timestamp for freshness
      });
    } else {
      // Add new item to cart
      const cartItem: CartItem = {
        productId: itemData.productId,
        quantity: itemData.quantity,
        addedAt: createTimestamp(),
      };
      await itemRef.set(cartItem);
    }

    return true;
  }

  /**
   * Updates the quantity of an existing cart item
   * Removes the item if quantity is set to 0 or negative
   *
   * @param userId - ID of the user updating the item
   * @param productId - ID of the product to update
   * @param updateData - New quantity data
   * @returns Promise resolving to true if updated, false if item not found
   */
  async updateItem(
    userId: string,
    productId: string,
    updateData: UpdateCartItemInput
  ): Promise<boolean> {
    const cartCollection = this.getCartCollection(userId);
    const itemRef = cartCollection.doc(productId);

    const doc = await itemRef.get();
    if (!doc.exists) {
      return false;
    }

    // Remove item if quantity is 0 or negative
    if (updateData.quantity <= 0) {
      await itemRef.delete();
    } else {
      // Update item quantity and timestamp
      await itemRef.update({
        quantity: updateData.quantity,
        addedAt: createTimestamp(),
      });
    }

    return true;
  }

  /**
   * Removes a specific item from the user's cart
   *
   * @param userId - ID of the user removing the item
   * @param productId - ID of the product to remove
   * @returns Promise resolving to true if removed, false if item not found
   */
  async removeItem(userId: string, productId: string): Promise<boolean> {
    const cartCollection = this.getCartCollection(userId);
    const itemRef = cartCollection.doc(productId);

    const doc = await itemRef.get();
    if (!doc.exists) {
      return false;
    }

    await itemRef.delete();
    return true;
  }

  /**
   * Retrieves the complete cart for a user with product details and totals.
   *
   * D-013: stock is informational in M1 and is NOT consulted. Lines whose
   * product has become non-orderable are kept and flagged (isOrderable=false,
   * blocker) so the quote can explain them — never silently removed (EP-4.6).
   * Only a line whose product document no longer exists at all is dropped,
   * because it cannot be named or priced.
   *
   * @param userId - ID of the user whose cart to retrieve
   * @returns Promise resolving to complete cart response with items and totals
   */
  async getCart(userId: string): Promise<CartResponse> {
    const cartCollection = this.getCartCollection(userId);
    const snapshot = await cartCollection.get();

    // Return empty cart if no items
    if (snapshot.empty) {
      return {
        items: [],
        totalItems: 0,
        totalAmount: 0,
      };
    }

    // Extract cart items from Firestore documents
    const cartItems: CartItem[] = snapshot.docs.map(
      (doc) =>
        ({
          productId: doc.id,
          ...doc.data(),
        }) as CartItem
    );

    // Fetch product details and calculate totals
    const itemsWithProducts: CartItemWithProduct[] = [];
    let totalAmount = 0;
    let totalItems = 0;

    // Process each cart item with server-authoritative product data
    for (const cartItem of cartItems) {
      const product = await this.productRepository.findById(cartItem.productId);

      if (product) {
        const blocker = lineBlocker(product);
        const itemWithProduct: CartItemWithProduct = {
          productId: cartItem.productId,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          unit: product.unit,
          quantity: cartItem.quantity,
          addedAt: cartItem.addedAt,
          isOrderable: product.isOrderable,
          minOrderExempt: product.minOrderExempt,
          ...(blocker !== null && { blocker }),
        };

        itemsWithProducts.push(itemWithProduct);
        totalAmount += product.price * cartItem.quantity;
        totalItems += cartItem.quantity;
      } else {
        // The product document is gone entirely; nothing to show or price
        await this.removeItem(userId, cartItem.productId);
      }
    }

    // Convert to response format with string timestamps
    return {
      items: itemsWithProducts.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
        unit: item.unit,
        quantity: item.quantity,
        addedAt: timestampToString(item.addedAt),
        isOrderable: item.isOrderable,
        minOrderExempt: item.minOrderExempt,
        ...(item.blocker !== undefined && { blocker: item.blocker }),
      })),
      totalItems,
      totalAmount,
    };
  }

  /**
   * Clears all items from the user's cart
   * Typically used after successful order placement
   *
   * @param userId - ID of the user whose cart to clear
   * @returns Promise resolving to true if cart cleared successfully
   */
  async clearCart(userId: string): Promise<boolean> {
    const cartCollection = this.getCartCollection(userId);
    const snapshot = await cartCollection.get();

    // Use batch operation for efficient bulk deletion
    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return true;
  }

  /**
   * Gets the total number of items in the user's cart
   * Useful for displaying cart badge counts in the UI
   *
   * @param userId - ID of the user whose cart count to get
   * @returns Promise resolving to total number of items in cart
   */
  async getItemCount(userId: string): Promise<number> {
    const cartCollection = this.getCartCollection(userId);
    const snapshot = await cartCollection.get();

    // Sum up quantities from all cart items
    let totalItems = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CartItem;
      totalItems += data.quantity;
    });

    return totalItems;
  }
  /**
   * Checks the health of the repository by attempting to get a sample document
   * Used for monitoring and debugging purposes
   *
   * @returns Promise resolving to true if health check succeeds, false otherwise
   */
  async healthCheck(userId: string): Promise<boolean> {
    try {
      // For UserRepository
      await this.getCartCollection(userId).limit(1).get();
      return true;
    } catch (error) {
      console.error("Repository health check failed:", error);
      return false;
    }
  }
}
