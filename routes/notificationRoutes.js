import express from "express";
import { getNotifications, markAsRead, markAllAsRead, updateFcmToken, testNotifyAll } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.patch("/read/:id", protect, markAsRead);
router.patch("/read-all", protect, markAllAsRead);
router.post("/update-token", protect, updateFcmToken);

// Test API: Send to all users
router.post("/test-all", testNotifyAll);

export default router;
