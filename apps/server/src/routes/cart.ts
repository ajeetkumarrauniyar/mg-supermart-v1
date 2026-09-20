/**
 * Cart routes for MG Mart grocery application
 *
 * Handles shopping cart operations
 *
 * @author MG Mart Development Team
 * @version 1.0.0
 */

import { Router } from "express";
import { CartController } from "../controllers/index.js";
import { authenticateToken } from "../middleware/auth.js";

const router: Router = Router();
const cartController = new CartController();

// All cart routes require authentication
router.use(authenticateToken);

// Cart routes
router.get("/", cartController.getCart);
router.get("/count", cartController.getCartItemCount);
router.post("/add", cartController.addItem);
// Authoritative bill for the cart + address (D-012 §6, D-014 §4)
router.post("/quote", cartController.quote);

// Canonical item routes — what the mobile app calls (PD-2)
router.put("/items/:productId", cartController.updateItem);
router.delete("/items/:productId", cartController.removeItem);
// Deprecated aliases kept through M1
router.put("/update/:productId", cartController.updateItem);
router.delete("/remove/:productId", cartController.removeItem);

router.delete("/clear", cartController.clearCart);

export default router;
