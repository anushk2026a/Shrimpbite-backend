import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { placeOrder, getMyOrders, placeSpotOrder } from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protectAppUser, placeOrder);
router.post("/spot-order", protectAppUser, placeSpotOrder);
router.get("/my-orders", protectAppUser, getMyOrders);

export default router;
