/**
 * Order Controller for MG Mart grocery application
 *
 * Processes orders, manages order history, handles status updates,
 * and coordinates order fulfillment with proper validation and error handling.
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from "express";
import { OrderRepository } from "../repositories/OrderRepository.js";
import { CartRepository } from "../repositories/CartRepository.js";
import { ProductRepository } from "../repositories/ProductRepository.js";
import { validateRequired } from "../utils/validation.js";
import { ApiError } from "../utils/errorHandler.js";
import {
  CreateOrderInput,
  OrderStatus,
  PaymentMethod,
} from "../models/Order.js";

export class OrderController {
  private orderRepository: OrderRepository;
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
  }

  /**
   * Create a new order from user's cart
   * Validates cart, processes payment, updates inventory, and creates order
   */
  createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { paymentMethod, shippingAddress, notes } = req.body;

      // Validate required fields
      validateRequired(paymentMethod, "paymentMethod");
      validateRequired(shippingAddress, "shippingAddress");

      if (
        !shippingAddress ||
        !shippingAddress.street ||
        !shippingAddress.city ||
        !shippingAddress.state ||
        !shippingAddress.zipCode
      ) {
        throw new ApiError("Complete shipping address is required", 400);
      }

      // Validate payment method
      const validPaymentMethods: PaymentMethod[] = ["COD", "Online"];
      if (!validPaymentMethods.includes(paymentMethod)) {
        throw new ApiError("Invalid payment method", 400);
      }

      // Get user's cart
      const cart = await this.cartRepository.getCart(userId);
      if (!cart || cart.items.length === 0) {
        throw new ApiError("Cart is empty", 400);
      }

      // Validate cart items and check stock
      const orderItems = [];
      let totalAmount = 0;

      for (const cartItem of cart.items) {
        const product = await this.productRepository.findById(
          cartItem.productId
        );

        if (!product) {
          throw new ApiError(
            `Product ${cartItem.productId} is no longer available`,
            400
          );
        }

        if (product.stock < cartItem.quantity) {
          throw new ApiError(
            `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${cartItem.quantity}`,
            400
          );
        }

        const itemTotal = product.price * cartItem.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: cartItem.productId,
          productName: product.name,
          quantity: cartItem.quantity,
          unitPrice: product.price,
          totalPrice: itemTotal,
        });
      }

      // Create order input matching the Order model structure
      const createOrderInput: CreateOrderInput = {
        userId,
        items: orderItems.map((item) => ({
          productId: item.productId,
          name: item.productName,
          price: item.unitPrice,
          quantity: item.quantity,
        })),
        shippingAddress,
        paymentDetails: {
          paymentMethod: paymentMethod as PaymentMethod,
        },
      };

      // Create order
      const order = await this.orderRepository.create(createOrderInput);

      // Update product stock
      for (const cartItem of cart.items) {
        const product = await this.productRepository.findById(
          cartItem.productId
        );
        if (product) {
          await this.productRepository.update(cartItem.productId, {
            stock: product.stock - cartItem.quantity,
          });
        }
      }

      // Clear user's cart
      await this.cartRepository.clearCart(userId);

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List orders for the caller (B1 / ISS-001).
   *
   * Admin token  → every order, with the existing status/userId filters and
   *                pagination (delegates to getAllOrders — admin panel contract).
   * Customer     → only the caller's own orders, scoped server-side by userId.
   *                A customer-supplied `userId` query param is ignored.
   */
  listOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      if (req.user?.role === "admin") {
        await this.getAllOrders(req, res, next);
        return;
      }

      const { limit = "20", offset = "0", status } = req.query;

      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ApiError("Limit must be between 1 and 100", 400);
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        throw new ApiError("Offset must be a non-negative number", 400);
      }

      let statusFilter: OrderStatus | undefined;
      if (status) {
        const validStatuses: OrderStatus[] = [
          "pending",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
        ];
        if (!validStatuses.includes(status as OrderStatus)) {
          throw new ApiError("Invalid order status", 400);
        }
        statusFilter = status as OrderStatus;
      }

      const orders = await this.orderRepository.listByUser(userId, statusFilter);

      const total = orders.length;
      const paginatedOrders = orders.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        data: {
          orders: paginatedOrders,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific order by ID
   */
  getOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { orderId } = req.params as Record<string, string>;

      if (!orderId) {
        throw new ApiError("Order ID is required", 400);
      }

      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new ApiError("Order not found", 404);
      }

      // Admins can access any order; regular users can only access their own
      const isAdmin = req.user?.role === "admin";
      if (!isAdmin && order.userId !== userId) {
        throw new ApiError("Access denied", 403);
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cancel an order (only if status is pending or confirmed)
   */
  cancelOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new ApiError("User not authenticated", 401);
      }

      const { orderId } = req.params as Record<string, string>;
      const { reason } = req.body ?? {};

      if (!orderId) {
        throw new ApiError("Order ID is required", 400);
      }

      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new ApiError("Order not found", 404);
      }

      // Admins can cancel any order; regular users can only cancel their own
      const isAdmin = req.user?.role === "admin";
      if (!isAdmin && order.userId !== userId) {
        throw new ApiError("Access denied", 403);
      }

      // Check if order can be cancelled
      if (!["pending", "processing"].includes(order.status)) {
        throw new ApiError("Order cannot be cancelled at this stage", 400);
      }

      // Update order status to cancelled
      const updatedOrder = await this.orderRepository.updateStatus(
        orderId,
        "cancelled"
      );

      // Restore product stock
      for (const item of order.items) {
        const product = await this.productRepository.findById(item.productId);
        if (product) {
          await this.productRepository.update(item.productId, {
            stock: product.stock + item.quantity,
          });
        }
      }

      res.json({
        success: true,
        message: "Order cancelled successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update order status (Admin only)
   */
  updateOrderStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { orderId } = req.params as Record<string, string>;
      const { status } = req.body;

      if (!orderId) {
        throw new ApiError("Order ID is required", 400);
      }

      validateRequired(status, "status");

      // Validate status
      const validStatuses: OrderStatus[] = [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];
      if (!validStatuses.includes(status)) {
        throw new ApiError("Invalid order status", 400);
      }

      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new ApiError("Order not found", 404);
      }

      // Validate status transition
      const validTransitions: Record<OrderStatus, OrderStatus[]> = {
        pending: ["processing", "cancelled"],
        processing: ["shipped", "cancelled"],
        shipped: ["delivered", "cancelled"],
        delivered: [],
        cancelled: [],
      };

      if (!validTransitions[order.status].includes(status)) {
        throw new ApiError(
          `Cannot change status from ${order.status} to ${status}`,
          400
        );
      }

      const updatedOrder = await this.orderRepository.updateStatus(
        orderId,
        status
      );

      res.json({
        success: true,
        message: "Order status updated successfully",
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all orders (Admin only) with filtering and pagination
   */
  getAllOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        limit = "20",
        offset = "0",
        status,
        userId: filterUserId,
      } = req.query;

      // Parse pagination parameters
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ApiError("Limit must be between 1 and 100", 400);
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        throw new ApiError("Offset must be a non-negative number", 400);
      }

      // Get all orders
      let orders = await this.orderRepository.list({});

      // Apply filters
      if (status) {
        const validStatuses: OrderStatus[] = [
          "pending",
          "processing",
          "shipped",
          "delivered",
          "delivered",
          "cancelled",
        ];
        if (!validStatuses.includes(status as OrderStatus)) {
          throw new ApiError("Invalid order status", 400);
        }
        orders = orders.filter((order) => order.status === status);
      }

      if (filterUserId) {
        orders = orders.filter((order) => order.userId === filterUserId);
      }

      // Sort by creation date (newest first)
      orders.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply pagination
      const total = orders.length;
      const paginatedOrders = orders.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        data: {
          orders: paginatedOrders,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: offsetNum + limitNum < total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get order statistics (Admin only)
   */
  getOrderStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const orders = await this.orderRepository.list({});

      const stats = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
        statusBreakdown: {
          pending: orders.filter((o) => o.status === "pending").length,
          processing: orders.filter((o) => o.status === "processing").length,
          shipped: orders.filter((o) => o.status === "shipped").length,
          delivered: orders.filter((o) => o.status === "delivered").length,
          cancelled: orders.filter((o) => o.status === "cancelled").length,
        },
        averageOrderValue:
          orders.length > 0
            ? orders.reduce((sum, order) => sum + order.totalAmount, 0) /
              orders.length
            : 0,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };
}
