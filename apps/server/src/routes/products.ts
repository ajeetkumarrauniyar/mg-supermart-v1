/**
 * Product routes for MG Mart grocery application
 *
 * Handles product CRUD operations
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Router } from "express";
import { ProductController } from "../controllers/index.js";
import {
  authenticateToken,
  optionalAuth,
  requireAdmin,
} from "../middleware/auth.js";

const router: Router = Router();
const productController = new ProductController();

// Public routes; optionalAuth lets an admin token see inactive products
router.get("/", optionalAuth, productController.getAllProducts);
router.get("/:productId", optionalAuth, productController.getProductById);

// Admin-only routes - require authentication AND admin role
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  productController.createProduct
);
router.put(
  "/:productId",
  authenticateToken,
  requireAdmin,
  productController.updateProduct
);
router.delete(
  "/:productId",
  authenticateToken,
  requireAdmin,
  productController.deleteProduct
);

export default router;
