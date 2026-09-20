/**
 * Order Repository for MG Mart grocery application
 *
 * This repository handles all database operations related to order management
 * including order creation, status tracking, order history, and analytics.
 * Supports order lifecycle management from placement to delivery.
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
  Order,
  CreateOrderInput,
  UpdateOrderInput,
  OrderResponse,
  OrderStatus,
} from "../models/Order.js";

/**
 * Repository class for order management operations
 * Provides methods for order processing, tracking, and analytics
 */
export class OrderRepository {
  /** Firestore database instance */
  private db = getDb();
  /** Reference to the orders collection */
  private collection = this.db.collection(COLLECTIONS.ORDERS);

  /**
   * Creates a new order in the system
   * Calculates total amount from order items and sets initial status
   *
   * @param orderData - Order data for creation
   * @returns Promise resolving to the created order response
   * @throws Error if order creation fails
   */
  async create(orderData: CreateOrderInput): Promise<OrderResponse> {
    // Generate unique order ID
    const orderId = this.collection.doc().id;
    const now = createTimestamp();

    // Calculate total amount from order items
    const totalAmount = orderData.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Create order document with all required fields
    const order: Order = {
      orderId,
      userId: orderData.userId,
      items: orderData.items,
      totalAmount,
      status: "pending", // All orders start as pending
      shippingAddress: orderData.shippingAddress,
      paymentDetails: orderData.paymentDetails,
      createdAt: now,
      updatedAt: now,
    };

    // Save order to Firestore
    await this.collection.doc(orderId).set(order);
    return this.toResponse(order);
  }

  /**
   * Retrieves an order by its unique ID
   *
   * @param orderId - Unique identifier for the order
   * @returns Promise resolving to order response or null if not found
   */
  async findById(orderId: string): Promise<OrderResponse | null> {
    const doc = await this.collection.doc(orderId).get();
    if (!doc.exists) {
      return null;
    }
    return this.toResponse(doc.data() as Order);
  }

  /**
   * Retrieves all orders for a specific user
   * Ordered by creation date (newest first) with pagination support
   *
   * @param userId - ID of the user whose orders to retrieve
   * @param limit - Maximum number of orders to return (default: 10)
   * @param offset - Number of orders to skip (default: 0)
   * @returns Promise resolving to array of user's order responses
   */
  //TODO: Fix add a composite index for queries to filter on multiple fields userId and createdAt
  // async findByUserId(
  //   userId: string,
  //   limit: number = 10,
  //   offset: number = 0
  // ): Promise<OrderResponse[]> {
  //   const snapshot = await this.collection
  //     .where("userId", "==", userId)
  //     .orderBy("createdAt", "desc")
  //     .limit(limit)
  //     .offset(offset)
  //     .get();

  //   return snapshot.docs.map((doc) => this.toResponse(doc.data() as Order));
  // }

  /**
   * Updates an existing order's information
   * Typically used for status updates and payment confirmation
   *
   * @param orderId - ID of the order to update
   * @param updateData - Partial order data to update
   * @returns Promise resolving to updated order response or null if order not found
   */
  async update(
    orderId: string,
    updateData: UpdateOrderInput
  ): Promise<OrderResponse | null> {
    const orderRef = this.collection.doc(orderId);
    const doc = await orderRef.get();

    if (!doc.exists) {
      return null;
    }

    // Prepare update data with timestamp
    const updatedData = {
      ...updateData,
      updatedAt: createTimestamp(),
    };

    // Apply updates to the document
    await orderRef.update(updatedData);

    // Return updated order data
    const updatedDoc = await orderRef.get();
    return this.toResponse(updatedDoc.data() as Order);
  }

  /**
   * Updates the status of an order
   * Convenience method for order status tracking
   *
   * @param orderId - ID of the order to update
   * @param status - New status for the order
   * @returns Promise resolving to updated order response or null if order not found
   */
  async updateStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<OrderResponse | null> {
    return this.update(orderId, { status });
  }

  /**
   * Retrieves every order that belongs to one user, newest first.
   *
   * Scoped server-side by a single-field equality query, which needs no
   * composite index (unlike userId + orderBy createdAt). A customer's own
   * order set is small, so sorting/status filtering happens in memory.
   *
   * @param userId - Owner whose orders to return
   * @param status - Optional status filter
   */
  async listByUser(userId: string, status?: OrderStatus): Promise<OrderResponse[]> {
    const snapshot = await this.collection.where("userId", "==", userId).get();
    let orders = snapshot.docs.map((doc) => this.toResponse(doc.data() as Order));
    if (status) {
      orders = orders.filter((order) => order.status === status);
    }
    orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return orders;
  }

