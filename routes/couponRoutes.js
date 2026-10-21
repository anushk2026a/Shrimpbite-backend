import express from "express";
import {
    applyCoupon,
    getPublicCoupons,
    getAllCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon
} from "../controllers/couponController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/public", getPublicCoupons);
router.post("/apply", applyCoupon);

// Admin / Retailer management routes
router.get("/admin", protect, getAllCoupons);
router.post("/", protect, createCoupon);
router.put("/:id", protect, updateCoupon);
router.delete("/:id", protect, deleteCoupon);

export default router;
