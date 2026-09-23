/**
 *
 * This repository handles all database operations related to product catalog management
 * including CRUD operations, inventory tracking, search functionality, and featured products.
 * Supports filtering by category, stock status, and product features.
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
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductResponse,
  ProductCategory,
} from "../models/Product.js";
import { normalizeProductFlags, deriveOrderable } from "../domain/orderability.js";

/**
 * Repository class for product catalog operations
 * Provides methods for managing the grocery store's product inventory
 */
export class ProductRepository {
  /** Firestore database instance */
  private db = getDb();
  /** Reference to the products collection */
  private collection = this.db.collection(COLLECTIONS.PRODUCTS);

  /**
   * Creates a new product in the catalog
   * Generates a unique product ID and sets creation timestamps
   *
   * @param productData - Product data for catalog entry
   * @returns Promise resolving to the created product response
   * @throws Error if product creation fails
   */
  async create(productData: CreateProductInput): Promise<ProductResponse> {
    // Generate unique product ID
    const productId = this.collection.doc().id;
    const now = createTimestamp();

    // Create product document with all required fields
    const product: Product = {
      productId,
      name: productData.name,
      description: productData.description,
      price: productData.price,
      category: productData.category,
      imageUrl: productData.imageUrl,
      stock: productData.stock,
      unit: productData.unit,
      isFeatured: productData.isFeatured || false, // Default to not featured
      createdAt: now,
      updatedAt: now,
    };

    // Save product to Firestore
    await this.collection.doc(productId).set(product);
    return this.toResponse(product);
  }

  /**
   * Retrieves a product by its unique ID
   *
   * @param productId - Unique identifier for the product
   * @returns Promise resolving to product response or null if not found
   */
  async findById(productId: string): Promise<ProductResponse | null> {
    const doc = await this.collection.doc(productId).get();
    if (!doc.exists) {
      return null;
    }
    return this.toResponse(doc.data() as Product);
  }

  /**
   * Updates an existing product's information
   * Only updates provided fields, leaving others unchanged
   *
   * @param productId - ID of the product to update
   * @param updateData - Partial product data to update
   * @returns Promise resolving to updated product response or null if product not found
   */
  async update(
    productId: string,
    updateData: UpdateProductInput
  ): Promise<ProductResponse | null> {
    const productRef = this.collection.doc(productId);
    const doc = await productRef.get();

    if (!doc.exists) {
      return null;
    }

    // Prepare update data with timestamp
    const updatedData: Record<string, unknown> = {
      ...updateData,
      updatedAt: createTimestamp(),
    };

    // Any admin-initiated category change is a manual decision — mark it so
    // the BUSY sync script (working-sync.js) never silently overwrites it
    // on the next sync. Sync-originated writes never go through this admin
    // update path, so this flag only ever gets set here, by a human.
    if (updateData.category !== undefined) {
      updatedData.categoryManuallySet = true;
    }

    // Apply updates to the document
    await productRef.update(updatedData);

    // Return updated product data
    const updatedDoc = await productRef.get();
    return this.toResponse(updatedDoc.data() as Product);
  }

  /**
   * Deletes a product from the catalog
   *
   * @param productId - ID of the product to delete
   * @returns Promise resolving to true if deleted, false if product not found
   */
  async delete(productId: string): Promise<boolean> {
    const productRef = this.collection.doc(productId);
    const doc = await productRef.get();

    if (!doc.exists) {
      return false;
    }

    await productRef.delete();
    return true;
  }

