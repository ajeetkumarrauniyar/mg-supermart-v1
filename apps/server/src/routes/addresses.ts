/**
 * Address routes.
 *
 * Mounted by routes/index.ts as `/v1/addresses` under app.ts `/api`, so the
 * public URL is /api/v1/addresses. This router declares only bare paths —
 * never repeat `/v1` or `/addresses` here.
 */
import { Router } from "express";
import { AddressController } from "../controllers/AddressController.js";
import { authenticateToken } from "../middleware/auth.js";

const router: Router = Router();
const addressController = new AddressController();

// All address routes require authentication; ownership is the path users/{uid}/addresses
router.use(authenticateToken);

router.get("/", addressController.list);
router.post("/", addressController.create);
router.put("/:addressId", addressController.update);
router.delete("/:addressId", addressController.remove);
router.put("/:addressId/default", addressController.setDefault);

export default router;
