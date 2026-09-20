/**
 * Routes index for MG Mart grocery application
 *
 * Centralizes all route imports and exports
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import productRoutes from "./products.js";
import cartRoutes from "./cart.js";
import orderRoutes from "./orders.js";
import imageManagementRoutes from "./image-management.js";
import adminRoutes from "./admin.js";
import categorySyncQueueRoutes from "./category-sync-queue.js";
import addressRoutes from "./addresses.js";

const router: Router = Router();

// Mount all routes with their respective prefixes
router.use("/v1/auth", authRoutes);
router.use("/v1/users", userRoutes);
router.use("/v1/products", productRoutes);
router.use("/v1/cart", cartRoutes);
router.use("/v1/orders", orderRoutes);
router.use("/v1", imageManagementRoutes);
router.use("/v1/admin", adminRoutes);
router.use("/v1/category-sync-queue", categorySyncQueueRoutes);
router.use("/v1/addresses", addressRoutes);

export default router;