  /**
   * Retrieves a filtered and paginated list of products
   * Supports filtering by category, featured status, and stock availability
   *
   * @param options - Filtering and pagination options
   * @returns Promise resolving to array of product responses
   */
  async list(
    options: {
      limit?: number;
      offset?: number;
      category?: ProductCategory;
      isFeatured?: boolean;
      /** Re-mapped to the derived isOrderable; stock is not consulted. */
      inStock?: boolean;
      /** Admin only: include products with isActive=false. */
      includeInactive?: boolean;
    } = {}
  ): Promise<ProductResponse[]> {
    let query = this.collection.orderBy("createdAt", "desc");

    // Apply category filter
    if (options.category) {
      query = query.where("category", "==", options.category);
    }

    // Apply featured filter
    if (options.isFeatured !== undefined) {
      query = query.where("isFeatured", "==", options.isFeatured);
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    let products = snapshot.docs.map((doc) => this.toResponse(doc.data() as Product));

    // Customer listings exclude isActive=false IN MEMORY, after the Firestore
    // query, so documents that predate the flag (field missing) stay visible.
    // Known limitation: because this runs after Firestore applied limit/offset,
    // a requested page may contain fewer than `limit` visible products when
    // inactive documents fall inside it. Moving the filter into the query needs
    // where("isActive","==",true), a backfill of the missing flags and matching
    // composite indexes; until then, treat page sizes as approximate.
    if (!options.includeInactive) {
      products = products.filter((product) => product.isActive !== false);
    }

    if (options.inStock) {
      products = products.filter((product) => product.isOrderable);
    }

    return products;
  }

  /**
   * Retrieves featured products for homepage display
   * Only returns products that are featured and in stock
   *
   * @param limit - Maximum number of featured products to return (default: 10)
   * @returns Promise resolving to array of featured product responses
   */
  //TODO: Fix add a composite index for queries to filter on multiple fields isFeatured and stock
  // async getFeaturedProducts(limit: number = 10): Promise<ProductResponse[]> {
  //   const snapshot = await this.collection
  //     .where("isFeatured", "==", true)
  //     .where("stock", ">", 0)
  //     .limit(limit)
  //     .get();

  //   return snapshot.docs.map((doc) => this.toResponse(doc.data() as Product));
  // }

  /**
   * Searches products by name using prefix matching
   * Note: Firestore doesn't support full-text search natively
   * This implementation uses basic prefix matching for product names
   *
   * @param searchTerm - Search term to match against product names
   * @param limit - Maximum number of search results (default: 20)
   * @returns Promise resolving to array of matching product responses
   */
  async searchProducts(
    searchTerm: string,
    limit: number = 20
  ): Promise<ProductResponse[]> {
    // Basic prefix search implementation
    // For production, consider using Algolia or Elasticsearch for better search
    const snapshot = await this.collection
      .where("name", ">=", searchTerm)
      .where("name", "<=", searchTerm + "\uf8ff")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.toResponse(doc.data() as Product));
  }

  /**
   * Updates the stock quantity for a specific product
   * Used for inventory management and order processing
   *
   * @param productId - ID of the product to update stock for
   * @param newStock - New stock quantity
   * @returns Promise resolving to true if updated, false if product not found
   */
  async updateStock(productId: string, newStock: number): Promise<boolean> {
    const productRef = this.collection.doc(productId);
    const doc = await productRef.get();

    if (!doc.exists) {
      return false;
    }

    // Update stock and timestamp
    await productRef.update({
      stock: newStock,
      updatedAt: createTimestamp(),
    });

    return true;
  }

  /**
   * Converts internal Product model to ProductResponse for API responses
   * Converts timestamps to strings for JSON serialization
   *
   * @param product - Internal product model
   * @returns Product response object safe for API responses
   */
  private toResponse(product: Product): ProductResponse {
    // Persist the underlying facts and derive isOrderable; never store the verdict.
    const flags = normalizeProductFlags(product);
    return {
      productId: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      categoryManuallySet: product.categoryManuallySet ?? false,
      imageUrl: product.imageUrl,
      stock: product.stock,
      unit: product.unit,
      isFeatured: product.isFeatured,
      ...(product.mrp !== undefined && { mrp: product.mrp }),
      ...flags,
      isOrderable: deriveOrderable(flags),
      createdAt: timestampToString(product.createdAt),
      updatedAt: timestampToString(product.updatedAt),
    };
  }

  /**
   * Checks the health of the repository by attempting to get a sample document
   * Used for monitoring and debugging purposes
   *
   * @returns Promise resolving to true if health check succeeds, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      // For UserRepository
      await this.collection.orderBy("createdAt", "desc").limit(1).get();
      return true;
    } catch (error) {
      console.error("Repository health check failed:", error);
      return false;
    }
  }
}