  /**
   * Retrieves a filtered and paginated list of orders
   * Supports filtering by status and user ID
   *
   * @param options - Filtering and pagination options
   * @returns Promise resolving to array of order responses
   */
  async list(
    options: {
      limit?: number;
      offset?: number;
      status?: OrderStatus;
      userId?: string;
    } = {}
  ): Promise<OrderResponse[]> {
    let query = this.collection.orderBy("createdAt", "desc");

    // Apply status filter
    if (options.status) {
      query = query.where("status", "==", options.status);
    }

    // Apply user filter
    if (options.userId) {
      query = query.where("userId", "==", options.userId);
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.toResponse(doc.data() as Order));
  }

  /**
   * Retrieves orders filtered by status
   * Useful for order management and fulfillment workflows
   *
   * @param status - Order status to filter by
   * @param limit - Maximum number of orders to return (default: 50)
   * @returns Promise resolving to array of orders with the specified status
   */
  //TODO: Fix add a index for queries for status and ordering by createdAt

  // async getOrdersByStatus(
  //   status: OrderStatus,
  //   limit: number = 50
  // ): Promise<OrderResponse[]> {
  //   const snapshot = await this.collection
  //     .where("status", "==", status)
  //     .orderBy("createdAt", "desc")
  //     .limit(limit)
  //     .get();

  //   return snapshot.docs.map((doc) => this.toResponse(doc.data() as Order));
  // }

  /**
   * Generates order statistics and analytics
   * Provides counts for each order status, optionally filtered by user
   *
   * @param userId - Optional user ID to filter statistics (for user-specific stats)
   * @returns Promise resolving to order statistics object
   */
  async getOrderStats(userId?: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  }> {
    // Execute queries based on whether userId filter is provided
    if (userId) {
      // Get statistics for a specific user
      const [total, pending, processing, shipped, delivered, cancelled] =
        await Promise.all([
          this.collection.where("userId", "==", userId).get(),
          this.collection
            .where("userId", "==", userId)
            .where("status", "==", "pending")
            .get(),
          this.collection
            .where("userId", "==", userId)
            .where("status", "==", "processing")
            .get(),
          this.collection
            .where("userId", "==", userId)
            .where("status", "==", "shipped")
            .get(),
          this.collection
            .where("userId", "==", userId)
            .where("status", "==", "delivered")
            .get(),
          this.collection
            .where("userId", "==", userId)
            .where("status", "==", "cancelled")
            .get(),
        ]);

      return {
        total: total.size,
        pending: pending.size,
        processing: processing.size,
        shipped: shipped.size,
        delivered: delivered.size,
        cancelled: cancelled.size,
      };
    }

    // Get statistics for all orders
    const [total, pending, processing, shipped, delivered, cancelled] =
      await Promise.all([
        this.collection.get(),
        this.collection.where("status", "==", "pending").get(),
        this.collection.where("status", "==", "processing").get(),
        this.collection.where("status", "==", "shipped").get(),
        this.collection.where("status", "==", "delivered").get(),
        this.collection.where("status", "==", "cancelled").get(),
      ]);

    return {
      total: total.size,
      pending: pending.size,
      processing: processing.size,
      shipped: shipped.size,
      delivered: delivered.size,
      cancelled: cancelled.size,
    };
  }

  /**
   * Converts internal Order model to OrderResponse for API responses
   * Converts timestamps to strings for JSON serialization
   *
   * @param order - Internal order model
   * @returns Order response object safe for API responses
   */
  private toResponse(order: Order): OrderResponse {
    return {
      orderId: order.orderId,
      userId: order.userId,
      items: order.items,
      totalAmount: order.totalAmount,
      status: order.status,
      shippingAddress: order.shippingAddress,
      paymentDetails: order.paymentDetails,
      createdAt: timestampToString(order.createdAt),
      updatedAt: timestampToString(order.updatedAt),
    };
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
      await this.collection.where("userId", "==", userId).limit(1).get();
      return true;
    } catch (error) {
      console.error("Repository health check failed:", error);
      return false;
    }
  }
}
