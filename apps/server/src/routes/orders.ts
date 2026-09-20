/**
 * Order routes for MG Mart grocery application
 *
 * Handles order management operations
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Router } from "express";
import { OrderController } from "../controllers/index.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router: Router = Router();
const orderController = new OrderController();

// All order routes require authentication
router.use(authenticateToken);

// Order routes
router.post("/", orderController.createOrder);
// B1: admin token → all orders; customer token → own orders only
router.get("/", orderController.listOrders);
router.get("/:orderId", orderController.getOrderById);
// B1: status changes are admin-only
router.put("/:orderId/status", requireAdmin, orderController.updateOrderStatus);
router.put("/:orderId/cancel", orderController.cancelOrder);

export default router;

