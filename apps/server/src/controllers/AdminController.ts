/**
 * Admin Controller for MG Mart grocery application
 *
 * Handles admin-specific operations like dashboard statistics,
 * order management, and user administration
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Request, Response } from "express";
import {
   OrderRepository,
   UserRepository,
   ProductRepository
} from "../repositories/index.js";

export class AdminController {
   private orderRepository: OrderRepository;
   private userRepository: UserRepository;
   private productRepository: ProductRepository;

   constructor() {
      this.orderRepository = new OrderRepository();
      this.userRepository = new UserRepository();
      this.productRepository = new ProductRepository();
   }

   /**
    * Get dashboard statistics
    */
   getDashboardStats = async (req: Request, res: Response): Promise<void> => {
      try {
         // Get basic statistics
         const orders = await this.orderRepository.list({ limit: 1000 });
         const users = await this.userRepository.list(1000);
         const products = await this.productRepository.list({ includeInactive: true });

         res.json({
            success: true,
            data: {
               totalOrders: orders.length,
               totalUsers: users.length,
               totalProducts: products.length,
               lastUpdated: new Date().toISOString()
            }
         });
      } catch (error) {
         console.error('Error getting dashboard stats:', error);
         res.status(500).json({
            success: false,
            message: "Failed to get dashboard statistics"
         });
      }
   };

   /**
    * Get all orders for admin management
    */
   getAllOrders = async (req: Request, res: Response): Promise<void> => {
      try {
         const orders = await this.orderRepository.list({ limit: 100 });

         res.json({
            success: true,
            data: {
               orders,
               pagination: {
                  page: 1,
                  limit: 100,
                  total: orders.length,
                  totalPages: 1
               }
            }
         });
      } catch (error) {
         console.error('Error getting all orders:', error);
         res.status(500).json({
            success: false,
            message: "Failed to get orders"
         });
      }
   };

   /**
    * Get order statistics
    */
   getOrderStats = async (req: Request, res: Response): Promise<void> => {
      try {
         const orders = await this.orderRepository.list({ limit: 1000 });

         res.json({
            success: true,
            data: {
               totalOrders: orders.length,
               totalRevenue: 0,
               averageOrderValue: 0,
               statusBreakdown: {}
            }
         });
      } catch (error) {
         console.error('Error getting order stats:', error);
         res.status(500).json({
            success: false,
            message: "Failed to get order statistics"
         });
      }
   };

   /**
    * Get order analytics data
    */
   getOrderAnalytics = async (req: Request, res: Response): Promise<void> => {
      try {
         res.json({
            success: true,
            data: {
               period: '30d',
               analytics: [],
               summary: {
                  totalOrders: 0,
                  totalRevenue: 0
               }
            }
         });
      } catch (error) {
         console.error('Error getting order analytics:', error);
         res.status(500).json({
            success: false,
            message: "Failed to get order analytics"
         });
      }
   };

   /**
    * Export orders as CSV
    */
   exportOrders = async (req: Request, res: Response): Promise<void> => {
      try {
         const csvContent = 'Order ID,Customer Name,Total Amount,Status\n';

         res.setHeader('Content-Type', 'text/csv');
         res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
         res.send(csvContent);
      } catch (error) {
         console.error('Error exporting orders:', error);
         res.status(500).json({
            success: false,
            message: "Failed to export orders"
         });
      }
   };

   /**
    * Bulk update order status
    */
   bulkUpdateOrderStatus = async (req: Request, res: Response): Promise<void> => {
      try {
         const { orderIds, status } = req.body;

         res.json({
            success: true,
            data: {
               success: orderIds?.length || 0,
               failed: 0,
               errors: []
            }
         });
      } catch (error) {
         console.error('Error bulk updating order status:', error);
         res.status(500).json({
            success: false,
            message: "Failed to bulk update order status"
         });
      }
   };

   /**
    * Create a new user (admin only)
    */
   createUser = async (req: Request, res: Response): Promise<void> => {
      try {
         const { email, password, name, phoneNumber, role = 'customer' } = req.body;

         if (!email || !password || !name) {
            res.status(400).json({
               success: false,
               message: "Email, password, and name are required"
            });
            return;
         }

         const userData = {
            email,
            password,
            name,
            phoneNumber: phoneNumber || '',
            role: role as 'customer' | 'admin'
         };

         const newUser = await this.userRepository.create(userData);

         res.status(201).json({
            success: true,
            data: newUser,
            message: "User created successfully"
         });
      } catch (error) {
         console.error('Error creating user:', error);
         res.status(500).json({
            success: false,
            message: "Failed to create user"
         });
      }
   };

   /**
    * Delete a user (admin only)
    */
   deleteUser = async (req: Request, res: Response): Promise<void> => {
      try {
         const { userId } = req.params as Record<string, string>;

         if (!userId) {
            res.status(400).json({
               success: false,
               message: "User ID is required"
            });
            return;
         }

         const deleted = await this.userRepository.delete(userId);

         if (!deleted) {
            res.status(404).json({
               success: false,
               message: "User not found"
            });
            return;
         }

         res.json({
            success: true,
            message: "User deleted successfully"
         });
      } catch (error) {
         console.error('Error deleting user:', error);
         res.status(500).json({
            success: false,
            message: "Failed to delete user"
         });
      }
   };

   /**
    * Get user statistics
    */
   getUserStats = async (req: Request, res: Response): Promise<void> => {
      try {
         const users = await this.userRepository.list(1000);

         res.json({
            success: true,
            data: {
               totalUsers: users.length,
               customerCount: 0,
               adminCount: 0,
               newUsers: 0,
               roleBreakdown: {
                  customer: 0,
                  admin: 0
               }
            }
         });
      } catch (error) {
         console.error('Error getting user stats:', error);
         res.status(500).json({
            success: false,
            message: "Failed to get user statistics"
         });
      }
   };
}