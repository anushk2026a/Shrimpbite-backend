import express from "express";
import { 
    createReview, 
    getProductReviews, 
    submitOrderReview, 
    getRiderRating 
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";

const router = express.Router();

// Consolidated Order Submission (Order experience + Rider stars + Optional Products)
router.post("/submit-order-review", protectAppUser, submitOrderReview);

// Rider Ratings
router.get("/rider/:riderId", protect, getRiderRating);

// Product Ratings (Public)
router.get("/product/:productId", getProductReviews);

// Legacy/Individual Product Rating submission
router.post("/product", protectAppUser, createReview);

export default router;
